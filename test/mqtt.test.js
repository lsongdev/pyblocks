import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as Blockly from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/index.js';

applyLanguage('en');
const text = TEXT => ({ type: 'text', fields: { TEXT } });
const number = NUM => ({ type: 'math_number', fields: { NUM } });
const get = id => ({ type: 'variables_get', fields: { VAR: { id } } });
const inputs = values => Object.fromEntries(Object.entries(values).map(([key, block]) => [key, { block }]));
const mqtt = (type, client = 'a', values = {}, fields = {}) => ({ type, fields, inputs: inputs({ CLIENT: get(client), ...values }) });
const variables = [
  { id: 'a', name: '客户端甲' }, { id: 'b', name: '客户端乙' },
  { id: 'topic', name: '主题' }, { id: 'message', name: '消息' }, { id: 'result', name: '收到消息' },
];
function chain(...blocks) {
  for (let i = 0; i < blocks.length - 1; i++) blocks[i].next = { block: blocks[i + 1] };
  return blocks[0];
}
function state(blocks) { return { variables, blocks: { languageVersion: 0, blocks } }; }
function generate(workspaceState) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(workspaceState, workspace);
    const code = pythonGenerator.workspaceToCode(workspace);
    assert.equal(pythonGenerator.workspaceToCode(workspace), code);
    return code;
  } finally { workspace.dispose(); }
}
function python(source) {
  const result = spawnSync('python3', ['-c', source], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}
const callback = client => mqtt('mqtt_on_message', client, {
  DO: { type: 'variables_set', fields: { VAR: { id: 'result' } }, inputs: inputs({
    VALUE: { type: 'bytes_decode_utf8', inputs: inputs({ VALUE: get('message') }) },
  }) },
}, { TOPIC_VAR: { id: 'topic' }, MESSAGE_VAR: { id: 'message' } });

const mock = `import sys, types
clients = []
class MQTTClient:
    def __init__(self, client_id, server, **options):
        self.client_id, self.server, self.options = client_id, server, options
        self.calls, self.callback = [], None
        clients.append(self)
    def connect(self): self.calls.append(('connect',))
    def set_callback(self, callback): self.callback = callback
    def subscribe(self, topic, qos=0):
        assert self.callback is not None
        self.calls.append(('subscribe', topic, qos))
    def publish(self, topic, message, retain=False, qos=0):
        self.calls.append(('publish', topic, message, retain, qos))
    def check_msg(self):
        if self.callback: self.callback('控制/灯'.encode(), '你好'.encode())
    def ping(self): self.calls.append(('ping',))
    def disconnect(self): self.calls.append(('disconnect',))
sys.modules['umqtt'] = types.ModuleType('umqtt')
sys.modules['umqtt.simple'] = types.ModuleType('umqtt.simple')
sys.modules['umqtt.simple'].MQTTClient = MQTTClient
`;

test('MQTT generates and executes native calls with UTF-8, authentication, QoS and separate clients', () => {
  const create = (id, options) => ({ type: 'variables_set', fields: { VAR: { id } }, inputs: inputs({ VALUE: {
    type: 'mqtt_create', inputs: inputs({ SERVER: text('localhost'), CLIENT_ID: text(id), ...options }),
  } }) });
  const code = generate(state([chain(
    create('a', { USER: text('用户'), PASSWORD: text(''), KEEPALIVE: number(60) }),
    create('b', {}),
    mqtt('mqtt_connect'), callback('a'),
    mqtt('mqtt_subscribe', 'a', { TOPIC: text('控制/#') }, { QOS: '1' }),
    mqtt('mqtt_publish', 'a', { TOPIC: text('数据/温度'), MESSAGE: text('你好') }, { QOS: '1', RETAIN: 'TRUE' }),
    mqtt('mqtt_publish', 'b', { TOPIC: text('binary'), MESSAGE: { type: 'python_name', fields: { NAME: 'raw_payload' } } }),
    mqtt('mqtt_check_msg'), mqtt('mqtt_ping'), mqtt('mqtt_disconnect'),
  )]));
  assert.equal(code.match(/from umqtt.simple import MQTTClient/g)?.length, 1);
  assert.match(code, /def _on_mqtt_message\(主题, 消息\):\n  global 收到消息\n  主题 = 主题.decode\('utf-8'\)/);
  assert.ok(!code.includes('global 主题'));
  assert.ok(!code.includes('umqtt.robust'));
  python(mock + `raw_payload = b'\\xff\\x00'\n` + code + `
assert clients[0].client_id == b'a'
assert clients[0].options == dict(port=1883, user='用户'.encode(), password=b'', keepalive=60)
assert clients[1].options['user'] is None
assert clients[0].calls == [('connect',), ('subscribe', '控制/#'.encode(), 1), ('publish', '数据/温度'.encode(), '你好'.encode(), True, 1), ('ping',), ('disconnect',)]
assert clients[1].calls == [('publish', b'binary', b'\\xff\\x00', False, 0)]
assert 收到消息 == '你好'
assert 主题 is None and 消息 is None
`);
});

test('callbacks have independent local parameters, preserve bytes and can read text topics', () => {
  const handler = id => mqtt('mqtt_on_message', id, { DO: { type: 'text_print', inputs: inputs({ TEXT: get('topic') }) } },
    { TOPIC_VAR: { id: 'topic' }, MESSAGE_VAR: { id: 'message' } });
  const code = generate(state([chain(handler('a'), handler('b'))]));
  python(mock + `客户端甲 = MQTTClient(b'a', 'host')
客户端乙 = MQTTClient(b'b', 'host')
` + code.replace(/^客户端[甲乙] = None\n/gm, '') + `
assert clients[0].callback is not clients[1].callback
clients[0].callback('灯/开关'.encode(), b'\\xff\\x00')
clients[1].callback('其他'.encode(), b'')
`);
});

test('network errors propagate without hidden retries and binary decoding is explicit', () => {
  const code = generate(state([mqtt('mqtt_ping')]));
  python(mock + `class Offline:
    def ping(self): raise OSError('offline')
客户端甲 = Offline()
` + `try:\n` + code.replace(/^客户端甲 = None\n/gm, '').split('\n').map(line => '    ' + line).join('\n') + `
except OSError as error:
    assert str(error) == 'offline'
else: raise AssertionError('error was swallowed')
`);
  const decode = generate(state([{ type: 'bytes_decode_utf8', inputs: inputs({ VALUE: get('message') }) }]));
  python(`消息 = b'\\xff'\ntry:\n` + decode.replace(/^消息 = None\n/gm, '').split('\n').map(line => '    ' + line).join('\n') + `
except UnicodeError: pass
else: raise AssertionError('invalid UTF-8 was accepted')
`);
});

test('missing clients, duplicate callback parameters and invalid numeric literals produce generation errors', () => {
  for (const type of ['mqtt_connect', 'mqtt_on_message', 'mqtt_publish', 'mqtt_subscribe', 'mqtt_check_msg', 'mqtt_ping', 'mqtt_disconnect']) {
    assert.throws(() => generate(state([{ type }])), /Connect an expression/);
  }
  const duplicate = callback('a');
  duplicate.fields.MESSAGE_VAR = { id: 'topic' };
  assert.throws(() => generate(state([duplicate])), /different variables/);
  for (const [key, value] of [['PORT', 0], ['PORT', 65536], ['PORT', 1.5], ['KEEPALIVE', -1], ['KEEPALIVE', 65536]]) {
    assert.throws(() => generate(state([{ type: 'mqtt_create', inputs: inputs({ [key]: number(value) }) }])), /must be an integer/);
  }
  for (const value of [0, 65535]) {
    assert.doesNotThrow(() => generate(state([{ type: 'mqtt_create', inputs: inputs({ KEEPALIVE: number(value) }) }])));
  }
});

test('MQTT and UTF-8 blocks instantiate in both languages and are available in their toolbox category', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    const category = createToolbox().contents.find(item => item.name === 'MQTT');
    assert.equal(category.contents.find(item => item.type === 'mqtt_create').inputs.SERVER.shadow.fields.TEXT, 'broker.emqx.io');
    assert.equal(category.contents.find(item => item.type === 'mqtt_subscribe').inputs.TOPIC.shadow.fields.TEXT, 'test');
    const textCategory = createToolbox().contents.find(item => item.contents?.some(entry => entry.type === 'text'));
    const conversions = textCategory.contents.filter(entry => ['bytes_encode_utf8', 'bytes_decode_utf8'].includes(entry.type));
    assert.equal(conversions.length, 2);
    assert.ok(!category.contents.some(entry => entry.type.startsWith('bytes_')));
    const workspace = new Blockly.Workspace();
    try {
      for (const entry of [...category.contents, ...conversions]) {
        const block = workspace.newBlock(entry.type);
        assert.ok(!block.toString().includes('%{BKY_'), entry.type);
      }
    } finally { workspace.dispose(); }
  }
  applyLanguage('en');
});

