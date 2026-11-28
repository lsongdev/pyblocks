import { pythonGenerator } from 'blockly/python';
import { exceptionContext } from './exception-context.js';

const contexts = new WeakMap();
export function inAsyncFunction(generator) {
  return contexts.get(generator) === true;
}
export function asyncContext(generator, asynchronous, generate) {
  const previous = contexts.get(generator);
  contexts.set(generator, asynchronous);
  try { return generate(); } finally {
    if (previous === undefined) contexts.delete(generator);
    else contexts.set(generator, previous);
  }
}

export function functionContext(generator, asynchronous, generate) {
  return exceptionContext(generator, false, () => asyncContext(generator, asynchronous, generate));
}

// Value-returning procedures are synchronous even if visually nested in a task.
const generateReturnProcedure = pythonGenerator.forBlock.procedures_defreturn;
pythonGenerator.forBlock.procedures_defreturn = (block, generator) =>
  functionContext(generator, false, () => generateReturnProcedure(block, generator));
