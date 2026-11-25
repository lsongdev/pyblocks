import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';

const colour = 40;
const value = name => ({ type: 'input_value', name, check: 'Number' });

common.defineBlocksWithJsonArray([
  { type: 'timing_epoch_seconds', message0: blockMessage('epochSeconds'), tooltip: blockMessage('epochSecondsHint'), output: 'Number', colour },
  { type: 'timing_datetime', message0: blockMessage('utcDatetime'), tooltip: blockMessage('utcDatetimeHint'), output: 'Array', colour },
  {
    type: 'timing_wait_ms',
    message0: blockMessage('waitMs'),
    args0: [value('MS')],
    previousStatement: null,
    nextStatement: null,
    colour,
  },
  {
    type: 'timing_ticks_ms',
    message0: blockMessage('ticksMs'),
    tooltip: blockMessage('ticksMsHint'),
    output: 'Number',
    colour,
  },
  {
    type: 'timing_elapsed_ms',
    message0: blockMessage('elapsedMs'),
    args0: [value('START'), value('END')],
    tooltip: blockMessage('elapsedMsHint'),
    inputsInline: true,
    output: 'Number',
    colour,
  },
]);

pythonGenerator.addReservedWords('_timing_time');

function timeCall(generator, method, args = []) {
  generator.definitions_.import_timing_time = 'import time as _timing_time';
  return `_timing_time.${method}(${args.join(', ')})`;
}

function integer(block, generator, input) {
  return `int(${generator.valueToCode(block, input, Order.NONE) || '0'})`;
}

Object.assign(pythonGenerator.forBlock, {
  timing_epoch_seconds: (_block, generator) => [timeCall(generator, 'time'), Order.FUNCTION_CALL],
  timing_datetime: (_block, generator) => [timeCall(generator, 'gmtime'), Order.FUNCTION_CALL],
  timing_wait_ms: (block, generator) =>
    `${timeCall(generator, 'sleep_ms', [integer(block, generator, 'MS')])}\n`,
  timing_ticks_ms: (_block, generator) => [timeCall(generator, 'ticks_ms'), Order.FUNCTION_CALL],
  timing_elapsed_ms: (block, generator) => [
    timeCall(generator, 'ticks_diff', [integer(block, generator, 'END'), integer(block, generator, 'START')]),
    Order.FUNCTION_CALL,
  ],
});
