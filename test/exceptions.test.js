import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import '../src/blocks/index.js';
applyLanguage('en');
const b = (type, fields = {}, values = {}) => ({ type, fields, inputs: Object.fromEntries(Object.entries(values).map(([name, block]) => [name, { block }])) });
const text = TEXT => b('text', { TEXT });
const print = message => b('text_print', {}, { TEXT: typeof message === 'string' ? text(message) : message });
const raise = (TYPE = 'ValueError') => b('exception_raise', { TYPE }, { MESSAGE: text('错误') });
const handler = (TYPE, DO) => b('exception_catch', { TYPE, VAR: { id: 'error' } }, { DO });
function chain(...blocks) {
  for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
  return blocks[0];
}
function generate(block) {
  const w = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({ variables: [{ id: 'error', name: '错误信息' }], blocks: { languageVersion: 0, blocks: [block] } }, w);
    return pythonGenerator.workspaceToCode(w);
  } finally { w.dispose(); }
}
function python(code) {
  const result = spawnSync('python3', ['-c', code], { encoding: 'utf8', input: '你好\n', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}

test('handlers match in order, else only follows success, and finally always runs', () => {
  const code = generate(b('exception_try', {}, { DO: raise(), HANDLERS: chain(handler('OSError', print('wrong')),
    handler('ValueError', print(b('exception_text', {}, { ERROR: b('variables_get', { VAR: { id: 'error' } }) })))),
    ELSE: print('else'), FINALLY: print('finally') }));
  assert.deepEqual(python(code).trim().split('\n'), ['错误', 'finally']);
  const success = generate(b('exception_try', {}, { DO: print('try'), HANDLERS: handler('Exception', print('wrong')), ELSE: print('else'), FINALLY: print('finally') }));
  assert.deepEqual(python(success).trim().split('\n'), ['try', 'else', 'finally']);
});

test('finally runs on propagation and re-raise preserves the original exception', () => {
  const inner = b('exception_try', {}, { DO: raise(), HANDLERS: handler('ValueError', b('exception_reraise')), FINALLY: print('cleanup') });
  const outer = b('exception_try', {}, { DO: inner, HANDLERS: handler('ValueError', print('caught')) });
  assert.deepEqual(python(generate(outer)).trim().split('\n'), ['cleanup', 'caught']);
  assert.equal(python(generate(b('exception_try', {}, { DO: print('ok'), FINALLY: print('done') }))), 'ok\ndone\n');
});

test('async cancellation can be caught explicitly and finally cleans up', () => {
  const block = b('asyncio_run', {}, { DO: b('exception_try', {}, {
    DO: raise('asyncio.CancelledError'), HANDLERS: handler('asyncio.CancelledError', print('cancelled')), FINALLY: print('cleanup'),
  }) });
  const code = generate(block);
  assert.match(code, /import asyncio as _exception_asyncio/);
  assert.equal(python(code), 'cancelled\ncleanup\n');
});

test('invalid try/re-raise structures fail generation, including nested function boundaries', () => {
  assert.throws(() => generate(b('exception_try')), /catch clause or finally/);
  assert.throws(() => generate(b('exception_try', {}, { DO: print('x'), ELSE: print('x'), FINALLY: print('y') })), /catch clause/);
  assert.throws(() => generate(b('exception_reraise')), /same function/);
  const nested = b('asyncio_run', {}, { DO: b('exception_reraise') });
  assert.throws(() => generate(b('exception_try', {}, { DO: raise(), HANDLERS: handler('Exception', nested) })), /same function/);
  assert.throws(() => generate(b('exception_reraise')), /same function/);
});

test('serial input block calls native input and returns Unicode text without a newline', () => {
  const code = generate(print(b('text_input', {}, { PROMPT: text('> ') })));
  assert.match(code, /input\('> '\)/);
  assert.equal(python(code), '> 你好\n');
});

test('exception and input blocks instantiate in both languages', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    const w = new Blockly.Workspace();
    try {
      for (const type of ['exception_try', 'exception_catch', 'exception_raise', 'exception_reraise', 'exception_text', 'text_input']) {
        assert.ok(!w.newBlock(type).toString().includes('%{BKY_'));
      }
    } finally { w.dispose(); }
  }
  applyLanguage('en');
});

test('serial input example compiles and uses native exception branches', () => {
  const project = JSON.parse(readFileSync(new URL('../examples/serial-input-exceptions.blockly.json', import.meta.url), 'utf8'));
  const w = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(project.workspace, w);
    const code = pythonGenerator.workspaceToCode(w);
    assert.match(code, /input\('Integer> '\)/);
    assert.match(code, /except ValueError as 异常:/);
    assert.match(code, /finally:/);
    python(`compile(${JSON.stringify(code)}, '<example>', 'exec')`);
  } finally { w.dispose(); }
});
