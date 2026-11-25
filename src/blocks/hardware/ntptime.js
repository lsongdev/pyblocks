import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';

const statement = { previousStatement: null, nextStatement: null };
common.defineBlocksWithJsonArray([
  { type: 'ntptime_config', message0: blockMessage('ntpConfig'), args0: [
    { type: 'input_value', name: 'HOST', check: 'String' },
    { type: 'input_value', name: 'TIMEOUT', check: 'Number' },
  ], ...statement, colour: 40, tooltip: blockMessage('ntpConfigHint') },
  { type: 'ntptime_sync', message0: blockMessage('ntpSync'), ...statement, colour: 40, tooltip: blockMessage('ntpSyncHint') },
  { type: 'ntptime_time', message0: blockMessage('ntpTime'), output: 'Number', colour: 40, tooltip: blockMessage('ntpTimeHint') },
]);
pythonGenerator.addReservedWords('_ntptime');
function ntp(generator) {
  generator.definitions_.import_ntptime = 'import ntptime as _ntptime';
  return '_ntptime';
}
Object.assign(pythonGenerator.forBlock, {
  ntptime_config(block, generator) {
    const module = ntp(generator);
    const host = generator.valueToCode(block, 'HOST', Order.NONE) || "'pool.ntp.org'";
    const timeout = generator.valueToCode(block, 'TIMEOUT', Order.NONE) || '1';
    const literal = block.getInputTargetBlock('TIMEOUT');
    if (literal?.type === 'math_number' && !(Number(literal.getFieldValue('NUM')) > 0)) {
      throw new PythonBlockError(t('ntpTimeoutInvalid'));
    }
    return `${module}.host = ${host}\n${module}.timeout = ${timeout}\n`;
  },
  ntptime_sync: (_block, generator) => `${ntp(generator)}.settime()\n`,
  ntptime_time: (_block, generator) => [`${ntp(generator)}.time()`, Order.FUNCTION_CALL],
});
