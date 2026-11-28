import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('device panel keeps device actions and identity in its header, clear in console', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const panel = html.slice(html.indexOf('id="device-panel"'), html.indexOf('id="output-resizer"'));
  const header = panel.match(/<div class="device-heading-actions"[^>]*>([\s\S]*?)<\/div>/)[1];
  assert.match(header, /id="serial-connect"[\s\S]*id="upload"/);
  for (const id of ['change-device', 'change-slot', 'serial-interrupt', 'serial-reset', 'spike-stop', 'serial-connect', 'upload']) {
    assert.match(header, new RegExp('id="' + id + '"'));
    assert.equal(panel.split('id="' + id + '"').length, 2);
  }
  assert.doesNotMatch(panel, /class="device-actions"/);
  assert.equal((header.match(/aria-label=/g) || []).length, 7);
  assert.equal((header.match(/<svg/g) || []).length, 8);
  assert.doesNotMatch(header, /id="serial-clear"/);
  assert.match(panel, /class="serial-heading"[\s\S]*?id="serial-clear"/);
  assert.equal(panel.split('id="serial-clear"').length, 2);
  assert.match(panel, /class="panel-heading"[\s\S]*?id="deployment-device"[\s\S]*?<p id="upload-status"/);
  assert.doesNotMatch(panel, /class="device-details"/);
  assert.match(panel, /class="device-identity"[\s\S]*?id="deployment-device"[\s\S]*?id="deployment-result"[\s\S]*?<\/div>/);
  assert.match(panel, /id="upload-status"/);
  assert.doesNotMatch(panel, /id="serial-status"/);
  assert.ok(panel.indexOf('id="upload-status"') < panel.indexOf('id="serial-panel"'));
});

test('SPIKE program slot uses a labelled native radio grid, not a dropdown', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<fieldset id="spike-slot-fieldset">[\s\S]*?<legend[^>]*>Program slot<\/legend>[\s\S]*?id="spike-device-slot" class="spike-slot-grid"/);
  assert.doesNotMatch(html, /<select id="spike-device-slot"/);
});

test('vertical splitter stays transparent in both themes', () => {
  const css = readFileSync(new URL('../src/styles/editor.css', import.meta.url), 'utf8');
  assert.match(css, /\.vertical-resize\s*\{[^}]*background:\s*transparent/);
  assert.doesNotMatch(css, /data-theme="dark"\]\s+\.vertical-resize\s*\{/);
});
