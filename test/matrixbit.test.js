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

test('Matrixbit Pins provides a preconfigured NeoPixel strip for generic pixel blocks', () => {
  const pins = createToolbox().contents
    .find(category => category.name === 'Matrix:bit').contents
    .find(category => category.name === 'Pins');
  assert.ok(pins.contents.some(block => block.type === 'matrixbit_pin_number'));
  assert.ok(pins.contents.some(block => block.type === 'matrixbit_button_is_pressed'));
  assert.ok(pins.contents.some(block => block.type === 'matrixbit_neopixel'));

  const strip = () => ({block:{type:'matrixbit_neopixel'}});
  const code = generate(
    {type:'neopixel_set', inputs:{
      PIXELS:strip(), INDEX:number(1), RED:number(10), GREEN:number(20), BLUE:number(30),
    }},
    {type:'neopixel_write', inputs:{PIXELS:strip()}},
  );
  assert.match(code, /from neopixel import NeoPixel as _matrixbit_neopixel/);
  assert.match(code, /_matrixbit_leds = _matrixbit_neopixel\(_matrixbit_pin\(17\), 3\)/);
  assert.match(code, /_matrixbit_leds\[1\] = \(10, 20, 30\)/);
  assert.match(code, /_matrixbit_leds\.write\(\)/);
  assert.equal(code.match(/_matrixbit_leds = /g).length, 1);
});

test('Matrixbit no longer exposes the separate RGB light category', () => {
  const matrixbit = createToolbox().contents.find(category => category.name === 'Matrix:bit');
  assert.ok(!matrixbit.contents.some(category => category.name === 'RGB' || category.name === '彩灯'));
  assert.ok(!matrixbit.contents.some(category =>
    category.contents?.some(block => block.type === 'matrixbit_rgb_set')));
  assert.equal(Blockly.Blocks.matrixbit_rgb_set, undefined);
});

test('Matrixbit A/B button lives in Pins without a separate Buttons group', () => {
  const matrixbit = createToolbox().contents.find(category => category.name === 'Matrix:bit');
  assert.ok(!matrixbit.contents.some(category => category.name === 'Buttons' || category.name === '按键'));
  const pins = matrixbit.contents.find(category => category.name === 'Pins');
  assert.deepEqual(pins.contents.filter(block => block.type).map(block => block.type), [
    'matrixbit_pin_number', 'matrixbit_button_is_pressed', 'matrixbit_neopixel',
  ]);
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
