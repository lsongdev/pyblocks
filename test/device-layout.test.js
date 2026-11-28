import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('device panel keeps all device and console actions in one header toolbar', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const panel = html.slice(html.indexOf('id="device-panel"'), html.indexOf('id="output-resizer"'));
  const header = panel.match(/<div class="device-heading-actions"[^>]*>([\s\S]*?)<\/div>/)[1];
  assert.match(header, /id="serial-connect"[\s\S]*id="upload"/);
  for (const id of ['change-device', 'change-slot', 'serial-interrupt', 'serial-reset', 'spike-stop', 'serial-clear', 'serial-connect', 'upload']) {
    assert.match(header, new RegExp('id="' + id + '"'));
    assert.equal(panel.split('id="' + id + '"').length, 2);
  }
  assert.doesNotMatch(panel, /class="device-actions"/);
  assert.equal((header.match(/aria-label=/g) || []).length, 8);
  assert.equal((header.match(/<svg/g) || []).length, 9);
  assert.match(panel, /id="deployment-device"/);
  assert.match(panel, /id="upload-status"/);
  assert.doesNotMatch(panel, /id="serial-status"/);
  assert.ok(panel.indexOf('id="upload-status"') < panel.indexOf('id="serial-panel"'));
});
