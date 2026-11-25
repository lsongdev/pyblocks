import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { updateProgress } from '../src/editor/progress.js';
const { JSDOM } = createRequire(import.meta.url)('jsdom');

test('optional Microbit progress never throws or interrupts the install callback', async () => {
  const dom = new JSDOM('<progress max="1"></progress>');
  const progress = dom.window.document.querySelector('progress');
  let finished = false;
  try {
    // The library emits a stage without a percentage before numerical progress.
    const install = async report => {
      report(undefined);
      assert.equal(progress.hasAttribute('value'), false);
      report(0);
      assert.equal(progress.value, 0);
      report(.5);
      assert.equal(progress.value, .5);
      report(undefined);
      assert.equal(progress.hasAttribute('value'), false);
      report(1);
      finished = true;
    };
    await install(value => updateProgress(progress, value));
    assert.equal(finished, true);
    assert.equal(progress.value, 1);
  } finally { dom.window.close(); }
});

test('non-finite progress remains indeterminate and numerical progress stays in range', () => {
  const dom = new JSDOM('<progress max="1" value="0.5"></progress>');
  const progress = dom.window.document.querySelector('progress');
  try {
    for (const value of [NaN, Infinity, -Infinity, undefined, null, '0.5']) {
      updateProgress(progress, value);
      assert.equal(progress.hasAttribute('value'), false);
    }
    updateProgress(progress, -1);
    assert.equal(progress.value, 0);
    updateProgress(progress, 2);
    assert.equal(progress.value, 1);
  } finally { dom.window.close(); }
});
