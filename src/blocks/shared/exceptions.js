import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';
import { exceptionContext, inExceptionHandler } from '../../python/exception-context.js';

const colour = 210;
const statement = { previousStatement: null, nextStatement: null };
const handlerType = 'ExceptionHandler';
const exceptionTypes = ['Exception', 'OSError', 'ValueError', 'TypeError', 'RuntimeError', 'ZeroDivisionError', 'KeyError', 'IndexError', 'ImportError', 'asyncio.TimeoutError', 'asyncio.CancelledError'];
const typeField = () => ({ type: 'field_dropdown', name: 'TYPE', options: exceptionTypes.map(name => [name, name]) });
const body = name => ({ type: 'input_statement', name });
common.defineBlocksWithJsonArray([
  { type: 'exception_try', message0: blockMessage('exceptionTry'), args0: [body('DO')],
    message1: blockMessage('exceptionHandlers'), args1: [{ ...body('HANDLERS'), check: handlerType }],
    message2: blockMessage('exceptionElse'), args2: [body('ELSE')],
    message3: blockMessage('exceptionFinally'), args3: [body('FINALLY')],
    ...statement, colour, tooltip: blockMessage('exceptionTryHint') },
  { type: 'exception_catch', message0: blockMessage('exceptionCatch'), args0: [typeField(),
    { type: 'field_variable', name: 'VAR', variable: 'error' }],
    message1: blockMessage('buttonEventBody'), args1: [body('DO')],
    previousStatement: handlerType, nextStatement: handlerType, colour, tooltip: blockMessage('exceptionCatchHint') },
  { type: 'exception_raise', message0: blockMessage('exceptionRaise'), args0: [typeField(),
    { type: 'input_value', name: 'MESSAGE', check: 'String' }], ...statement, colour },
  { type: 'exception_reraise', message0: blockMessage('exceptionReraise'), ...statement, colour,
    tooltip: blockMessage('exceptionReraiseHint') },
  { type: 'exception_text', message0: blockMessage('exceptionText'),
    args0: [{ type: 'input_value', name: 'ERROR' }], output: 'String', colour },
]);
pythonGenerator.addReservedWords(['_exception_asyncio', ...exceptionTypes.filter(name => !name.includes('.'))].join(','));
function exceptionType(block, generator) {
  const type = block.getFieldValue('TYPE');
  if (type.startsWith('asyncio.')) {
    generator.definitions_.import_exception_asyncio = 'import asyncio as _exception_asyncio';
    return type.replace('asyncio.', '_exception_asyncio.');
  }
  return type;
}
function suite(block, generator, name) {
  return generator.statementToCode(block, name) || `${generator.INDENT}pass\n`;
}
Object.assign(pythonGenerator.forBlock, {
  exception_try(block, generator) {
    let code = `try:\n${suite(block, generator, 'DO')}`;
    let count = 0;
    for (let handler = block.getInputTargetBlock('HANDLERS'); handler; handler = handler.getNextBlock()) {
      if (!handler.isEnabled()) continue;
      count++;
      const type = exceptionType(handler, generator);
      const name = generator.getVariableName(handler.getFieldValue('VAR'));
      const body = exceptionContext(generator, true, () => suite(handler, generator, 'DO'));
      code += `except ${type} as ${name}:\n${body}`;
    }
    const otherwise = generator.statementToCode(block, 'ELSE');
    const cleanup = generator.statementToCode(block, 'FINALLY');
    if (!count && (!cleanup || otherwise)) throw new PythonBlockError(t('exceptionTryInvalid'));
    if (otherwise) code += `else:\n${otherwise}`;
    if (cleanup) code += `finally:\n${cleanup}`;
    return code;
  },
  exception_catch: () => '',
  exception_raise: (block, generator) => `raise ${exceptionType(block, generator)}(${generator.valueToCode(block, 'MESSAGE', Order.NONE) || "''"})\n`,
  exception_reraise(_block, generator) {
    if (!inExceptionHandler(generator)) throw new PythonBlockError(t('exceptionReraiseInvalid'));
    return 'raise\n';
  },
  exception_text(block, generator) {
    const value = generator.valueToCode(block, 'ERROR', Order.NONE);
    if (!value) throw new PythonBlockError(t('requiredExpression', t('exceptionValue')));
    return [`str(${value})`, Order.FUNCTION_CALL];
  },
});
