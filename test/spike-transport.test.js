import test from 'node:test';
import assert from 'node:assert/strict';

import { openSpikeSerial, selectSpikeSerialPort } from '../src/device/spike/serial.js';
import { uploadSpikeProgram, connectSpike } from '../src/device/spike/index.js';
import { pack, unpack } from '../src/device/spike/codec.js';
import { openSpikeBle } from '../src/device/spike/ble.js';

function installNavigator(value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });
  return () => Object.defineProperty(globalThis, 'navigator', descriptor);
}

function serialMock(onWrite) {
  let resolveRead;
  let cancelled = false;
  let released = false;
  const queued = [];
  const written = [];
  const reader = {
    read() {
      if (queued.length) return Promise.resolve({ value: queued.shift(), done: false });
      if (cancelled) return Promise.resolve({ value: undefined, done: true });
      return new Promise(resolve => { resolveRead = resolve; });
    },
    releaseLock() {},
    async cancel() {
      cancelled = true;
      resolveRead?.({ value: undefined, done: true });
      resolveRead = undefined;
    },
  };
  const writer = {
    async write(bytes) {
      written.push(Uint8Array.from(bytes));
      onWrite?.(bytes, port);
    },
    releaseLock() { released = true; },
  };
  const port = {
    readable: { getReader: () => reader },
    writable: { getWriter: () => writer },
    opened: undefined,
    closed: false,
    async open(options) { this.opened = options; },
    async close() { this.closed = true; },
    push(bytes) {
      if (resolveRead) {
        const resolve = resolveRead;
        resolveRead = undefined;
        resolve({ value: bytes, done: false });
      } else {
        queued.push(bytes);
      }
    },
  };
  return { port, written, get released() { return released; } };
}

test('serial transport opens at 115200, forwards reads, writes and closes', async () => {
  const mock = serialMock();
  const { port, written } = mock;
  let requested;
  const restore = installNavigator({
    serial: { async getPorts() { return []; }, async requestPort(options) { requested = options; return port; } },
  });
  try {
    const received = [];
    const transport = await openSpikeSerial(await selectSpikeSerialPort(), { onData: chunk => received.push(chunk), onClose() {} });
    assert.deepEqual(requested, { filters: [{ usbVendorId: 0x0694 }] });
    assert.deepEqual(port.opened, { baudRate: 115200 });

    port.push(Uint8Array.of(1, 2, 3));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(received, [Uint8Array.of(1, 2, 3)]);

    await transport.write(Uint8Array.of(4, 5));
    assert.deepEqual(written, [Uint8Array.of(4, 5)]);

    await transport.close();
    assert.equal(port.closed, true);
    assert.equal(mock.released, true);
  } finally {
    restore();
  }
});

test('browser SPIKE upload uses one serial connection with firmware 1.8.149', async () => {
  const requests = [];
  const { port } = serialMock((bytes, serial) => {
    const [id] = unpack(bytes);
    requests.push(id);
    if (id === 0) {
      // InfoResponse captured from the physical USB hub.
      serial.push(pack(Buffer.from('0101002f00010895000002881300100000', 'hex')));
      return;
    }
    serial.push(pack(Uint8Array.of(id + 1, 0)));
    if (id === 0x1e) serial.push(pack(Uint8Array.of(0x21, 0x4f, 0x4b, 0)));
  });
  let selections = 0;
  const restore = installNavigator({
    serial: { async getPorts() { return []; }, async requestPort() { selections++; return port; } },
  });
  try {
    const output = [];
    const hub = await uploadSpikeProgram(await selectSpikeSerialPort(), 'print("OK")', {
      slot: 0,
      onConsole: message => output.push(message),
    });
    try {
      assert.equal(selections, 1);
      assert.deepEqual(requests, [0, 0x46, 0x0c, 0x10, 0x1e]);
      assert.deepEqual(output, ['OK']);
    } finally {
      await hub.close();
    }
    assert.equal(port.closed, true);
  } finally {
    restore();
  }
});

