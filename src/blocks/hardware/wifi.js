import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';

const colour = 200;
const statement = { previousStatement: null, nextStatement: null };
const mode = () => ({ type: 'field_dropdown', name: 'MODE', options: [[blockMessage('wifiStation'), 'STA'], [blockMessage('wifiAccessPoint'), 'AP']] });
const number = name => ({ type: 'input_value', name, check: 'Number' });
const text = name => ({ type: 'input_value', name, check: 'String' });

common.defineBlocksWithJsonArray([
  {
    type: 'wifi_connect',
    message0: blockMessage('wifiConnect'),
    args0: [text('SSID'), text('PASSWORD')],
    tooltip: blockMessage('wifiConnectHint'),
    inputsInline: true,
    ...statement,
    colour,
  },
  {
    type: 'wifi_connected',
    message0: blockMessage('wifiConnected'),
    tooltip: blockMessage('wifiConnectedHint'),
    output: 'Boolean',
    colour,
  },
  {
    type: 'wifi_ipv4',
    message0: blockMessage('wifiIpv4'),
    tooltip: blockMessage('wifiIpv4Hint'),
    output: 'String',
    colour,
  },
  {
    type: 'wifi_disconnect',
    message0: blockMessage('wifiDisconnect'),
    ...statement,
    colour,
  },
  { type: 'wifi_interface_power', message0: blockMessage('wifiInterfacePower'), args0: [mode(),
    { type: 'field_checkbox', name: 'ACTIVE', checked: true }], ...statement, colour, tooltip: blockMessage('wifiInterfaceHint') },
  { type: 'wifi_interface_active', message0: blockMessage('wifiInterfaceActive'), args0: [mode()], output: 'Boolean', colour },
  { type: 'wifi_scan', message0: blockMessage('wifiScan'), output: 'Array', colour, tooltip: blockMessage('wifiScanHint') },
  { type: 'wifi_scan_field', message0: blockMessage('wifiScanField'), args0: [
    { type: 'input_value', name: 'RESULT', check: 'Array' },
    { type: 'field_dropdown', name: 'FIELD', options: [
      [blockMessage('wifiSsidBytes'), '0'], ['BSSID (bytes)', '1'], [blockMessage('wifiChannel'), '2'],
      ['RSSI (dBm)', '3'], [blockMessage('wifiSecurity'), '4'], [blockMessage('wifiHidden'), '5'],
    ] },
  ], output: null, colour, tooltip: blockMessage('wifiScanFieldHint') },
  { type: 'wifi_status', message0: blockMessage('wifiStatus'), output: 'Number', colour, tooltip: blockMessage('wifiStatusHint') },
  { type: 'wifi_status_constant', message0: blockMessage('wifiStatusConstant'), args0: [
    { type: 'field_dropdown', name: 'STATUS', options: [
      ['STAT_IDLE', 'STAT_IDLE'], ['STAT_CONNECTING', 'STAT_CONNECTING'], ['STAT_GOT_IP', 'STAT_GOT_IP'],
    ] },
  ], output: 'Number', colour },
  { type: 'wifi_rssi', message0: blockMessage('wifiRssi'), output: 'Number', colour, tooltip: blockMessage('wifiRssiHint') },
  { type: 'wifi_reconnects', message0: blockMessage('wifiReconnects'), args0: [number('COUNT')], ...statement, colour,
    tooltip: blockMessage('wifiReconnectsHint') },
  { type: 'wifi_ap_config', message0: blockMessage('wifiApConfig'), args0: [text('SSID'),
    { type: 'field_dropdown', name: 'SECURITY', options: [['WPA2-PSK', 'WPA2'], [blockMessage('wifiOpen'), 'OPEN']] }, text('PASSWORD')],
    message1: blockMessage('wifiApOptions'), args1: [number('CHANNEL'), number('CLIENTS'),
      { type: 'field_checkbox', name: 'HIDDEN', checked: false }], ...statement, colour, tooltip: blockMessage('wifiApConfigHint') },
  { type: 'wifi_ap_stations', message0: blockMessage('wifiApStations'), output: 'Array', colour,
    tooltip: blockMessage('wifiApStationsHint') },
  { type: 'wifi_ap_has_clients', message0: blockMessage('wifiApHasClients'), output: 'Boolean', colour,
    tooltip: blockMessage('wifiApHasClientsHint') },
  { type: 'wifi_mac', message0: blockMessage('wifiMac'), args0: [mode()], output: 'Bytes', colour },
  { type: 'wifi_network_address', message0: blockMessage('wifiNetworkAddress'), args0: [mode(),
    { type: 'field_dropdown', name: 'FIELD', options: [['IPv4', '0'], [blockMessage('wifiSubnet'), '1'],
      [blockMessage('wifiGateway'), '2'], ['DNS', '3']] }], output: 'String', colour, tooltip: blockMessage('wifiAddressHint') },
  { type: 'wifi_set_ipv4', message0: blockMessage('wifiSetIpv4'), args0: [mode(), text('IP'), text('SUBNET')],
    message1: blockMessage('wifiSetIpv4Options'), args1: [text('GATEWAY'), text('DNS')], ...statement, colour,
    tooltip: blockMessage('wifiSetIpv4Hint') },
]);

pythonGenerator.addReservedWords('_network,_wifi,_wifi_ap');

