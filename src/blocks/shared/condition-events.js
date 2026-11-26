import { common, Names } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';
import { eventHandler } from '../../python/events.js';
import { functionContext, asyncContext } from '../../python/async-context.js';
import { conditionEventRuntime } from '../../python/condition-events.js';
import { registerCondition } from '../../python/event-scheduler.js';

common.defineBlocksWithJsonArray(['events_when', 'events_when_async'].map(type => (
  { type, message0: blockMessage(type === 'events_when_async' ? 'eventsWhenAsync' : 'eventsWhen'), args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
  ], message1: blockMessage('eventsStable'), args1: [
    { type: 'field_number', name: 'STABLE', value: 0, min: 0, max: 60000, precision: 1 },
  ], message2: blockMessage('buttonEventBody'), args2: [{ type: 'input_statement', name: 'DO' }],
  colour: 30, ...(type === 'events_when_async' ? {hat: 'cap'} : {previousStatement:null,nextStatement:null}), tooltip: blockMessage(type === 'events_when_async' ? 'eventsAsyncHint' : 'eventsWhenHint') }
)));
function generateEvent(block, generator) {
  const asynchronous = block.type === 'events_when_async';
  if (asynchronous && block.getParent()) throw new PythonBlockError(t('eventsScope'));
  const condition = functionContext(generator, false, () => generator.valueToCode(block, 'CONDITION', Order.NONE));
  if (!condition) throw new PythonBlockError(t('requiredExpression', t('eventCondition')));
  if (!asynchronous) {
    generator.definitions_.import_condition_time = 'import utime as _condition_time';
    generator.definitions_.condition_edges = conditionEventRuntime;
    const state = generator.nameDB_.getDistinctName('_condition_state', Names.NameType.VARIABLE);
    generator.definitions_[state] = `${state} = []`;
    const body = asyncContext(generator, false, () => generator.statementToCode(block, 'DO')) || `${generator.INDENT}pass\n`;
    return `if _condition_sample(${state}, ${condition}, ${block.getFieldValue('STABLE')}):\n${body}`;
  }
  const { name, code } = eventHandler(block, generator, '_on_condition', { asynchronous: true });
  generator.definitions_[name] = code;
  registerCondition(generator, `(lambda: ${condition}, ${block.getFieldValue('STABLE')}, ${name})`);
  return '';
}
pythonGenerator.forBlock.events_when = generateEvent;
pythonGenerator.forBlock.events_when_async = generateEvent;
