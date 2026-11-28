import test from 'node:test';
import assert from 'node:assert/strict';
import { inlineDeviceResult } from '../src/editor/device-status.js';

test('only matching deployment acknowledgments are shown inline', () => {
  const spike = { spike: { closed: false }, slot: 0 };
  assert.equal(inlineDeviceResult(spike, ['spikeRunning', '0']), 'deploymentStarted');
  assert.equal(inlineDeviceResult(spike, ['spikeStopped', '0']), 'deploymentStopRequested');
  assert.equal(inlineDeviceResult({ ...spike, slot: 1 }, ['spikeRunning', '0']), undefined);
  assert.equal(inlineDeviceResult({ ...spike, spike: { closed: true } }, ['spikeRunning', '0']), undefined);
  assert.equal(inlineDeviceResult({}, ['spikeRunning', '0']), undefined);
  assert.equal(inlineDeviceResult(spike, ['spikeWriting', '50%']), undefined);
  assert.equal(inlineDeviceResult(spike, ['flashFailed', 'error']), undefined);
  assert.equal(inlineDeviceResult(spike), undefined);
  assert.equal(inlineDeviceResult({ serial: {}, protocol: 'micropython' }, ['flashComplete']), 'deploymentRestarted');
  assert.equal(inlineDeviceResult({ serial: {}, protocol: 'serial' }, ['flashComplete']), undefined);
});
