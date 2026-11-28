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
  assert.match(panel, /class="device-meta"[\s\S]*?id="device-label"[\s\S]*?id="deployment-device"/);
  assert.match(panel, /class="console-body"[\s\S]*?id="serial-clear"[\s\S]*?id="serial-output"/);
  assert.equal(panel.split('id="serial-clear"').length, 2);
  assert.doesNotMatch(panel, /serial-heading|serial-label|device-details|deployment-result|upload-status|serial-status|device-toast/);
  assert.match(html, /id="device-toast"[^>]*hidden/);
  assert.ok(html.indexOf('id="device-toast"') > html.indexOf('</main>'));
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

test('all editor panels share the same header height and padding', () => {
  const css = readFileSync(new URL('../src/styles/editor.css', import.meta.url), 'utf8');
  const heading = css.match(/^\.panel-heading\s*\{([^}]+)\}/m)[1];
  assert.match(heading, /min-height:\s*64px/);
  assert.match(heading, /padding:\s*10px 12px/);
  assert.match(heading, /flex:\s*0 0 auto/);
  assert.match(heading, /align-items:\s*center/);
  assert.doesNotMatch(css, /#(?:device|code|blocks)-panel\s+\.panel-heading\s*\{/);
});

test('collapsed code panel preserves the same gap as the expanded splitter', () => {
  const css = readFileSync(new URL('../src/styles/editor.css', import.meta.url), 'utf8');
  assert.match(css, /#right-panels\s*\{[^}]*--panel-spacing:\s*12px/);
  assert.match(css, /#code-panel\.collapsed\s*\{[^}]*margin-top:\s*var\(--panel-spacing\)/);
  assert.match(css, /\.vertical-resize\s*\{[^}]*flex:\s*0 0 var\(--panel-spacing\)/);
});

test('all code actions live in the code header without an extra synchronization row', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const panel = html.slice(html.indexOf('id="code-panel"'), html.indexOf('</main>'));
  const header = panel.match(/<div class="code-actions">([\s\S]*?)<\/div>/)[1];
  assert.match(header, /id="use-block-code"[\s\S]*id="download"[\s\S]*id="toggle-code"/);
  assert.equal(panel.split('id="use-block-code"').length, 2);
  assert.doesNotMatch(panel, /code-sync/);
});
