import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';

const pin = { type: 'input_value', name: 'PIN', check: ['Number', 'String'] };
const threshold = { type: 'input_value', name: 'THRESHOLD', check: 'Number' };
const colour = 155;

common.defineBlocksWithJsonArray([
  {
    type: 'touchpad_read', message0: blockMessage('touchpadRead'), args0: [pin],
    tooltip: blockMessage('touchpadReadHint'), output: 'Number', colour,
  },
  {
    type: 'touchpad_is_touched', message0: blockMessage('touchpadIsTouched'), args0: [pin, threshold],
    tooltip: blockMessage('touchpadIsTouchedHint'), inputsInline: true, output: 'Boolean', colour,
  },
]);

pythonGenerator.addReservedWords('_touchpad_pin,_touchpad_type');

function read(block, generator) {
  generator.definitions_.import_touchpad_pin = 'from machine import Pin as _touchpad_pin';
  generator.definitions_.import_touchpad_type = 'from machine import TouchPad as _touchpad_type';
  const pinId = generator.valueToCode(block, 'PIN', Order.NONE) || '0';
  return `_touchpad_type(_touchpad_pin(${pinId})).read()`;
}

Object.assign(pythonGenerator.forBlock, {
  touchpad_read: (block, generator) => [read(block, generator), Order.FUNCTION_CALL],
  touchpad_is_touched: (block, generator) => {
    const limit = generator.valueToCode(block, 'THRESHOLD', Order.NONE) || '400';
    return [`${read(block, generator)} < int(${limit})`, Order.RELATIONAL];
  },
});