test('saved MQTT example generates polling, ADC publish and periodic keepalive without uploaded libraries', () => {
  const example = JSON.parse(readFileSync(new URL('../examples/mqtt-publish-subscribe.blockly.json', import.meta.url), 'utf8'));
  assert.deepEqual(example.libraries, []);
  const code = generate(example.workspace);
  assert.match(code, /while not _wifi.isconnected\(\)/);
  assert.match(code, /客户端.set_callback\(_on_mqtt_message\)/);
  assert.match(code, /客户端.subscribe/);
  assert.match(code, /客户端.check_msg\(\)/);
  assert.match(code, /_adc_type\(_adc_pin\(33\)\).read_u16\(\)/);
  assert.match(code, /客户端.ping\(\)/);
  python(`compile(${JSON.stringify(code)}, '<example>', 'exec')`);
});

test('MQTT imports and internal helpers cannot collide with saved user variable names', () => {
  const workspace = state([
    { type: 'variables_set', fields: { VAR: { id: 'internal-class' } }, inputs: inputs({ VALUE: number(7) }) },
    { type: 'variables_set', fields: { VAR: { id: 'internal-helper' } }, inputs: inputs({ VALUE: number(8) }) },
    { type: 'variables_set', fields: { VAR: { id: 'a' } }, inputs: inputs({ VALUE: { type: 'mqtt_create' } }) },
  ]);
  workspace.variables.push({ id: 'internal-class', name: '_mqtt_client' }, { id: 'internal-helper', name: '_mqtt_bytes' });
  const code = generate(workspace);
  assert.match(code, /_mqtt_client_2 = 7/);
  assert.match(code, /_mqtt_bytes_2 = 8/);
  python(mock + code + '\nassert len(clients) == 1\n');
});

test('UTF-8 conversion blocks compose and round-trip non-ASCII text', () => {
  const code = generate(state([{ type: 'variables_set', fields: { VAR: { id: 'result' } }, inputs: inputs({ VALUE: {
    type: 'bytes_decode_utf8', inputs: inputs({ VALUE: {
      type: 'bytes_encode_utf8', inputs: inputs({ VALUE: text('你好 🌡') }),
    } }),
  } }) }]));
  python(code + "\nassert 收到消息 == '你好 🌡'\n");
});
