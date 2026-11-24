import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';

common.defineBlocksWithJsonArray([
  {
    type: 'adc_create', message0: blockMessage('adcCreate'),
    args0: [{type:'input_value', name:'PIN', check:['Number','String']}],
    output:'ADC', colour:155,
  },
  {
    type: 'adc_read', message0: blockMessage('adcRead'),
    args0: [{type:'input_value', name:'ADC', check:'ADC'}],
    tooltip:blockMessage('adcReadHint'), output:'Number', colour:155,
  },
]);

pythonGenerator.addReservedWords('_adc_pin,_adc_type');
Object.assign(pythonGenerator.forBlock, {
  adc_create(block, generator) {
    generator.definitions_.import_adc_pin = 'from machine import Pin as _adc_pin';
    generator.definitions_.import_adc = 'from machine import ADC as _adc_type';
    const pin = generator.valueToCode(block, 'PIN', Order.NONE) || '0';
    return [`_adc_type(_adc_pin(${pin}))`, Order.FUNCTION_CALL];
  },
  adc_read(block, generator) {
    const adc = generator.valueToCode(block, 'ADC', Order.MEMBER);
    if (!adc) throw new PythonBlockError(t('requiredExpression', 'ADC'));
    return [`${adc}.read_u16()`, Order.FUNCTION_CALL];
  },
});
