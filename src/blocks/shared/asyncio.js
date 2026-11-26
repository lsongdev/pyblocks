import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';
import { eventHandler } from '../../python/events.js';
import { asyncioEntry } from '../../python/event-scheduler.js';
import { inAsyncFunction } from '../../python/async-context.js';

const colour = 260;
const statement = { previousStatement: null, nextStatement: null };
const body = { type: 'input_statement', name: 'DO' };
const task = () => ({ type: 'input_value', name: 'TASK', check: 'AsyncTask' });
common.defineBlocksWithJsonArray([
  { type: 'asyncio_run', message0: blockMessage('asyncRun'), message1: blockMessage('buttonEventBody'),
    args1: [body], ...statement, colour, tooltip: blockMessage('asyncRunHint') },
  { type: 'asyncio_create_task', message0: blockMessage('asyncCreateTask'), message1: blockMessage('buttonEventBody'),
    args1: [body], output: 'AsyncTask', colour, tooltip: blockMessage('asyncCreateTaskHint') },
  { type: 'asyncio_sleep', message0: blockMessage('asyncSleep'), args0: [
    { type: 'input_value', name: 'DURATION', check: 'Number' },
    { type: 'field_dropdown', name: 'UNIT', options: [[blockMessage('milliseconds'), 'MS'], [blockMessage('asyncSeconds'), 'S']] },
  ], ...statement, colour, tooltip: blockMessage('asyncSleepHint') },
  { type: 'asyncio_wait_task', message0: blockMessage('asyncWaitTask'), args0: [task()], ...statement, colour,
    tooltip: blockMessage('asyncWaitHint') },
  { type: 'asyncio_await_task', message0: blockMessage('asyncAwaitTask'), args0: [task()], output: null, colour,
    tooltip: blockMessage('asyncWaitHint') },
  { type: 'asyncio_return', message0: blockMessage('asyncReturn'), args0: [{ type: 'input_value', name: 'VALUE' }],
    previousStatement: null, colour, tooltip: blockMessage('asyncReturnHint') },
  { type: 'asyncio_cancel_task', message0: blockMessage('asyncCancelTask'), args0: [task()], ...statement, colour,
    tooltip: blockMessage('asyncCancelHint') },
]);
pythonGenerator.addReservedWords('_asyncio');
function module(generator) {
  generator.definitions_.import_asyncio = 'import asyncio as _asyncio';
  return '_asyncio';
}
function requireAsync(generator) {
  if (!inAsyncFunction(generator)) throw new PythonBlockError(t('asyncContextRequired'));
}
function taskCode(block, generator, order = Order.NONE) {
  const code = generator.valueToCode(block, 'TASK', order);
  if (!code) throw new PythonBlockError(t('requiredExpression', t('asyncTask')));
  return code;
}
Object.assign(pythonGenerator.forBlock, {
  asyncio_run(block, generator) {
    if (inAsyncFunction(generator)) throw new PythonBlockError(t('asyncNestedRun'));
    module(generator);
    const { name, code } = eventHandler(block, generator, '_async_main', { asynchronous: true });
    return code + asyncioEntry(generator, `${name}()`);
  },
  asyncio_create_task(block, generator) {
    requireAsync(generator);
    const asyncModule = module(generator);
    const { name, code } = eventHandler(block, generator, '_async_task', { asynchronous: true });
    generator.definitions_[name] = code;
    return [`${asyncModule}.create_task(${name}())`, Order.FUNCTION_CALL];
  },
  asyncio_sleep(block, generator) {
    requireAsync(generator);
    const duration = generator.valueToCode(block, 'DURATION', Order.NONE) || '0';
    const milliseconds = block.getFieldValue('UNIT') === 'MS';
    return `await ${module(generator)}.${milliseconds ? 'sleep_ms' : 'sleep'}(${milliseconds ? `int(${duration})` : duration})\n`;
  },
  asyncio_wait_task(block, generator) {
    requireAsync(generator);
    return `await (${taskCode(block, generator)})\n`;
  },
  asyncio_await_task(block, generator) {
    requireAsync(generator);
    return [`(await (${taskCode(block, generator)}))`, Order.ATOMIC];
  },
  asyncio_return(block, generator) {
    requireAsync(generator);
    return `return ${generator.valueToCode(block, 'VALUE', Order.NONE) || 'None'}\n`;
  },
  asyncio_cancel_task: (block, generator) => `${taskCode(block, generator, Order.MEMBER)}.cancel()\n`,
});
