import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';

common.defineBlocksWithJsonArray([
  {
    type: 'adc_read_pin', message0: blockMessage('adcReadPin'),
    args0: [{ type: 'input_value', name: 'PIN', check: ['Number', 'String'] }],
    tooltip: blockMessage('adcReadHint'), output: 'Number', colour: 155,
  },
]);

pythonGenerator.addReservedWords('_adc_pin,_adc_type');
pythonGenerator.forBlock.adc_read_pin = (block, generator) => {
  generator.definitions_.import_adc_pin = 'from machine import Pin as _adc_pin';
  generator.definitions_.import_adc = 'from machine import ADC as _adc_type';
  const pin = generator.valueToCode(block, 'PIN', Order.NONE) || '0';
  return [`_adc_type(_adc_pin(${pin})).read_u16()`, Order.FUNCTION_CALL];
};
