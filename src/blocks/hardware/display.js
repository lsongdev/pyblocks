import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';
import { oledConfig, st7735Config, prepareDisplayFactory } from '../../python/display.js';

const colour = 155;
const statement = { previousStatement: null, nextStatement: null, colour };
const number = name => ({ type: 'input_value', name, check: 'Number' });
const config = { type: 'input_value', name: 'CONFIG', check: 'DisplayConfig' };
const value = (block, generator, name, fallback) =>
  generator.valueToCode(block, name, Order.NONE) || fallback;

const rotationField = {
  type: 'field_dropdown', name: 'ROTATION', options: [
    [blockMessage('displayLandscape'), '1'],
    [blockMessage('displayPortrait'), '0'],
    [blockMessage('displayLandscapeFlip'), '3'],
    [blockMessage('displayPortraitFlip'), '2'],
  ],
};

common.defineBlocksWithJsonArray([
  {
    type: 'display_setup',
    message0: blockMessage('displayInitialize'),
    args0: [config],
    tooltip: blockMessage('displayInitializeHint'),
    ...statement,
  },
  {
    type: 'display_oled_config',
    message0: blockMessage('displayOledSetup'),
    message1: blockMessage('displayOledSize'), args1: [number('WIDTH'), number('HEIGHT')],
    message2: blockMessage('displayOledBus'), args2: [number('I2C'), number('SCL'), number('SDA'), number('ADDRESS')],
    tooltip: blockMessage('displayOledSetupHint'),
    output: 'DisplayConfig',
    colour,
  },
  {
    type: 'display_st7735_config',
    message0: blockMessage('displaySt7735Setup'),
    message1: blockMessage('displaySt7735Size'), args1: [number('WIDTH'), number('HEIGHT')],
    message2: blockMessage('displaySt7735Rotation'), args2: [rotationField],
    message3: blockMessage('displaySt7735Bus'), args3: [number('SPI'), number('BAUD')],
    message4: blockMessage('displaySt7735Data'), args4: [number('SCK'), number('MOSI')],
    message5: blockMessage('displaySt7735Select'), args5: [number('CS'), number('DC')],
    message6: blockMessage('displaySt7735Reset'), args6: [number('RES')],
    tooltip: blockMessage('displaySt7735SetupHint'),
    output: 'DisplayConfig',
    colour,
  },
  {
    type: 'display_text',
    message0: blockMessage('displayText'),
    args0: [
      { type: 'input_value', name: 'TEXT', check: 'String' },
      number('X'), number('Y'), number('COLOR'),
    ],
    tooltip: blockMessage('displayTextHint'),
    inputsInline: true,
    ...statement,
  },
  {
    type: 'display_pixel',
    message0: blockMessage('displayPixel'),
    args0: [number('X'), number('Y'), number('COLOR')],
    tooltip: blockMessage('displayPixelHint'),
    inputsInline: true,
    ...statement,
  },
  {
    type: 'display_clear',
    message0: blockMessage('displayClear'),
    args0: [number('COLOR')],
    tooltip: blockMessage('displayClearHint'),
    ...statement,
  },
  {
    type: 'display_refresh',
    message0: blockMessage('displayShow'),
    tooltip: blockMessage('displayShowHint'),
    ...statement,
  },
]);

function requiredConfig(block, generator) {
  const code = generator.valueToCode(block, 'CONFIG', Order.NONE);
  if (!code) throw new PythonBlockError(t('displayConfigRequired'));
  return code;
}

Object.assign(pythonGenerator.forBlock, {
  display_setup: (block, generator) => {
    const code = requiredConfig(block, generator);
    prepareDisplayFactory(generator);
    return `_display = _display_create(${code})\n_display.fill(0)\n_display.show()\n`;
  },
  display_oled_config: (block, generator) => {
    const values = Object.fromEntries([
      ['width', 'WIDTH', '128'], ['height', 'HEIGHT', '64'], ['i2c', 'I2C', '0'],
      ['scl', 'SCL', '22'], ['sda', 'SDA', '23'], ['address', 'ADDRESS', '60'],
    ].map(([key, name, fallback]) => [key, value(block, generator, name, fallback)]));
    return [oledConfig(generator, values), Order.ATOMIC];
  },
  display_st7735_config: (block, generator) => {
    const values = Object.fromEntries([
      ['width', 'WIDTH', '160'], ['height', 'HEIGHT', '128'],
      ['spi', 'SPI', '2'], ['baud', 'BAUD', '20000000'], ['sck', 'SCK', '18'],
      ['mosi', 'MOSI', '23'], ['cs', 'CS', '5'], ['dc', 'DC', '4'], ['res', 'RES', '19'],
    ].map(([key, name, fallback]) => [key, value(block, generator, name, fallback)]));
    values.rotation = block.getFieldValue('ROTATION');
    return [st7735Config(generator, values), Order.ATOMIC];
  },
  display_text: (block, generator) => {
    const text = value(block, generator, 'TEXT', "''");
    const [x, y, color] = ['X', 'Y', 'COLOR'].map(name => value(block, generator, name, name === 'COLOR' ? '65535' : '0'));
    return `_display.text(str(${text}), int(${x}), int(${y}), int(${color}))\n`;
  },
  display_pixel: (block, generator) => {
    const [x, y, color] = ['X', 'Y', 'COLOR'].map(name => value(block, generator, name, name === 'COLOR' ? '65535' : '0'));
    return `_display.pixel(int(${x}), int(${y}), int(${color}))\n`;
  },
  display_clear: (block, generator) =>
    `_display.fill(int(${value(block, generator, 'COLOR', '0')}))\n`,
  display_refresh: () => '_display.show()\n',
});
