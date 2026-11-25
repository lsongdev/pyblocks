const contexts = new WeakMap();
export const inExceptionHandler = generator => contexts.get(generator) === true;
export function exceptionContext(generator, active, generate) {
  const previous = contexts.get(generator);
  contexts.set(generator, active);
  try { return generate(); } finally {
    if (previous === undefined) contexts.delete(generator);
    else contexts.set(generator, previous);
  }
}
