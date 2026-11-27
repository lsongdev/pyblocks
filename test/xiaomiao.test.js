import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/boards/xiaomiao.js';

applyLanguage('en');
function generate(block) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:[block]}},workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally { workspace.dispose(); }
}

test('XiaoMiao button block uses the correct pins and pull configuration', () => {
  const expected = {
    up: [2, '_xiaomiao_pin.PULL_UP'], down: [13, '_xiaomiao_pin.PULL_UP'],
    left: [27, '_xiaomiao_pin.PULL_UP'], right: [35, null],
    a: [34, null], b: [12, '_xiaomiao_pin.PULL_UP'],
  };
  for (const [BUTTON, [pin, pull]] of Object.entries(expected)) {
    const code = generate({type:'xiaomiao_button_is_pressed',fields:{BUTTON}});
    const name = `_xiaomiao_button_${BUTTON}`;
    assert.ok(code.includes(`${name} = _xiaomiao_pin(${pin}, _xiaomiao_pin.IN${pull ? `, ${pull}` : ''})`));
    assert.ok(code.includes(`${name}.value() == 0`));
  }
});

test('XiaoMiao opens directly to its button block without submenus', () => {
  const group = createToolbox().contents.find(category => category.name === 'XiaoMiao');
  assert.equal(group.kind, 'iconCategory');
  assert.deepEqual(group.contents.filter(block => block.type).map(block => block.type), [
    'xiaomiao_display_config', 'xiaomiao_button_is_pressed',
  ]);
  assert.ok(!group.contents.some(item => item.contents));
});

test('XiaoMiao preset display configuration targets the onboard ST7735', () => {
  const code = generate({type:'xiaomiao_display_config'});
  assert.match(code, /class _DisplayST7735/);
  assert.match(code, /\{'type': 'st7735', 'width': 160, 'height': 128, 'spi': 2, 'baud': 20000000, 'sck': 18, 'mosi': 23, 'cs': 5, 'dc': 4, 'res': 19, 'rotation': 1\}/);
});

test('XiaoMiao button block generates in both languages', () => {
  for (const [language, name] of [['en', 'XiaoMiao'], ['zh-CN', '小喵掌机']]) {
    applyLanguage(language);
    assert.doesNotThrow(() => generate({type:'xiaomiao_button_is_pressed'}));
    assert.ok(createToolbox().contents.some(category => category.name === name));
  }
  applyLanguage('en');
});
