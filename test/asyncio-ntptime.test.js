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
const b = (type, fields = {}, values = {}) => ({ type, fields, inputs: Object.fromEntries(Object.entries(values).map(([key, block]) => [key, { block }])) });
const text = TEXT => b('text', { TEXT });
const num = NUM => b('math_number', { NUM });
const get = id => b('variables_get', { VAR: { id } });
const set = (id, VALUE) => b('variables_set', { VAR: { id } }, { VALUE });
const print = TEXT => b('text_print', {}, { TEXT: typeof TEXT === 'string' ? text(TEXT) : TEXT });
const wait = VALUE => b('python_await', {}, { VALUE });
const sleep = (duration, UNIT = 'MS') => wait(b('asyncio_sleep', { UNIT }, { DURATION: num(duration) }));
function chain(...blocks) {
  for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
  return blocks[0];
}
const vars = [{ id: 'a', name: '任务甲' }, { id: 'b', name: '任务乙' }, { id: 'count', name: '次数' }];
function generate(blocks, variables = vars) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({ variables, blocks: { languageVersion: 0, blocks } }, workspace);
    const code = pythonGenerator.workspaceToCode(workspace);
    assert.equal(pythonGenerator.workspaceToCode(workspace), code);
    return code;
  } finally { workspace.dispose(); }
}
function python(code) {
  const result = spawnSync('python3', ['-c', code], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}
const asyncSetup = `import asyncio
async def sleep_ms(value):
    await asyncio.sleep(value / 1000)
asyncio.sleep_ms = sleep_ms
`;

test('NTP uses native configuration, query and UTC RTC synchronization separately', () => {
  const code = generate([chain(
    b('ntptime_config', {}, { HOST: text('pool.ntp.org'), TIMEOUT: num(2.5) }),
    print(b('ntptime_time')), b('ntptime_sync'), print(b('timing_epoch_seconds')), print(b('timing_datetime')),
  )]);
  assert.equal(code.match(/import ntptime as _ntptime/g)?.length, 1);
  assert.match(code, /_ntptime.host = 'pool.ntp.org'\n_ntptime.timeout = 2.5/);
  assert.match(code, /_ntptime.time\(\)/);
  assert.match(code, /_ntptime.settime\(\)/);
  assert.match(code, /_timing_time.gmtime\(\)/);
  assert.ok(!code.includes('28800'));
  python(`import types, sys
calls = []
ntp = types.SimpleNamespace(time=lambda: calls.append('query') or 123, settime=lambda: calls.append('sync'))
sys.modules['ntptime'] = ntp
` + code + `
assert calls == ['query','sync']
assert ntp.host == 'pool.ntp.org' and ntp.timeout == 2.5
`);
  for (const timeout of [0, -1]) assert.throws(() => generate([b('ntptime_config', {}, { TIMEOUT: num(timeout) })]), /greater than zero/);
});

test('async tasks run concurrently with independent functions, shared variables and return values', () => {
  const code = generate([b('asyncio_run', {}, { DO: chain(
    set('a', b('asyncio_create_task', {}, { DO: chain(print('A start'), sleep(20), set('count', num(7)), print('A end'), b('asyncio_return', {}, { VALUE: num(42) })) })),
    set('b', b('asyncio_create_task', {}, { DO: chain(print('B start'), sleep(0, 'S'), print('B end')) })),
    print('main'), print(b('python_await_value', {}, { VALUE: get('a') })), b('python_await', {}, { VALUE: get('b') }),
  ) })]);
  assert.match(code, /async def _async_task\(\)/);
  assert.match(code, /async def _async_task_2\(\)/);
  assert.match(code, /global 次数/);
  assert.match(code, /return 42/);
  const output = python(asyncSetup + code + '\nassert 次数 == 7\n');
  assert.deepEqual(output.trim().split('\n'), ['main', 'A start', 'B start', 'B end', 'A end', '42']);
});

test('cancellation is a native request, with CancelledError propagated when awaited', () => {
  const code = generate([b('asyncio_run', {}, { DO: chain(
    set('a', b('asyncio_create_task', {}, { DO: sleep(1000) })), sleep(0),
    b('asyncio_cancel_task', {}, { TASK: get('a') }), b('python_await', {}, { VALUE: get('a') }),
  ) })]);
  assert.match(code, /任务甲.cancel\(\)/);
  python(asyncSetup + 'try:\n' + code.split('\n').map(line => '    ' + line).join('\n') + `
except asyncio.CancelledError: pass
else: raise AssertionError('cancellation was swallowed')
`);
});

test('async operations reject synchronous contexts, nested runs and missing tasks', () => {
  for (const type of ['asyncio_create_task', 'python_await', 'python_await_value', 'asyncio_return']) {
    assert.throws(() => generate([type === 'python_await_value' ? print(b(type)) : b(type)]), /inside an asynchronous/);
  }
  assert.throws(() => generate([b('asyncio_run', {}, { DO: b('asyncio_run') })]), /Do not nest/);
  for (const type of ['python_await', 'python_await_value', 'asyncio_cancel_task']) {
    assert.throws(() => generate([b('asyncio_run', {}, { DO: type === 'python_await_value' ? print(b(type)) : b(type) })]), /Connect an expression/);
  }
  // A native synchronous MQTT callback must not inherit its enclosing async context.
  const callback = b('mqtt_on_message', { TOPIC_VAR: { id: 'a' }, MESSAGE_VAR: { id: 'b' } }, { CLIENT: get('count'), DO: sleep(1) });
  assert.throws(() => generate([b('asyncio_run', {}, { DO: callback })]), /inside an asynchronous/);
  assert.throws(() => generate([b('procedures_defnoreturn', { NAME: '同步函数' }, { STACK: sleep(1) })]), /inside an asynchronous/);
  // Failed generation must not leak async context into the next workspace.
  assert.throws(() => generate([sleep(1)]), /inside an asynchronous/);
  assert.doesNotThrow(() => generate([b('asyncio_run', {}, { DO: sleep(0) })]));
});

test('new blocks are localized and generated/internal names stay protected', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    const entries = createToolbox().contents.flatMap(category => category.contents ?? []).filter(entry =>
      /^(ntptime_|asyncio_|timing_epoch_seconds|timing_datetime)/.test(entry.type));
    const workspace = new Blockly.Workspace();
    try { for (const entry of entries) assert.ok(!workspace.newBlock(entry.type).toString().includes('%{BKY_')); }
    finally { workspace.dispose(); }
    const code = generate([set('a', num(1)), b('ntptime_sync'), b('asyncio_run', {}, { DO: sleep(0) })], [{ id: 'a', name: '_asyncio' }]);
    assert.match(code, /_asyncio_2 = 1/);
  }
  applyLanguage('en');
});

test('NTP and async example compiles with startup synchronization before scheduling', () => {
  const project = JSON.parse(readFileSync(new URL('../examples/ntp-asyncio.blockly.json', import.meta.url), 'utf8'));
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(project.workspace, workspace);
    const code = pythonGenerator.workspaceToCode(workspace);
    assert.ok(code.indexOf('_ntptime.settime()') < code.indexOf('_asyncio.run('));
    assert.match(code, /await _asyncio.sleep_ms/);
    python(`compile(${JSON.stringify(code)}, '<example>', 'exec')`);
  } finally { workspace.dispose(); }
});
