import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/boards/pico.js';
import '../src/blocks/hardware/adc.js';

function generate(block) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [block] } }, workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally { workspace.dispose(); }
}
applyLanguage('en');

test('Pico LED generates native on/off calls in both languages', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    for (const power of ['on', 'off']) {
      const code = generate({ type: 'pico_led_power', fields: { POWER: power } });
      assert.match(code, /from machine import Pin as _pico_pin/);
      assert.ok(code.includes(`_pico_pin('LED', _pico_pin.OUT).${power}()`));
    }
  }
  applyLanguage('en');
});

test('Pico GP labels provide GPIO numbers to generic analog input', () => {
  const code = generate({ type: 'adc_read_pin', inputs: { PIN: { block: { type: 'pico_pin_number', fields: { PIN: '26' } } } } });
  assert.match(code, /_adc_type\(_adc_pin\(26\)\).read_u16\(\)/);
  const workspace = new Blockly.Workspace();
  try {
    const options = workspace.newBlock('pico_pin_number').getField('PIN').getOptions();
    assert.equal(options.length, 26);
    assert.deepEqual(options.find(([, value]) => value === '26'), ['GP26 · #31', '26']);
    for (const pin of ['23', '24', '25', '29']) assert.ok(!options.some(([, value]) => value === pin));
  } finally { workspace.dispose(); }
});

test('Pico temperature uses the internal ADC channel and inline calibration', () => {
  const code = generate({ type: 'text_print', inputs: { TEXT: { block: { type: 'pico_temperature' } } } });
  assert.match(code, /_pico_adc\(4\).read_u16\(\)/);
  assert.match(code, /print\(27 - .*0.706.*0.001721\)/);
  assert.ok(!code.includes('def '));
  const group = createToolbox().contents.find(item => item.name === 'Pico');
  assert.deepEqual(group.contents.filter(block => block.kind === 'block').map(block => block.type), ['pico_led_power', 'pico_pin_number', 'pico_temperature']);
});
