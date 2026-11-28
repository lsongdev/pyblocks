import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceController } from '../src/editor/device-controller.js';

function session() {
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  return { done, finish, async close() { finish(); } };
}

test('device operations are mutually exclusive and release after completion', () => {
  const device = new DeviceController();
  assert.equal(device.begin('files'), true);
  assert.equal(device.begin('firmware'), false);
  assert.equal(device.operation, 'files');
  device.end();
  assert.equal(device.busy, false);
  assert.equal(device.begin('firmware'), true);
});

test('late disconnect from detached serial session does not clear replacement', async () => {
  const events = [];
  const device = new DeviceController({ onDisconnect: (...args) => events.push(args) });
  let finish;
  const first = { done: new Promise(resolve => { finish = resolve; }), async close() {} };
  device.attachSerial(first);
  await device.detach();
  const second = session();
  device.attachSerial(second);
  finish();
  await first.done;
  assert.equal(device.serial, second);
  assert.deepEqual(events, []);
  second.finish();
  await second.done;
  assert.equal(device.serial, undefined);
  assert.deepEqual(events, [['serial', undefined]]);
});

test('serial and SPIKE cannot be attached simultaneously; SPIKE closure releases transport', async () => {
  const events = [];
  const device = new DeviceController({ onDisconnect: (...args) => events.push(args) });
  let callback;
  let closed = false;
  const hub = { onClose(fn) { callback = fn; }, async close() { closed = true; } };
  device.attachSpike(hub);
  assert.throws(() => device.attachSerial(session()), /Detach/);
  const error = new Error('disconnected');
  callback(error);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, true);
  assert.equal(device.spike, undefined);
  assert.deepEqual(events, [['spike', error]]);
});
