import test from 'node:test';
import assert from 'node:assert/strict';
import { targetsSpikeApp } from '../src/python/targets.js';

test('recognizes SPIKE App Python by its hub runtime imports', () => {
  assert.equal(targetsSpikeApp("from hub import light_matrix as _spike_light_matrix\n"), true);
  assert.equal(targetsSpikeApp("  import runloop as _spike_runloop\n"), true);
  assert.equal(targetsSpikeApp("from hub import port as _spike_port\nimport color_sensor\n"), true);
  assert.equal(targetsSpikeApp("from hub import button as _spike_button\n"), true);
});

test('does not flag ordinary MicroPython programs', () => {
  assert.equal(targetsSpikeApp("import machine\nimport time\n"), false);
  assert.equal(targetsSpikeApp("from microbit import *\n"), false);
  assert.equal(targetsSpikeApp("print('hello')\n"), false);
  // A module that merely mentions the word in a string is not SPIKE App Python.
  assert.equal(targetsSpikeApp("print('from hub import x')\n"), false);
});
