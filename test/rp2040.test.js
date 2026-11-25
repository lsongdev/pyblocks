import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePicoUF2, connectPicoBoot } from '../src/device/rp2040.js';

function uf2() {
  const buffer = new ArrayBuffer(1024);
  const view = new DataView(buffer);
  for (let i = 0; i < 2; i++) {
    const start = i * 512;
    const words = { 0: 0x0a324655, 4: 0x9e5d5157, 8: 0x2000, 12: 0x10000000 + i * 256,
      16: 256, 20: i, 24: 2, 28: 0xe48bff56, 508: 0x0ab16f30 };
    for (const [offset, value] of Object.entries(words)) view.setUint32(start + Number(offset), value, true);
    new Uint8Array(buffer, start + 32, 256).fill(i + 1);
  }
  return buffer;
}
function usb(t, corrupt = false) {
  const commands = [];
  const flash = new Uint8Array(4096);
  let current;
  const device = {
    opened: false,
    configuration: { interfaces: [{ interfaceNumber: 1, alternate: { interfaceClass: 255, endpoints: [
      { type: 'bulk', direction: 'in', endpointNumber: 2 }, { type: 'bulk', direction: 'out', endpointNumber: 1 },
    ] } }] },
    async open() { this.opened = true; },
    async close() { this.opened = false; },
    async claimInterface() {}, async releaseInterface() {},
    async controlTransferOut() { return { status: 'ok' }; },
    async transferOut(_endpoint, data) {
      if (data.length === 32) {
        const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
        assert.equal(v.getUint32(0, true), 0x431fd10b);
        current = { id: data[8], address: v.getUint32(16, true) - 0x10000000, length: v.getUint32(20, true) };
        commands.push(current.id);
        if (current.id === 3) flash.fill(0xff, current.address, current.address + current.length);
      } else if (current.id === 5) flash.set(data, current.address);
      return { status: 'ok', bytesWritten: data.length };
    },
    async transferIn(_endpoint, length) {
      const data = current.id === 0x84 ? flash.slice(current.address, current.address + length) : new Uint8Array();
      if (corrupt && data.length) data[0] ^= 1;
      return { status: 'ok', data: new DataView(data.buffer) };
    },
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { usb: {
    async requestDevice({ filters }) {
      assert.deepEqual(filters, [{ vendorId: 0x2e8a, productId: 3 }]);
      return device;
    },
  } } });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  });
  return { commands, device };
}

test('UF2 payloads decode into the RP2040 flash address range', () => {
  const data = decodePicoUF2(uf2());
  assert.equal(data.length, 512);
  assert.ok(data.subarray(0, 256).every(value => value === 1));
  assert.ok(data.subarray(256).every(value => value === 2));
});

test('UF2 rejects other families, out-of-range writes, malformed blocks and duplicates', () => {
  for (const [offset, value] of [[28, 0], [12, 0x10200000], [16, 512], [508, 0], [512 + 20, 0], [512 + 12, 0x10000000]]) {
    const buffer = uf2();
    new DataView(buffer).setUint32(offset, value, true);
    assert.throws(() => decodePicoUF2(buffer));
  }
  assert.throws(() => decodePicoUF2(new ArrayBuffer(511)));
});

test('PICOBOOT erases, writes, reads back and only reboots after verification', async t => {
  const { commands, device } = usb(t);
  const pico = await connectPicoBoot();
  const progress = [];
  await pico.install(uf2(), () => {}, value => progress.push(value));
  assert.deepEqual(commands, [1, 6, 3, 5, 7, 0x84, 1, 2]);
  assert.equal(progress.at(-1), 1);
  await pico.close();
  assert.equal(device.opened, false);
});

test('invalid UF2 is rejected before changing flash', async t => {
  const { commands } = usb(t);
  const pico = await connectPicoBoot();
  await assert.rejects(pico.install(new ArrayBuffer(1), () => {}, () => {}));
  assert.deepEqual(commands, []);
  await pico.close();
});

test('verification mismatch prevents reboot and cleanup releases exclusive access', async t => {
  const { commands, device } = usb(t, true);
  const pico = await connectPicoBoot();
  await assert.rejects(pico.install(uf2(), () => {}, () => {}), /verification failed/);
  assert.ok(!commands.includes(2));
  await pico.close();
  assert.equal(commands.at(-1), 1);
  assert.equal(device.opened, false);
});
