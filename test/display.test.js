import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/hardware/display.js';

applyLanguage('en');
const number = NUM => ({block:{type:'math_number',fields:{NUM}}});
const text = TEXT => ({block:{type:'text',fields:{TEXT}}});
const oledConfig = (width=128,height=64) => ({type:'display_oled_config',inputs:{
  WIDTH:number(width),HEIGHT:number(height),I2C:number(0),SCL:number(22),SDA:number(23),ADDRESS:number(60),
}});
const st7735Config = (width=160,height=128,rotation='1') => ({type:'display_st7735_config',fields:{ROTATION:rotation},inputs:{
  WIDTH:number(width),HEIGHT:number(height),SPI:number(2),BAUD:number(20000000),
  SCK:number(18),MOSI:number(23),CS:number(5),DC:number(4),RES:number(19),
}});
function generate(...blocks) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks}},workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally { workspace.dispose(); }
}
function compile(code) {
  const result = spawnSync('python3', ['-c', `compile(${JSON.stringify(code)}, '<display>', 'exec')`], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
}

test('top-level Display separates setup, configuration and drawing blocks', () => {
  const display = createToolbox().contents.find(category => category.name === 'Display');
  assert.ok(display);
  assert.deepEqual(display.contents.filter(block => block.type).map(block => block.type), [
    'display_setup', 'display_oled_config', 'display_st7735_config',
    'display_text', 'display_pixel', 'display_clear', 'display_refresh',
  ]);
  for (const label of ['Display setup', 'Custom display configurations', 'Drawing']) {
    assert.ok(display.contents.some(block => block.kind === 'label' && block.text === label), label);
  }
});

test('OLED configuration initializes one shared display through the driver factory', () => {
  const code = generate(
    {type:'display_setup',inputs:{CONFIG:{block:oledConfig(128,64)}}},
    {type:'display_text',inputs:{TEXT:text('Hi'),X:number(4),Y:number(8),COLOR:number(1)}},
    {type:'display_pixel',inputs:{X:number(1),Y:number(2),COLOR:number(1)}},
    {type:'display_clear',inputs:{COLOR:number(0)}},
    {type:'display_refresh'},
  );
  assert.equal(code.match(/class _DisplayOLED/g)?.length, 1);
  assert.match(code, /def _display_create\(config\):/);
  assert.match(code, /_display = _display_create\(\{'type': 'oled', 'width': 128, 'height': 64, 'i2c': 0, 'scl': 22, 'sda': 23, 'address': 60\}\)/);
  assert.match(code, /_display\.text\(str\('Hi'\), int\(4\), int\(8\), int\(1\)\)/);
  assert.match(code, /_display\.pixel\(int\(1\), int\(2\), int\(1\)\)/);
  assert.match(code, /_display\.fill\(int\(0\)\)/);
  assert.match(code, /_display\.show\(\)/);
  compile(code);
});

test('ST7735 configuration initializes the driver with configurable wiring and orientation', () => {
  const code = generate(
    {type:'display_setup',inputs:{CONFIG:{block:st7735Config(160,128,'1')}}},
    {type:'display_text',inputs:{TEXT:text('Hello'),X:number(0),Y:number(0),COLOR:number(65535)}},
    {type:'display_refresh'},
  );
  assert.equal(code.match(/class _DisplayST7735/g)?.length, 1);
  assert.match(code, /_display = _display_create\(\{'type': 'st7735', 'width': 160, 'height': 128, 'spi': 2, 'baud': 20000000, 'sck': 18, 'mosi': 23, 'cs': 5, 'dc': 4, 'res': 19, 'rotation': 1\}\)/);
  assert.match(code, /self\.width = width\n        self\.height = height/);
  assert.match(code, /_display\.text\(str\('Hello'\), int\(0\), int\(0\), int\(65535\)\)/);
  assert.match(code, /_display\.show\(\)/);
  compile(code);
});

test('display configuration resolution is configurable', () => {
  const oled = generate({type:'display_setup',inputs:{CONFIG:{block:oledConfig(128,32)}}});
  assert.match(oled, /'width': 128, 'height': 32/);
  assert.match(oled, /bytearray\(width \* height \/\/ 8\)/);
  const tft = generate({type:'display_setup',inputs:{CONFIG:{block:st7735Config(128,160,'0')}}});
  assert.match(tft, /'width': 128, 'height': 160/);
  assert.match(tft, /'rotation': 0/);
  compile(oled);
  compile(tft);
});

test('display setup requires a configuration block', () => {
  assert.throws(() => generate({type:'display_setup'}), /display configuration/i);
});

test('display blocks generate in both languages', () => {
  for (const [language, name] of [['en', 'Display'], ['zh-CN', '显示']]) {
    applyLanguage(language);
    assert.doesNotThrow(() => generate({type:'display_oled_config'}));
    assert.doesNotThrow(() => generate({type:'display_st7735_config'}));
    assert.doesNotThrow(() => generate({type:'display_setup',inputs:{CONFIG:{block:oledConfig()}}}));
    assert.ok(createToolbox().contents.some(category => category.name === name));
  }
  applyLanguage('en');
});
