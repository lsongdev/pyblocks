import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/boards/microbit-radio.js';
import '../src/blocks/boards/microbit-microphone.js';
const number = NUM => ({ block: { type: 'math_number', fields: { NUM } } });
function generate(blocks) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks } }, workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally { workspace.dispose(); }
}
applyLanguage('en');

test('radio configuration, text and byte operations generate native calls', () => {
  const code = generate([
    { type: 'microbit_radio_config', inputs: { GROUP: number(17), CHANNEL: number(12), POWER: number(3) } },
    { type: 'microbit_radio_buffers', inputs: { LENGTH: number(64), QUEUE: number(5) } },
    { type: 'microbit_radio_send', inputs: { MESSAGE: { block: { type: 'text', fields: { TEXT: '你好' } } } } },
    { type: 'microbit_radio_send_bytes' },
    ...['receive', 'receive_bytes', 'receive_full'].map(method => ({ type: 'text_print', inputs: { TEXT: { block: { type: `microbit_radio_${method}` } } } })),
    { type: 'microbit_radio_reset' }, { type: 'microbit_radio_power', fields: { POWER: 'off' } },
  ]);
  assert.equal(code.match(/import radio as _microbit_radio/g)?.length, 1);
  assert.match(code, /config\(group=int\(17\), channel=int\(12\), power=int\(3\)\)/);
  assert.match(code, /config\(length=int\(64\), queue=int\(5\)\)/);
  assert.match(code, /send\('你好'\)/);
  assert.match(code, /send_bytes\(b''\)/);
  for (const method of ['receive', 'receive_bytes', 'receive_full']) {
    assert.equal(code.match(new RegExp(`_microbit_radio\\.${method}\\(\\)`, 'g'))?.length, 1);
    assert.ok(!code.includes(`${method}() or`));
  }
  assert.match(code, /_microbit_radio\.reset\(\)/);
  assert.match(code, /_microbit_radio\.off\(\)/);
  assert.ok(!code.includes('def '));
});

test('microphone queries retain native event and history semantics without extra reads', () => {
  const code = generate([
    { type: 'microbit_microphone_threshold', fields: { EVENT: 'QUIET' }, inputs: { VALUE: number(80) } },
    ...['level', 'current_event', 'events', 'is_event', 'was_event'].map(method => ({ type: 'text_print', inputs: { TEXT: { block: { type: `microbit_microphone_${method}`, ...(method.endsWith('is_event') || method === 'was_event' ? { fields: { EVENT: 'LOUD' } } : {}) } } } })),
  ]);
  assert.equal(code.match(/import microbit as _microbit/g)?.length, 1);
  assert.match(code, /set_threshold\(_microbit.SoundEvent.QUIET, int\(80\)\)/);
  for (const method of ['sound_level', 'current_event', 'get_events', 'is_event', 'was_event']) {
    assert.equal(code.match(new RegExp(`microphone\\.${method}\\(`, 'g'))?.length, 1);
  }
  assert.match(code, /is_event\(_microbit.SoundEvent.LOUD\)/);
  assert.match(code, /was_event\(_microbit.SoundEvent.LOUD\)/);
  assert.ok(!code.includes('def '));
});

test('radio and microphone toolbox blocks generate in both languages', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    const microbit = createToolbox().contents.find(item => item.name === 'Micro:bit');
    for (const category of microbit.contents) {
      for (const item of category.contents) {
        if (item.type?.startsWith('microbit_radio_') || item.type?.startsWith('microbit_microphone_') || item.type === 'microbit_sound_event') {
          const { kind, ...block } = item;
          assert.doesNotThrow(() => generate([block]), item.type);
        }
      }
    }
  }
  applyLanguage('en');
});
