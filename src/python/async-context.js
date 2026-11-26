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

// A synchronous procedure nested visually inside async code is still synchronous Python.
for (const type of ['procedures_defnoreturn', 'procedures_defreturn']) {
  const original = pythonGenerator.forBlock[type];
  pythonGenerator.forBlock[type] = (block, generator) =>
    functionContext(generator, false, () => original(block, generator));
}
