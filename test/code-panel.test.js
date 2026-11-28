import test from 'node:test';
import assert from 'node:assert/strict';
import { createCodePanel } from '../src/editor/code-panel.js';

class Element extends EventTarget {
  value = '';
  hidden = false;
  disabled = false;
  attributes = new Map();
  classList = { toggle() {} };
  setAttribute(key, value) { this.attributes.set(key, value); }
  focus() {}
  click() { this.dispatchEvent(new Event('click')); }
}

test('code collapse keeps source and manual edits available for upload and download', () => {
  const nodes = new Map();
  const document = { querySelector(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); } };
  let generated = 'print(1)', changed = 0;
  const downloads = [];
  const panel = createCodePanel({ document, generate: () => generated, onChange: () => changed++, downloadFile: (...args) => downloads.push(args) });
  panel.refresh();
  assert.equal(panel.source, generated);
  assert.equal(panel.manualCode, null);
  panel.setExpanded(false);
  assert.equal(nodes.get('#code-body').hidden, true);
  assert.equal(nodes.get('#output-resizer').hidden, true);
  assert.equal(panel.source, generated);
  nodes.get('#python').value = 'print(2)';
  nodes.get('#python').dispatchEvent(new Event('input'));
  generated = 'print(3)';
  panel.refresh();
  assert.equal(panel.manualCode, 'print(2)');
  nodes.get('#download').click();
  assert.deepEqual(downloads, [['print(2)', 'text/x-python', 'main.py']]);
  nodes.get('#use-block-code').click();
  assert.equal(panel.manualCode, null);
  assert.equal(panel.source, 'print(3)');
  assert.equal(changed, 2);
  panel.setExpanded(true);
  assert.equal(nodes.get('#code-body').hidden, false);
});
