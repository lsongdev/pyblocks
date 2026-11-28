import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceToast } from '../src/editor/device-status.js';

test('toast replaces progress, expires success, and preserves errors until dismissed', () => {
  const element = { hidden: true, classList: { toggle(_name, value) { element.error = value; } } };
  const message = { textContent: '' };
  const dismiss = new EventTarget();
  const timers = new Map();
  let id = 0;
  let language = 'en';
  const toast = createDeviceToast({
    element, message, dismiss,
    translate: (key, detail) => [language,key,detail].filter(x => x !== undefined).join(':'),
    schedule(fn, ms) { assert.equal(ms, 3000); timers.set(++id, fn); return id; },
    cancel(id) { timers.delete(id); },
  });
  toast.show('spikeWriting', '50%');
  assert.equal(message.textContent, 'en:spikeWriting:50%');
  assert.equal(timers.size, 0);
  toast.show('spikeRunning','0');
  assert.equal(timers.size, 1);
  language = 'zh';
  toast.render();
  assert.equal(message.textContent, 'zh:spikeRunning:0');
  assert.equal(timers.size, 1);
  [...timers.values()][0]();
  assert.equal(element.hidden, true);
  toast.show('flashComplete');
  toast.show('serialOpenFailed','busy');
  assert.equal(timers.size, 0);
  assert.equal(element.error, true);
  assert.equal(message.textContent, 'zh:serialOpenFailed:busy');
  dismiss.dispatchEvent(new Event('click'));
  assert.equal(element.hidden, true);
  assert.equal(message.textContent, '');
  toast.show('selectPort');
  toast.show();
  assert.equal(element.hidden, true);
});
