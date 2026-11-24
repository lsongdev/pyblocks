import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/hardware/wifi.js';

applyLanguage('en');

function generate(state) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(state, workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally {
    workspace.dispose();
  }
}

test('generic Wi-Fi blocks generate one shared native WLAN adapter', () => {
  const code = generate({ blocks: { languageVersion: 0, blocks: [
    { type: 'wifi_connect', inputs: {
      SSID: { block: { type: 'text', fields: { TEXT: 'school' } } },
      PASSWORD: { block: { type: 'text', fields: { TEXT: 'password' } } },
    } },
    { type: 'wifi_connected' },
    { type: 'wifi_ipv4' },
    { type: 'wifi_disconnect' },
  ] } });
  assert.match(code, /import network as _network/);
  assert.equal(code.match(/_wifi = _network.WLAN\(_network.WLAN.IF_STA\)/g)?.length, 1);
  assert.match(code, /_wifi.active\(True\)\n_wifi.connect\('school', 'password' or None\)/);
  assert.match(code, /_wifi.isconnected\(\)/);
  assert.match(code, /_wifi.ifconfig\(\)\[0\]/);
  assert.match(code, /_wifi.disconnect\(\)/);
  assert.ok(!code.includes('matrixbit'));
});

test('toolbox references generic Wi-Fi types', () => {
  const toolbox = JSON.stringify(createToolbox());
  for (const name of ['connect', 'connected', 'ipv4', 'disconnect']) {
    assert.ok(toolbox.includes(`"wifi_${name}"`));
  }
  assert.ok(!toolbox.includes('matrixbit_wifi_'));
});
