import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';

common.defineBlocksWithJsonArray([
  { type: 'text_input', message0: blockMessage('textInput'),
    args0: [{ type: 'input_value', name: 'PROMPT', check: 'String' }], output: 'String', colour: 160,
    tooltip: blockMessage('textInputHint') },
]);
pythonGenerator.forBlock.text_input = (block, generator) => [
  `input(${generator.valueToCode(block, 'PROMPT', Order.NONE) || "''"})`, Order.FUNCTION_CALL,
];
