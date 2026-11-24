import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/hardware/adc.js';
import '../src/blocks/boards/matrixbit.js';
applyLanguage('en');

function generate(state) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(state, workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally {workspace.dispose();}
}
const state = block => ({blocks:{languageVersion:0,blocks:[block]}});

test('ADC constructor and read methods are grouped with pin capabilities', () => {
  const toolbox = createToolbox();
  assert.ok(!toolbox.contents.some(category=>category.name==='ADC'));
  const pins = toolbox.contents.find(category=>category.contents?.some(block=>block.type==='gpio_set_pull'));
  assert.deepEqual(pins.contents.filter(block=>block.type?.startsWith('adc_')).map(block=>block.type),['adc_read_pin']);
  const code = generate(state({type:'adc_read_pin',inputs:{PIN:{block:{type:'matrixbit_pin_number',fields:{PIN:'0'}}}}}));
  assert.match(code, /_adc_type\(_adc_pin\(33\)\).read_u16\(\)/);
  assert.ok(!code.includes('PWM'));
  assert.ok(!code.includes('def '));
});

test('analog pin reads generate directly in both languages', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    assert.match(generate(state({type:'adc_read_pin'})), /_adc_type\(_adc_pin\(0\)\).read_u16\(\)/);
  }
  applyLanguage('en');
});
