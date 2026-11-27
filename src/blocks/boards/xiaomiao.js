import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';
import { st7735Config } from '../../python/display.js';

const colour = 200;

const buttonPins = {
  up: [2, '_xiaomiao_pin.PULL_UP'],
  down: [13, '_xiaomiao_pin.PULL_UP'],
  left: [27, '_xiaomiao_pin.PULL_UP'],
  right: [35, null],
  a: [34, null],
  b: [12, '_xiaomiao_pin.PULL_UP'],
};

common.defineBlocksWithJsonArray([
  {
    type: 'xiaomiao_button_is_pressed',
    message0: blockMessage('xiaomiaoButton'),
    args0: [{
      type: 'field_dropdown', name: 'BUTTON',
      options: [['↑', 'up'], ['↓', 'down'], ['←', 'left'], ['→', 'right'], ['A', 'a'], ['B', 'b']],
    }],
    tooltip: blockMessage('xiaomiaoButtonHint'),
    output: 'Boolean',
    colour,
  },
  {
    type: 'xiaomiao_display_config', message0: blockMessage('xiaomiaoDisplayConfig'),
    tooltip: blockMessage('xiaomiaoDisplayConfigHint'), output: 'DisplayConfig', colour,
  },
]);

pythonGenerator.addReservedWords(
  `_xiaomiao_pin,${Object.keys(buttonPins).map(key => `_xiaomiao_button_${key}`).join(',')}`,
);

function pressedExpression(block, generator) {
  const key = block.getFieldValue('BUTTON');
  const [pin, pull] = buttonPins[key];
  const name = `_xiaomiao_button_${key}`;
  generator.definitions_.import_xiaomiao_pin = 'from machine import Pin as _xiaomiao_pin';
  generator.definitions_[name] = `${name} = _xiaomiao_pin(${pin}, _xiaomiao_pin.IN${pull ? `, ${pull}` : ''})`;
  return `${name}.value() == 0`;
}

pythonGenerator.forBlock.xiaomiao_button_is_pressed =
  (block, generator) => [pressedExpression(block, generator), Order.RELATIONAL];
pythonGenerator.forBlock.xiaomiao_display_config = (_block, generator) => [st7735Config(generator, {
  width: '160', height: '128', spi: '2', baud: '20000000', sck: '18',
  mosi: '23', cs: '5', dc: '4', res: '19', rotation: '1',
}), Order.ATOMIC];
