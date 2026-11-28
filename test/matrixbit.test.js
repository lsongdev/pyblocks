import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/boards/matrixbit.js';
import '../src/blocks/shared/condition-events.js';
import '../src/blocks/hardware/gpio.js';
import '../src/blocks/hardware/touch.js';
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

test('Matrixbit pin mapping annotates touch keys and A/B buttons', () => {
  for (const [language, buttonA, buttonB, touchP, touchN] of [
    ['en', 'P5 → GPIO0 (button A)', 'P11 → GPIO2 (button B)', 'P23 → GPIO27 (touch key P)', 'P28 → GPIO4 (touch key N)'],
    ['zh-CN', 'P5 → GPIO0 (按键 A)', 'P11 → GPIO2 (按键 B)', 'P23 → GPIO27 (触摸键 P)', 'P28 → GPIO4 (触摸键 N)'],
  ]) {
    applyLanguage(language);
    const workspace = new Blockly.Workspace();
    try {
      const options = workspace.newBlock('matrixbit_pin_number').getField('PIN').getOptions(false);
      const labels = Object.fromEntries(options.map(([label, value]) => [value, label]));
      assert.equal(labels['0'], 'P0 → GPIO33');
      assert.equal(labels['5'], buttonA);
      assert.equal(labels['11'], buttonB);
      assert.equal(labels['23'], touchP);
      assert.equal(labels['28'], touchN);
    } finally { workspace.dispose(); }
  }
  applyLanguage('en');
  for (const old of [
    'matrixbit_touch_pin', 'matrixbit_touch_read', 'matrixbit_touch_is_touched',
  ]) assert.equal(Blockly.Blocks[old], undefined);
});

test('Matrixbit A/B button block reads active-low pins with pull-up', () => {
  for (const [BUTTON, pin, name] of [['a', 0, '_matrixbit_button_a'], ['b', 2, '_matrixbit_button_b']]) {
    const code = generate({type:'matrixbit_button_is_pressed',fields:{BUTTON}});
    assert.ok(code.includes(`${name} = _matrixbit_pin(${pin}, _matrixbit_pin.IN, _matrixbit_pin.PULL_UP)`));
    assert.ok(code.includes(`${name}.value() == 0`));
  }
});

test('Matrixbit touch and button pins work through generic TouchPad and GPIO blocks', () => {
  const pin = PIN => ({block:{type:'matrixbit_pin_number',fields:{PIN}}});
  const touch = generate({type:'touchpad_read', inputs:{PIN:pin('23')}});
  assert.ok(touch.includes('_touchpad_type(_touchpad_pin(27)).read()'));
  const button = generate({type:'gpio_read_digital', fields:{PULL:'UP'}, inputs:{PIN:pin('5')}});
  assert.match(button, /_gpio_pin\(0, _gpio_pin.IN, pull=_gpio_pin.PULL_UP\)\.value\(\)/);
});

test('same touch key events keep independent thresholds through the pin mapping', () => {
  const event = threshold => ({type:'events_when', fields:{STABLE:25}, inputs:{
    CONDITION:{block:{type:'touchpad_is_touched',inputs:{
      PIN:{block:{type:'matrixbit_pin_number',fields:{PIN:'23'}}}, THRESHOLD:number(threshold),
    }}},
  }});
  const code = generate(event(200), event(400));
  assert.match(code, /_touchpad_type\(_touchpad_pin\(27\)\)\.read\(\) < int\(200\), 25/);
  assert.match(code, /_touchpad_type\(_touchpad_pin\(27\)\)\.read\(\) < int\(400\), 25/);
});

test('new Matrixbit controls generate in both languages', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    for (const type of ['matrixbit_pin_number', 'matrixbit_button_is_pressed', 'matrixbit_neopixel']) {
      assert.doesNotThrow(() => generate({type}));
    }
  }
  applyLanguage('en');
});

test('Matrixbit opens directly to its pin and NeoPixel blocks', () => {
  const matrixbit = createToolbox().contents.find(category => category.name === 'Matrix:bit');
  assert.equal(matrixbit.kind, 'iconCategory');
  assert.ok(matrixbit.contents.some(block => block.type === 'matrixbit_display_config'));
  assert.ok(matrixbit.contents.some(block => block.type === 'matrixbit_pin_number'));
  assert.ok(matrixbit.contents.some(block => block.type === 'matrixbit_button_is_pressed'));
  assert.ok(matrixbit.contents.some(block => block.type === 'matrixbit_neopixel'));

  const variable = { name: 'leds', id: 'leds' };
  const strip = () => ({ block: { type: 'variables_get', fields: { VAR: variable } } });
  const code = generate({
    type: 'variables_set',
    fields: { VAR: variable },
    inputs: { VALUE: { block: { type: 'matrixbit_neopixel' } } },
    next: { block: {
      type: 'neopixel_set',
      inputs: { PIXELS: strip(), INDEX: number(1), RED: number(10), GREEN: number(20), BLUE: number(30) },
      next: { block: { type: 'neopixel_write', inputs: { PIXELS: strip() } } },
    } },
  });
  assert.match(code, /^from machine import Pin$/m);
  assert.match(code, /^from neopixel import NeoPixel$/m);
  assert.match(code, /leds = NeoPixel\(Pin\(17\), 3\)/);
  assert.match(code, /leds\[1\] = \(10, 20, 30\)/);
  assert.match(code, /leds\.write\(\)/);
  assert.equal(code.match(/NeoPixel\(Pin\(17\), 3\)/g).length, 1);
  assert.match(generate({ type: 'matrixbit_neopixel' }), /^NeoPixel\(Pin\(17\), 3\)$/m);
});

test('Matrixbit flyout has no submenu categories or removed RGB blocks', () => {
  const matrixbit = createToolbox().contents.find(category => category.name === 'Matrix:bit');
  assert.ok(!matrixbit.contents.some(item => item.contents));
  assert.deepEqual(matrixbit.contents.filter(block => block.type).map(block => block.type), [
    'matrixbit_display_config', 'matrixbit_pin_number', 'matrixbit_button_is_pressed', 'matrixbit_neopixel',
  ]);
  assert.ok(!matrixbit.contents.some(block => block.type === 'matrixbit_rgb_set'));
  assert.equal(Blockly.Blocks.matrixbit_rgb_set, undefined);
});

test('Matrixbit preset display configuration targets the onboard OLED', () => {
  const code = generate({type:'matrixbit_display_config'});
  assert.match(code, /class _DisplayOLED/);
  assert.match(code, /\{'type': 'oled', 'width': 128, 'height': 64, 'i2c': 0, 'scl': 22, 'sda': 23, 'address': 60\}/);
});

test('Matrixbit display blocks moved to the top-level Display category', () => {
  for (const old of ['matrixbit_oled_text', 'matrixbit_oled_pixel', 'matrixbit_oled_clear', 'matrixbit_oled_flush']) {
    assert.equal(Blockly.Blocks[old], undefined);
  }
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
