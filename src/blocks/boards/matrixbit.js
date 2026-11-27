import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';
import { oledConfig } from '../../python/display.js';

const colour = 260;

// Matrix:bit follows the mPython board numbering, not raw ESP32 GPIO numbers.
// https://github.com/labplus-cn/mpython/blob/master/port/boards/mpython/modules/mpython.py
const boardPins = {
  0: 33, 1: 32, 2: 35, 3: 34, 4: 39, 5: 0, 6: 16, 7: 17,
  8: 26, 9: 25, 10: 36, 11: 2, 13: 18, 14: 19, 15: 21, 16: 5,
  19: 22, 20: 23, 23: 27, 24: 14, 25: 12, 26: 13, 27: 15, 28: 4,
};

// Mark shared onboard touch keys and A/B button pins in the mapping. Touch keys
// use generic TouchPad blocks; A/B buttons have a dedicated board block.
const pinNotes = Object.fromEntries([
  [5, `${blockMessage('pinButtonNote')} A`],
  [11, `${blockMessage('pinButtonNote')} B`],
  ...[...'PYTHON'].map((key, index) => [23 + index, `${blockMessage('pinTouchKeyNote')} ${key}`]),
]);

common.defineBlocksWithJsonArray([
  {
    type: 'matrixbit_pin_number', message0: blockMessage('matrixPinNumber'),
    args0: [{
      type: 'field_dropdown', name: 'PIN',
      options: Object.entries(boardPins).map(([pin, gpio]) => [
        `P${pin} → GPIO${gpio}${pinNotes[pin] ? ` (${pinNotes[pin]})` : ''}`, pin,
      ]),
    }],
    tooltip: blockMessage('matrixPinNumberHint'), output: 'Number', colour,
  },
  {
    type: 'matrixbit_button_is_pressed',
    message0: blockMessage('buttonIsPressed'),
    args0: [{ type: 'field_dropdown', name: 'BUTTON', options: [['A', 'a'], ['B', 'b']] }],
    tooltip: blockMessage('matrixButtonIsPressedHint'),
    output: 'Boolean',
    colour,
  },
  {
    type: 'matrixbit_neopixel', message0: blockMessage('matrixNeopixel'),
    tooltip: blockMessage('matrixNeopixelHint'), output: 'NeoPixel', colour,
  },
  {
    type: 'matrixbit_display_config', message0: blockMessage('matrixbitDisplayConfig'),
    tooltip: blockMessage('matrixbitDisplayConfigHint'), output: 'DisplayConfig', colour,
  },
]);

pythonGenerator.addReservedWords(
  '_matrixbit_pin,_matrixbit_button_a,_matrixbit_button_b,_matrixbit_leds,_matrixbit_neopixel',
);

const pinImport = 'from machine import Pin as _matrixbit_pin';

function preparePixels(generator) {
  generator.definitions_.import_matrixbit_pin = pinImport;
  generator.definitions_.import_matrixbit_neopixel = 'from neopixel import NeoPixel as _matrixbit_neopixel';
  generator.definitions_.matrixbit_leds = '_matrixbit_leds = _matrixbit_neopixel(_matrixbit_pin(17), 3)';
}

function pressedExpression(block, generator) {
  const button = block.getFieldValue('BUTTON');
  const pin = button === 'a' ? 0 : 2;
  const name = `_matrixbit_button_${button}`;
  generator.definitions_.import_matrixbit_pin = pinImport;
  generator.definitions_[name] = `${name} = _matrixbit_pin(${pin}, _matrixbit_pin.IN, _matrixbit_pin.PULL_UP)`;
  return `${name}.value() == 0`;
}

Object.assign(pythonGenerator.forBlock, {
  matrixbit_pin_number: block => [String(boardPins[block.getFieldValue('PIN')]), Order.ATOMIC],
  matrixbit_button_is_pressed: (block, generator) => [pressedExpression(block, generator), Order.RELATIONAL],
  matrixbit_neopixel: (_block, generator) => {
    preparePixels(generator);
    return ['_matrixbit_leds', Order.ATOMIC];
  },
  matrixbit_display_config: (_block, generator) => [oledConfig(generator, {
    width: '128', height: '64', i2c: '0', scl: '22', sda: '23', address: '60',
  }), Order.ATOMIC],
});
