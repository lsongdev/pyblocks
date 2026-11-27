import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/hardware/touch.js';

applyLanguage('en');
const number = NUM => ({block:{type:'math_number',fields:{NUM}}});
function generate(block) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:[block]}},workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally { workspace.dispose(); }
}

test('generic TouchPad blocks are grouped under top-level Pins > Touch keys', () => {
  const pins = createToolbox().contents.find(category => category.name === 'Pins');
  const label = pins.contents.findIndex(item => item.kind === 'label' && item.text === 'Touch keys');
  assert.ok(label >= 0);
  assert.deepEqual(
    pins.contents.slice(label + 1).filter(item => item.type).map(item => item.type),
    ['touchpad_read', 'touchpad_is_touched'],
  );
});

test('TouchPad blocks call machine.TouchPad directly with an explicit pin and threshold', () => {
  const read = generate({type:'touchpad_read',inputs:{PIN:number(27)}});
  assert.match(read, /from machine import Pin as _touchpad_pin/);
  assert.match(read, /from machine import TouchPad as _touchpad_type/);
  assert.match(read, /_touchpad_type\(_touchpad_pin\(27\)\)\.read\(\)/);

  const touched = generate({type:'touchpad_is_touched',inputs:{PIN:number(27),THRESHOLD:number(400)}});
  assert.match(touched, /_touchpad_type\(_touchpad_pin\(27\)\)\.read\(\) < int\(400\)/);
  assert.ok(!touched.includes('def '));
  assert.ok(!/sleep|debounce|irq/.test(touched));
});

test('TouchPad blocks generate in both languages', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    for (const type of ['touchpad_read', 'touchpad_is_touched']) {
      assert.doesNotThrow(() => generate({type}));
    }
    assert.ok(createToolbox().contents
      .find(category => category.name === (language === 'en' ? 'Pins' : '引脚'))
      .contents.some(item => item.kind === 'label' && item.text === (language === 'en' ? 'Touch keys' : '触摸键')));
  }
  applyLanguage('en');
});
