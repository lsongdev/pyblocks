import test from 'node:test';
import assert from 'node:assert/strict';
import { portProtocol, requireReplCandidate } from '../src/device/detect.js';
import { isSpikeSlot, requireSpikeSlot } from '../src/device/spike/slots.js';
import { readPreferredSlot, rememberSlot, createSpikeDialog } from '../src/editor/spike-dialog.js';

const port = (usbVendorId, usbProductId) => ({ getInfo: () => ({ usbVendorId, usbProductId }) });
test('physical USB identity selects SPIKE candidate, not Python source', () => {
  assert.equal(portProtocol(port(0x0694, 0x0009)), 'spike');
  assert.equal(portProtocol(port(0x0694, 0x000a)), 'unsupported-lego');
  assert.equal(portProtocol(port(0x10c4, 0xea60)), 'repl-candidate');
  assert.equal(portProtocol({}), 'repl-candidate');
  assert.throws(() => requireReplCandidate(port(0x0694, 0x0009)), { code: 'legoNotRepl' });
  assert.throws(() => requireReplCandidate(port(0x0694, 0x000a)), { code: 'legoNotRepl' });
});
test('SPIKE slots are bounded and preference is only a hint', () => {
  const map = new Map();
  const storage = { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v) };
  assert.equal(readPreferredSlot(storage), 0);
  rememberSlot(19, storage);
  assert.equal(readPreferredSlot(storage), 19);
  for (const value of [-1,20,1.5,'3',NaN]) {
    assert.equal(isSpikeSlot(value), false);
    assert.throws(() => requireSpikeSlot(value), RangeError);
    rememberSlot(value, storage);
  }
  assert.equal(readPreferredSlot(storage), 19);
});

class Element extends EventTarget {
  value = '';
  children = [];
  open = false;
  append(child) { this.children.push(child); }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
  click() { this.dispatchEvent(new Event('click')); }
}
test('SPIKE dialog confirms a selected slot, cancels without a selection and handles disconnect', async () => {
  const nodes = new Map();
  const document = {
    querySelector(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); },
    createElement() { return new Element(); },
  };
  const listeners = new Set();
  const hub = {
    info: { firmware: '1.8.149', rpcMajor: 1, rpcMinor: 0, rpcBuild: 47 },
    closed: false,
    onClose(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  const choose = createSpikeDialog(document);
  const slot = document.querySelector('#spike-device-slot');
  assert.equal(slot.children.length, 20);
  let result = choose(hub, { initial: 3, uploading: true });
  assert.equal(slot.value, '3');
  slot.value = '7';
  document.querySelector('#spike-device-confirm').click();
  assert.equal(await result, 7);
  assert.equal(listeners.size, 0);
  result = choose(hub, { initial: 7 });
  document.querySelector('#spike-device-cancel').click();
  assert.equal(await result, null);
  result = choose(hub, { initial: 7 });
  hub.closed = true;
  for (const fn of listeners) fn();
  assert.equal(await result, null);
  assert.equal(listeners.size, 0);
});
