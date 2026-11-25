import test from 'node:test';
import assert from 'node:assert/strict';
import { setupSerialInput } from '../src/editor/serial-input.js';
class Element extends EventTarget {
  value = '';
  disabled = false;
  focus() { this.focused = true; }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(t) {
  const ids = ['serial-input-form', 'serial-input', 'serial-line-ending', 'serial-send', 'serial-interrupt', 'serial-reset'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  elements['serial-line-ending'].value = 'CR';
  const previous = globalThis.document;
  globalThis.document = { querySelector: selector => elements[selector.slice(1)] };
  t.after(() => { globalThis.document = previous; });
  const writes = [], errors = [];
  let session = { async write(text) { writes.push(text); } };
  let busy = false;
  const panel = setupSerialInput({ getSession: () => session, isBusy: () => busy, onError: error => errors.push(error) });
  return { elements, writes, errors, panel,
    session(value) { session = value; panel.update(); },
    busy(value) { busy = value; panel.update(); },
    submit() { elements['serial-input-form'].dispatchEvent(new Event('submit', { cancelable: true })); },
  };
}
function key(element, value) {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperty(event, 'key', { value });
  element.dispatchEvent(event);
}

test('line ending selection and history preserve drafts without persisting input', async t => {
  const p = setup(t), input = p.elements['serial-input'];
  for (const [ending, suffix] of [['CR','\r'], ['LF','\n'], ['CRLF','\r\n'], ['NONE','']]) {
    p.elements['serial-line-ending'].value = ending;
    input.value = ending;
    p.submit(); await flush();
    assert.equal(p.writes.at(-1), ending + suffix);
    assert.equal(input.value, '');
  }
  input.value = 'draft'; key(input, 'ArrowUp'); assert.equal(input.value, 'NONE');
  key(input, 'ArrowDown'); assert.equal(input.value, 'draft');
  input.dispatchEvent(new Event('compositionstart'));
  p.submit(); await flush(); assert.equal(p.writes.length, 4);
  input.dispatchEvent(new Event('compositionend'));
});

test('busy or disconnected sessions reject sending and disable terminal controls', async t => {
  const p = setup(t);
  p.busy(true);
  p.elements['serial-input'].value = 'do not send'; p.submit();
  p.elements['serial-interrupt'].dispatchEvent(new Event('click'));
  await flush(); assert.equal(p.writes.length, 0);
  for (const [id, element] of Object.entries(p.elements)) if (id !== 'serial-input-form') assert.equal(element.disabled, true);
  p.busy(false); p.session(null); p.submit(); await flush(); assert.equal(p.writes.length, 0);
});

test('pending writes serialize UI actions; failed sends keep input and report errors', async t => {
  const p = setup(t);
  let reject;
  p.session({ write: () => new Promise((resolve, failure) => { reject = failure; }) });
  const input = p.elements['serial-input']; input.value = 'keep me'; p.submit();
  assert.equal(input.disabled, true);
  p.submit();
  reject(new Error('failed')); await flush();
  assert.equal(input.value, 'keep me'); assert.equal(p.errors.length, 1); assert.equal(input.disabled, false);
});

test('interrupt and reset send only their control bytes', async t => {
  const p = setup(t);
  p.elements['serial-interrupt'].dispatchEvent(new Event('click')); await flush();
  p.elements['serial-reset'].dispatchEvent(new Event('click')); await flush();
  assert.deepEqual(p.writes, ['\x03', '\x04']);
});
