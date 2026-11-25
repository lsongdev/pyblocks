import test from 'node:test';
import assert from 'node:assert/strict';
import { monitorPort } from '../src/device/micropython.js';

function mockPort(write = async () => {}) {
  let controller;
  const chunks = [];
  const port = {
    readable: new ReadableStream({ start(value) { controller = value; } }),
    writable: new WritableStream({ async write(chunk) { chunks.push(new Uint8Array(chunk)); await write(chunk); } }),
    async open(options) { assert.deepEqual(options, { baudRate: 115200 }); },
    async close() {
      assert.equal(port.readable.locked, false);
      assert.equal(port.writable.locked, false);
      port.closed = true;
    },
  };
  return { port, chunks, get controller() { return controller; } };
}

test('monitor reads UTF-8 while writes serialize and preserve control bytes and line endings', async () => {
  const device = mockPort();
  let output = '';
  const session = await monitorPort(device.port, text => { output += text; });
  const bytes = new TextEncoder().encode('你好');
  device.controller.enqueue(bytes.slice(0, 2));
  device.controller.enqueue(bytes.slice(2));
  await Promise.all([session.write('x'.repeat(130)), session.write('你好\r\n'), session.write('\x03'), session.write('\x04')]);
  const written = new TextDecoder().decode(Uint8Array.from(device.chunks.flatMap(chunk => [...chunk])));
  assert.equal(written, 'x'.repeat(130) + '你好\r\n\x03\x04');
  assert.ok(device.chunks.every(chunk => chunk.length <= 64));
  assert.equal(output, '你好');
  await session.close();
  assert.ok(device.port.closed);
  await assert.rejects(session.write('after close'), /closed/);
});

test('close waits for accepted writes and rejects new writes before releasing the port', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const device = mockPort(() => gate);
  const session = await monitorPort(device.port, () => {});
  const writing = session.write('pending');
  const closing = session.close();
  await assert.rejects(session.write('late'), /closed/);
  assert.ok(!device.port.closed);
  release();
  await Promise.all([writing, closing]);
  assert.ok(device.port.closed);
});

test('write errors release locks, and disconnection closes the session', async () => {
  const device = mockPort(async () => { throw new Error('device write failed'); });
  const session = await monitorPort(device.port, () => {});
  await assert.rejects(session.write('x'), /device write failed/);
  assert.equal(device.port.writable.locked, false);
  const ended = assert.rejects(session.done, /device disconnected/);
  device.controller.error(new Error('device disconnected'));
  await ended;
  assert.ok(device.port.closed);
  await assert.rejects(session.write('x'), /closed/);
});