function wifi(generator, mode = 'STA') {
  generator.definitions_.import_network = 'import network as _network';
  const name = mode === 'AP' ? '_wifi_ap' : '_wifi';
  generator.definitions_[mode === 'AP' ? 'wifi_ap' : 'wifi'] =
    `${name} = _network.WLAN(_network.WLAN.IF_${mode})`;
  return name;
}
const adapter = (block, generator) => wifi(generator, block.getFieldValue('MODE'));
function integer(block, generator, name, fallback, min, max) {
  const literal = block.getInputTargetBlock(name);
  if (literal?.type === 'math_number') {
    const value = Number(literal.getFieldValue('NUM'));
    if (!Number.isInteger(value) || value < min || value > max) throw new PythonBlockError(t('wifiRange', name, min, max));
  }
  return generator.valueToCode(block, name, Order.NONE) || fallback;
}
function literalText(block, name) {
  const child = block.getInputTargetBlock(name);
  return child?.type === 'text' ? child.getFieldValue('TEXT') : null;
}

Object.assign(pythonGenerator.forBlock, {
  wifi_interface_power: (block, generator) => `${adapter(block, generator)}.active(${block.getFieldValue('ACTIVE') === 'TRUE' ? 'True' : 'False'})\n`,
  wifi_interface_active: (block, generator) => [`${adapter(block, generator)}.active()`, Order.FUNCTION_CALL],
  wifi_scan: (_block, generator) => [`${wifi(generator)}.scan()`, Order.FUNCTION_CALL],
  wifi_scan_field(block, generator) {
    const result = generator.valueToCode(block, 'RESULT', Order.MEMBER);
    if (!result) throw new PythonBlockError(t('requiredExpression', t('wifiScanResult')));
    return [`${result}[${block.getFieldValue('FIELD')}]`, Order.MEMBER];
  },
  wifi_status: (_block, generator) => [`${wifi(generator)}.status()`, Order.FUNCTION_CALL],
  wifi_status_constant(block, generator) {
    generator.definitions_.import_network = 'import network as _network';
    return [`_network.${block.getFieldValue('STATUS')}`, Order.MEMBER];
  },
  wifi_rssi: (_block, generator) => [`${wifi(generator)}.status('rssi')`, Order.FUNCTION_CALL],
  wifi_reconnects: (block, generator) => `${wifi(generator)}.config(reconnects=${integer(block, generator, 'COUNT', '3', -1, 254)})\n`,
  wifi_ap_config(block, generator) {
    const ap = wifi(generator, 'AP');
    const ssid = generator.valueToCode(block, 'SSID', Order.NONE) || "'MicroPython-AP'";
    const key = generator.valueToCode(block, 'PASSWORD', Order.NONE) || "'change-me-123'";
    const name = literalText(block, 'SSID');
    if (name !== null && (!name || name.includes('\0') || new TextEncoder().encode(name).length > 32)) {
      throw new PythonBlockError(t('wifiApSsidInvalid'));
    }
    const open = block.getFieldValue('SECURITY') === 'OPEN';
    const password = literalText(block, 'PASSWORD');
    if (!open && password !== null && !/^[\x20-\x7e]{8,63}$/.test(password)) throw new PythonBlockError(t('wifiApKeyInvalid'));
    const channel = integer(block, generator, 'CHANNEL', '1', 1, 13);
    const clients = integer(block, generator, 'CLIENTS', '4', 1, 10);
    return `${ap}.config(ssid=${ssid}, security=_network.WLAN.SEC_${open ? 'OPEN' : 'WPA2'}, key=${open ? "''" : key}, channel=${channel}, max_clients=${clients}, hidden=${block.getFieldValue('HIDDEN') === 'TRUE' ? 'True' : 'False'})\n`;
  },
  wifi_ap_stations: (_block, generator) => [`${wifi(generator, 'AP')}.status('stations')`, Order.FUNCTION_CALL],
  wifi_ap_has_clients: (_block, generator) => [`${wifi(generator, 'AP')}.isconnected()`, Order.FUNCTION_CALL],
  wifi_mac: (block, generator) => [`${adapter(block, generator)}.config('mac')`, Order.FUNCTION_CALL],
  wifi_network_address: (block, generator) => [`${adapter(block, generator)}.ifconfig()[${block.getFieldValue('FIELD')}]`, Order.MEMBER],
  wifi_set_ipv4(block, generator) {
    const target = adapter(block, generator);
    const defaults = ['192.168.4.1', '255.255.255.0', '192.168.4.1', '8.8.8.8'];
    const values = ['IP', 'SUBNET', 'GATEWAY', 'DNS'].map((name, index) => generator.valueToCode(block, name, Order.NONE) || generator.quote_(defaults[index]));
    return `${target}.ifconfig((${values.join(', ')}))\n`;
  },

  wifi_connect: (block, generator) => {
    const adapter = wifi(generator);
    const ssid = generator.valueToCode(block, 'SSID', Order.NONE) || "''";
    const password = generator.valueToCode(block, 'PASSWORD', Order.LOGICAL_OR) || "''";
    return `${adapter}.active(True)\n${adapter}.connect(${ssid}, ${password} or None)\n`;
  },
  wifi_connected: (_block, generator) => [
    `${wifi(generator)}.isconnected()`, Order.FUNCTION_CALL,
  ],
  wifi_ipv4: (_block, generator) => {
    const adapter = wifi(generator);
    return [`${adapter}.ifconfig()[0] if ${adapter}.isconnected() else ''`, Order.CONDITIONAL];
  },
  wifi_disconnect: (_block, generator) => {
    const adapter = wifi(generator);
    return `if ${adapter}.active():\n${generator.INDENT}${adapter}.disconnect()\n`;
  },
});
