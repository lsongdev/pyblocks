import { createRequire, registerHooks } from 'node:module';

// Initialise Blockly's Node XML dependencies for serialized shadow blocks.
createRequire(import.meta.url)('blockly/core');

// Use the browser ESM entry used by Vite; core-node.js exposes only CommonJS.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'blockly/core') {
      return nextResolve(new URL('blockly.mjs', import.meta.resolve('blockly')).href, context);
    }
    return nextResolve(specifier, context);
  },
});
