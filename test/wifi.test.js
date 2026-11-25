import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/python/names.js';
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

const inputs = values => Object.fromEntries(Object.entries(values).map(([key, block]) => [key, { block }]));
const text = TEXT => ({ type: 'text', fields: { TEXT } });
const num = NUM => ({ type: 'math_number', fields: { NUM } });
const block = (type, fields = {}, values = {}) => ({ type, fields, inputs: inputs(values) });
const get = id => block('variables_get', { VAR: { id } });
function chain(...blocks) {
  for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
  return blocks[0];
}
const state = blocks => ({ variables: [{ id: 'scan', name: '扫描结果' }, { id: 'row', name: '网络条目' }], blocks: { languageVersion: 0, blocks } });
const mock = `import sys, types
interfaces = {}
class WLAN:
    IF_STA, IF_AP, SEC_OPEN, SEC_WPA2 = 0, 1, 0, 3
    def __init__(self, mode):
        assert mode not in interfaces, 'interface initialized twice'
        interfaces[mode] = self
        self.mode, self.enabled, self.connected = mode, False, False
        self.calls, self.options = [], {}
        self.addresses = ('192.168.4.1', '255.255.255.0', '192.168.4.1', '8.8.8.8')
    def active(self, value=None):
        if value is not None:
            self.enabled = value
            self.calls.append(('active', value))
        return self.enabled
    def config(self, query=None, **kwargs):
        if query == 'mac': return b'123456'
        self.options.update(kwargs)
        self.calls.append(('config', kwargs))
    def scan(self):
        assert self.mode == self.IF_STA and self.enabled
        self.calls.append(('scan',))
        return [(b'\\xff', b'abcdef', 6, -58, 3, False)]
    def status(self, param=None):
        if param == 'stations':
            assert self.mode == self.IF_AP
            return []
        if param == 'rssi':
            if not self.connected: raise OSError('not connected')
            return -58
        return 1001
    def isconnected(self): return self.connected
    def ifconfig(self, value=None):
        if value is not None: self.addresses = value
        return self.addresses
sys.modules['network'] = types.SimpleNamespace(WLAN=WLAN, STAT_IDLE=1000, STAT_CONNECTING=1001, STAT_GOT_IP=1010)
`;
function python(source) {
  const result = spawnSync('python3', ['-c', source], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}

test('scan uses active STA, returns original bytes and reads every native tuple field without rescanning', () => {
  const code = generate(state([chain(
    block('wifi_interface_power'),
    block('variables_set', { VAR: { id: 'scan' } }, { VALUE: block('wifi_scan') }),
    block('variables_set', { VAR: { id: 'row' } }, { VALUE: block('lists_getIndex', { MODE: 'GET', WHERE: 'FIRST' }, { VALUE: get('scan') }) }),
    ...['0', '1', '2', '3', '4', '5'].map(FIELD => block('text_print', {}, { TEXT: block('wifi_scan_field', { FIELD }, { RESULT: get('row') }) })),
  )]));
  assert.equal(code.match(/_wifi.scan\(\)/g)?.length, 1);
  assert.ok(!code.includes('.decode('));
  python(mock + code + `
assert 扫描结果 == [(b'\\xff', b'abcdef', 6, -58, 3, False)]
assert interfaces[0].calls == [('active', True), ('scan',)]
`);
});

test('AP configuration and power are distinct, with independent STA and AP adapters', () => {
  const code = generate(state([chain(
    block('wifi_interface_power', { MODE: 'STA' }),
    block('wifi_ap_config', { HIDDEN: 'TRUE' }, { SSID: text('测试热点'), PASSWORD: text('test-password'), CHANNEL: num(6), CLIENTS: num(4) }),
    block('wifi_interface_power', { MODE: 'AP' }),
    block('text_print', {}, { TEXT: block('wifi_network_address', { MODE: 'AP' }) }),
    block('text_print', {}, { TEXT: block('wifi_ap_has_clients') }),
    block('text_print', {}, { TEXT: block('wifi_ap_stations') }),
    block('wifi_interface_power', { MODE: 'AP', ACTIVE: 'FALSE' }),
  )]));
  assert.equal(code.match(/_wifi_ap = _network.WLAN/g)?.length, 1);
  assert.equal(code.match(/import network as _network/g)?.length, 1);
  python(mock + code + `
assert interfaces[0].enabled
assert not interfaces[1].enabled
assert interfaces[1].options == dict(ssid='测试热点', security=WLAN.SEC_WPA2, key='test-password', channel=6, max_clients=4, hidden=True)
assert interfaces[1].calls[0][0] == 'config'
assert interfaces[1].calls[1:] == [('active', True), ('active', False)]
`);
});

test('open AP mode is explicit and discards the supplied key', () => {
  const code = generate(state([block('wifi_ap_config', { SECURITY: 'OPEN' }, { PASSWORD: text('short') })]));
  assert.match(code, /security=_network.WLAN.SEC_OPEN, key=''/);
  python(mock + code + '\nassert interfaces[1].options["key"] == ""\nassert not interfaces[1].enabled\n');
});

test('interface addressing, status constants, retry configuration and RSSI preserve native calls', () => {
  const code = generate(state([chain(
    block('wifi_reconnects', {}, { COUNT: num(-1) }),
    block('wifi_set_ipv4', { MODE: 'AP' }, { IP: text('10.0.0.1'), SUBNET: text('255.255.255.0'), GATEWAY: text('10.0.0.1'), DNS: text('1.1.1.1') }),
    block('text_print', {}, { TEXT: block('wifi_status') }),
    block('text_print', {}, { TEXT: block('wifi_status_constant', { STATUS: 'STAT_CONNECTING' }) }),
    block('text_print', {}, { TEXT: block('wifi_mac', { MODE: 'AP' }) }),
    block('text_print', {}, { TEXT: block('wifi_interface_active', { MODE: 'AP' }) }),
  )]));
  python(mock + code + `
assert interfaces[0].options['reconnects'] == -1
assert interfaces[1].addresses == ('10.0.0.1','255.255.255.0','10.0.0.1','1.1.1.1')
`);
  const rssi = generate(state([block('wifi_rssi')]));
  python(mock + 'try:\n' + rssi.split('\n').map(line => '    ' + line).join('\n') + `
except OSError as error: assert str(error) == 'not connected'
else: raise AssertionError('native failure was hidden')
`);
});

test('AP literal validation covers UTF-8 SSID lengths, passwords, channel and reconnect bounds', () => {
  for (const values of [{ SSID: text('') }, { SSID: text('中'.repeat(11)) }, { SSID: text('x\u0000y') },
    { PASSWORD: text('short') }, { PASSWORD: text('密码12345678') }, { PASSWORD: text('x'.repeat(64)) },
    { CHANNEL: num(0) }, { CHANNEL: num(14) }, { CLIENTS: num(0) }, { CLIENTS: num(11) }]) {
    assert.throws(() => generate(state([block('wifi_ap_config', {}, values)])));
  }
  assert.doesNotThrow(() => generate(state([block('wifi_ap_config', {}, { SSID: text('中'.repeat(10)), PASSWORD: text('x'.repeat(63)) })])));
  for (const COUNT of [-2, 255, 0.5]) assert.throws(() => generate(state([block('wifi_reconnects', {}, { COUNT: num(COUNT) })])));
  assert.throws(() => generate(state([block('wifi_scan_field')])), /Connect an expression/);
});

test('Wi-Fi toolbox and examples generate in both languages with explicit AP and scan groups', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    const category = createToolbox().contents.find(item => item.contents?.some(entry => entry.type === 'wifi_scan'));
    assert.ok(category.contents.some(entry => entry.kind === 'label'));
    for (const entry of category.contents.filter(entry => entry.type)) {
      if (entry.type === 'wifi_scan_field') continue;
      assert.doesNotThrow(() => generate(state([entry])));
    }
    for (const filename of ['wifi-scan.blockly.json', 'wifi-ap.blockly.json']) {
      const project = JSON.parse(readFileSync(new URL(`../examples/${filename}`, import.meta.url), 'utf8'));
      const code = generate(project.workspace);
      python(`compile(${JSON.stringify(code)}, '<example>', 'exec')`);
    }
  }
  applyLanguage('en');
});