test('SPIKE port selection reuses a uniquely authorized Prime and prompts when ambiguous', async () => {
  const prime = { getInfo: () => ({ usbVendorId: 0x0694, usbProductId: 0x0009 }) };
  const other = { getInfo: () => ({ usbVendorId: 0x1234, usbProductId: 0x0009 }) };
  const ports = [other, prime];
  let selections = 0;
  const restore = installNavigator({
    serial: { async getPorts() { return ports; }, async requestPort() { selections++; return prime; } },
  });
  try {
    assert.equal(await selectSpikeSerialPort(), prime);
    assert.equal(selections, 0);
    ports.push({ ...prime });
    assert.equal(await selectSpikeSerialPort(), prime);
    assert.equal(selections, 1);
  } finally {
    restore();
  }
});

function bleMock() {
  const listeners = new Set();
  const deviceListeners = new Set();
  const rx = { written: [] };
  const tx = {
    listeners,
    async startNotifications() {},
    async stopNotifications() {},
    addEventListener(type, listener) { if (type === 'characteristicvaluechanged') listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'characteristicvaluechanged') listeners.delete(listener); },
    emit(bytes) {
      const value = new DataView(Uint8Array.from(bytes).buffer);
      for (const listener of listeners) listener({ target: { value } });
    },
  };
  const characteristics = new Map([
    ['0000fd02-0001-1000-8000-00805f9b34fb', {
      ...rx,
      async writeValueWithoutResponse(bytes) { rx.written.push(Uint8Array.from(bytes)); },
    }],
    ['0000fd02-0002-1000-8000-00805f9b34fb', tx],
  ]);
  let serviceUuid;
  let disconnected = false;
  const service = { getCharacteristic: async uuid => characteristics.get(uuid) };
  const server = {
    async getPrimaryService(uuid) { serviceUuid = uuid; return service; },
    disconnect() { disconnected = true; },
  };
  const device = {
    gatt: { connect: async () => server },
    addEventListener(type, listener) { if (type === 'gattserverdisconnected') deviceListeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'gattserverdisconnected') deviceListeners.delete(listener); },
    emitDisconnect() { for (const listener of deviceListeners) listener(); },
    get disconnected() { return disconnected; },
    get serviceUuid() { return serviceUuid; },
  };
  return { device, rx, tx };
}

test('BLE transport writes to RX and forwards TX notifications', async () => {
  const { device, rx, tx } = bleMock();
  let requested;
  const restore = installNavigator({
    bluetooth: { async requestDevice(options) { requested = options; return device; } },
  });
  try {
    let closed = 0;
    const received = [];
    const transport = await openSpikeBle({ onData: chunk => received.push(chunk), onClose: () => { closed++; } });
    assert.deepEqual(requested, { filters: [{ services: [0xfd02] }] });
    assert.equal(device.serviceUuid, 0xfd02);

    tx.emit(Uint8Array.of(9, 8));
    assert.deepEqual(received, [Uint8Array.of(9, 8)]);

    await transport.write(Uint8Array.of(1, 2));
    assert.deepEqual(rx.written, [Uint8Array.of(1, 2)]);

    device.emitDisconnect();
    assert.equal(closed, 1);

    await transport.close();
    assert.equal(tx.listeners.size, 0);
    assert.equal(device.disconnected, true);
  } finally {
    restore();
  }
});

test('SPIKE connection only requests info until a slot is confirmed', async () => {
  const requests = [];
  const { port } = serialMock((bytes, serial) => {
    const message = unpack(bytes);
    requests.push([...message]);
    if (message[0] === 0) serial.push(pack(Buffer.from('0101002f00010895000002881300100000', 'hex')));
    else serial.push(pack(Uint8Array.of(message[0] + 1, 0)));
  });
  const hub = await connectSpike(port);
  try {
    assert.deepEqual(requests, [[0]]);
    await assert.rejects(hub.upload('print(1)', 20), RangeError);
    assert.deepEqual(requests, [[0]]);
    await hub.upload('print(1)', 7);
    await hub.start(7);
    assert.deepEqual(requests[1], [0x46, 7]);
    assert.deepEqual(requests.at(-1), [0x1e, 0, 7]);
  } finally { await hub.close(); }
});
