import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/index.js';

applyLanguage('en');
const inputs = values => Object.fromEntries(Object.entries(values).map(([key, block]) => [key, { block }]));
const text = TEXT => ({ type: 'text', fields: { TEXT } });
const num = NUM => ({ type: 'math_number', fields: { NUM } });
const get = () => ({ type: 'variables_get', fields: { VAR: { id: 'r' } } });
const request = (fields = {}, values = {}) => ({ type: 'http_request', fields, inputs: inputs({ URL: text('http://localhost/test'), ...values }) });
const read = (type, values = {}) => ({ type, inputs: inputs({ RESPONSE: get(), ...values }) });
const print = value => ({ type: 'text_print', inputs: inputs({ TEXT: value }) });
function chain(...blocks) {
  for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
  return blocks[0];
}
function generate(blocks, variables = [{ id: 'r', name: '响应' }]) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({ variables, blocks: { languageVersion: 0, blocks } }, workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally { workspace.dispose(); }
}
function python(source) {
  const result = spawnSync('python3', ['-c', source], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}
const mock = `import sys, types
calls = []
class Response:
    status_code = 404
    text = '你好'
    content = b'\\x00\\xff'
    headers = {'Content-Type': 'application/json'}
    closed = False
    def json(self): return {'value': 42}
    def close(self): self.closed = True
    def __enter__(self): return self
    def __exit__(self, *args): self.close()
def request(*args, **kwargs):
    response = Response()
    calls.append((args, kwargs, response))
    return response
sys.modules['requests'] = types.SimpleNamespace(request=request)
`;

test('HTTP generates native request methods, data/JSON bodies, headers and timeout without hidden helpers', () => {
  const header = { type: 'http_header', fields: { NAME: 'Content-Type' }, inputs: inputs({ VALUE: text('text/plain; charset=utf-8') }) };
  const code = generate([
    request({ METHOD: 'POST', BODY_MODE: 'DATA' }, { BODY: text('你好'), HEADERS: header, TIMEOUT: num(3.5) }),
    request({ METHOD: 'PATCH', BODY_MODE: 'JSON' }, { BODY: { type: 'lists_create_with', extraState: { itemCount: 0 } } }),
    ...['GET', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'].map(METHOD => request({ METHOD })),
  ]);
  assert.equal(code.match(/import requests as _http_requests/g)?.length, 1);
  assert.ok(!code.includes('def _http'));
  python(mock + code + `
assert calls[0][0] == ('POST', 'http://localhost/test')
assert calls[0][1] == dict(timeout=3.5, headers={'Content-Type':'text/plain; charset=utf-8'}, data='你好')
assert calls[1][1] == dict(timeout=10, json=[])
assert [call[0][0] for call in calls[2:]] == ['GET','PUT','DELETE','HEAD','OPTIONS']
assert all(call[1] == dict(timeout=10) for call in calls[2:])
`);
});

test('response accessors preserve native types and an HTTP error status is returned normally', () => {
  const code = generate([chain(
    { type: 'variables_set', fields: { VAR: { id: 'r' } }, inputs: inputs({ VALUE: request() }) },
    print(read('http_status_code')), print(read('http_response_text')), print(read('http_response_content')),
    print(read('http_response_json')), print(read('http_response_header', { NAME: text('Content-Type') })),
    print(read('http_response_header', { NAME: text('missing') })), read('http_close'),
  )]);
  assert.match(code, /响应.status_code/);
  assert.match(code, /响应.content/);
  assert.match(code, /响应.json\(\)/);
  python(mock + code + '\nassert len(calls) == 1 and calls[0][2].closed\n');
});

test('with-response releases the response on success and when nested blocks raise', () => {
  const scope = body => ({ type: 'http_with_response', fields: { VAR: { id: 'r' } }, inputs: inputs({ RESPONSE: request(), DO: body }) });
  const code = generate([scope(print(read('http_response_text')))]);
  assert.match(code, /with _http_requests.request\('GET', 'http:\/\/localhost\/test', timeout=10\) as 响应:/);
  python(mock + code + '\nassert calls[0][2].closed\n');
  const failing = generate([scope({ type: 'python_call_statement', inputs: inputs({ CALLABLE: { type: 'python_name', fields: { NAME: 'fail' } } }) })]);
  python(mock + `def fail(): raise ValueError('invalid JSON')
try:
` + failing.split('\n').map(line => '    ' + line).join('\n') + `
except ValueError: pass
else: raise AssertionError('error swallowed')
assert calls[0][2].closed
`);
});

test('missing inputs and invalid literal options produce generation errors', () => {
  assert.throws(() => generate([{ type: 'http_request' }]), /Connect an expression/);
  for (const type of ['http_status_code', 'http_response_text', 'http_response_content', 'http_response_json', 'http_response_header', 'http_close', 'http_with_response']) {
    assert.throws(() => generate([{ type }]), /Connect an expression/);
  }
  for (const timeout of [0, -1]) assert.throws(() => generate([request({}, { TIMEOUT: num(timeout) })]), /greater than zero/);
  assert.throws(() => generate([request({ BODY_MODE: 'JSON' })]), /Connect an expression/);
  const header = { type: 'http_header', fields: { NAME: 'Bad Header' }, inputs: inputs({ VALUE: text('x') }) };
  assert.throws(() => generate([request({}, { HEADERS: header })]), /valid HTTP header/);
});

test('HTTP toolbox definitions render and generate in both languages, reserving the import name', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    const entries = createToolbox().contents.find(item => item.name === 'HTTP').contents;
    const workspace = new Blockly.Workspace();
    try {
      for (const entry of entries) assert.ok(!workspace.newBlock(entry.type).toString().includes('%{BKY_'));
    } finally { workspace.dispose(); }
    const code = generate([
      { type: 'variables_set', fields: { VAR: { id: 'collision' } }, inputs: inputs({ VALUE: num(1) }) }, request(),
    ], [{ id: 'collision', name: '_http_requests' }]);
    assert.match(code, /_http_requests_2 = 1/);
    python(mock + code);
  }
  applyLanguage('en');
});

test('HTTP example compiles and closes its response through the native context manager', () => {
  const project = JSON.parse(readFileSync(new URL('../examples/http-get.blockly.json', import.meta.url), 'utf8'));
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(project.workspace, workspace);
    const code = pythonGenerator.workspaceToCode(workspace);
    assert.match(code, /while not _wifi.isconnected\(\)/);
    assert.match(code, /with _http_requests.request/);
    assert.match(code, /响应.text/);
    python(`compile(${JSON.stringify(code)}, '<http-example>', 'exec')`);
  } finally { workspace.dispose(); }
});
