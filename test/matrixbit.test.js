import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/boards/matrixbit.js';
import '../src/blocks/hardware/gpio.js';
import '../src/blocks/hardware/pwm.js';
import '../src/blocks/hardware/buses.js';

applyLanguage('en');
function generate(...blocks) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({blocks: {languageVersion: 0, blocks}}, workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally { workspace.dispose(); }
}
const number = NUM => ({block: {type: 'math_number', fields: {NUM}}});

test('Microbit image blocks are available in Display without a separate Images category', () => {
  const microbit = createToolbox().contents.find(category => category.name === 'Micro:bit');
  assert.ok(!microbit.contents.some(category => category.name === 'Images'));
  const display = microbit.contents.find(category => category.name === 'Display');
  for (const type of ['microbit_image_builtin', 'microbit_image_custom', 'microbit_image_transform', 'microbit_image_shift', 'microbit_show']) {
    assert.ok(display.contents.some(block => block.type === type), type);
  }
});

test('PYTHON pads map to the six ESP32 touch pins and compare adjustable thresholds', () => {
  for (const [PAD, pin] of Object.entries({P:27, Y:14, T:12, H:13, O:15, N:4})) {
    const code = generate({type:'matrixbit_touch_is_touched', fields:{PAD}, inputs:{THRESHOLD:number(250)}});
    assert.ok(code.includes(`_matrixbit_touch_${PAD} = _matrixbit_touchpad(_matrixbit_pin(${pin}))`));
    assert.ok(code.includes(`_matrixbit_touch_${PAD}.read() < int(250)`));
  }
});

test('same pad events retain independent thresholds while sharing a TouchPad instance', () => {
  const event = threshold => ({type:'matrixbit_on_touch', fields:{PAD:'P'}, inputs:{THRESHOLD:number(threshold)}});
  const code = generate(event(200), event(400));
  const sources = [...code.matchAll(/setdefault\('([^']+)'/g)].map(match => match[1]);
  assert.equal(new Set(sources).size, 2);
  assert.equal(code.match(/= _matrixbit_touchpad\(/g).length, 1);
  assert.match(code, /read\(\) < int\(200\), 25/);
  assert.match(code, /read\(\) < int\(400\), 25/);
});

test('new Matrixbit controls generate in both languages', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    for (const type of ['matrixbit_pin_number', 'matrixbit_touch_read', 'matrixbit_touch_is_touched', 'matrixbit_on_touch']) {
      assert.doesNotThrow(() => generate({type}));
    }
  }
  applyLanguage('en');
});

test('Matrixbit board pin numbers plug into generic GPIO, PWM and UART inputs', () => {
  const pin = PIN => ({block:{type:'matrixbit_pin_number',fields:{PIN}}});
  const gpio = generate({type:'gpio_write_digital',inputs:{PIN:pin('0')}});
  assert.match(gpio, /_gpio_pin\(33, _gpio_pin.OUT, value=0\)/);
  const buzzer = generate({type:'buzzer_tone',inputs:{PIN:pin('6'),FREQ:number(440),DURATION:number(100)}});
  assert.match(buzzer, /_buzzer_tone\(16, 440, 100\)/);
  const uart = generate({type:'uart_create',inputs:{ID:number(1),TX:pin('13'),RX:pin('14'),BAUD:number(9600),TIMEOUT:number(100)}});
  assert.match(uart, /tx=_bus_pin\(18\), rx=_bus_pin\(19\)/);
  assert.ok(!uart.includes('import microbit'));
});

test('Matrixbit pin selector excludes reserved board numbers', () => {
  const workspace = new Blockly.Workspace();
  try {
    const block = workspace.newBlock('matrixbit_pin_number');
    const values = block.getField('PIN').getOptions(false).map(([,value])=>value);
    assert.ok(values.includes('0'));
    for (const reserved of ['12','17','18','21','22']) assert.ok(!values.includes(reserved));
  } finally {workspace.dispose();}
});

test('UART category and messages use the Chinese serial-port translation', () => {
  applyLanguage('zh-CN');
  try {
    assert.ok(createToolbox().contents.some(category=>category.name==='串口'));
    const workspace = new Blockly.Workspace();
    try {
      const block = workspace.newBlock('uart_create');
      assert.match(block.toString(), /^串口 端口/);
    } finally {workspace.dispose();}
  } finally {applyLanguage('en');}
});
