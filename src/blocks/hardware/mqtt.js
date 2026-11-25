import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';
import { eventHandler } from '../../python/events.js';

const colour = 200;
const input = (name, check) => ({ type: 'input_value', name, check });
const client = () => input('CLIENT', 'MQTTClient');
const text = name => input(name, 'String');
const statement = { previousStatement: null, nextStatement: null };
const qos = () => ({ type: 'field_dropdown', name: 'QOS', options: [['0', '0'], ['1', '1']] });

common.defineBlocksWithJsonArray([
  {
    type: 'mqtt_create', message0: blockMessage('mqttCreate'),
    args0: [text('SERVER'), input('PORT', 'Number'), text('CLIENT_ID')],
    message1: blockMessage('mqttCredentials'),
    args1: [text('USER'), text('PASSWORD'), input('KEEPALIVE', 'Number')],
    output: 'MQTTClient', colour, tooltip: blockMessage('mqttCreateHint'),
  },
  { type: 'mqtt_connect', message0: blockMessage('mqttConnect'), args0: [client()],
    ...statement, colour, tooltip: blockMessage('mqttConnectHint') },
  {
    type: 'mqtt_on_message', message0: blockMessage('mqttOnMessage'), args0: [client()],
    message1: blockMessage('mqttParameters'), args1: [
      { type: 'field_variable', name: 'TOPIC_VAR', variable: 'topic' },
      { type: 'field_variable', name: 'MESSAGE_VAR', variable: 'message' },
    ],
    message2: blockMessage('buttonEventBody'), args2: [{ type: 'input_statement', name: 'DO' }],
    ...statement, colour, tooltip: blockMessage('mqttOnMessageHint'),
  },
  { type: 'mqtt_subscribe', message0: blockMessage('mqttSubscribe'),
    args0: [client(), text('TOPIC'), qos()], ...statement, colour,
    tooltip: blockMessage('mqttSubscribeHint') },
  { type: 'mqtt_publish', message0: blockMessage('mqttPublish'),
    args0: [client(), text('TOPIC'), input('MESSAGE', ['String', 'Bytes'])],
    message1: blockMessage('mqttPublishOptions'), args1: [qos(), { type: 'field_checkbox', name: 'RETAIN', checked: false }],
    ...statement, colour, tooltip: blockMessage('mqttPublishHint') },
  ...[
    ['mqtt_check_msg', 'mqttCheck', 'mqttCheckHint'],
    ['mqtt_ping', 'mqttPing', 'mqttPingHint'],
    ['mqtt_disconnect', 'mqttDisconnect', 'mqttDisconnectHint'],
  ].map(([type, message, hint]) => ({ type, message0: blockMessage(message), args0: [client()],
    ...statement, colour, tooltip: blockMessage(hint) })),
]);

pythonGenerator.addReservedWords('_mqtt_client,_mqtt_bytes');

function value(block, generator, name, fallback) {
  return generator.valueToCode(block, name, Order.NONE) || fallback;
}

function receiver(block, generator) {
  const code = generator.valueToCode(block, 'CLIENT', Order.MEMBER);
  if (!code) throw new PythonBlockError(t('requiredExpression', t('mqttClient')));
  return code;
}

function bytes(generator, code) {
  generator.definitions_.mqtt_bytes = `def _mqtt_bytes(value):
    return value.encode('utf-8') if isinstance(value, str) else value`;
  return `_mqtt_bytes(${code})`;
}

function integer(block, generator, name, fallback, minimum, maximum) {
  const literal = block.getInputTargetBlock(name);
  if (literal?.type === 'math_number') {
    const number = Number(literal.getFieldValue('NUM'));
    if (!Number.isInteger(number) || number < minimum || number > maximum) {
      throw new PythonBlockError(t('mqttRange', name, minimum, maximum));
    }
  }
  return value(block, generator, name, fallback);
}

Object.assign(pythonGenerator.forBlock, {
  mqtt_create(block, generator) {
    generator.definitions_.import_mqtt = 'from umqtt.simple import MQTTClient as _mqtt_client';
    const id = bytes(generator, value(block, generator, 'CLIENT_ID', "'blockly-client'"));
    const server = value(block, generator, 'SERVER', "'broker.emqx.io'");
    const port = integer(block, generator, 'PORT', '1883', 1, 65535);
    const keepalive = integer(block, generator, 'KEEPALIVE', '60', 0, 65535);
    const user = bytes(generator, value(block, generator, 'USER', "''"));
    const password = bytes(generator, value(block, generator, 'PASSWORD', "''"));
    return [`_mqtt_client(${id}, ${server}, port=${port}, user=${user} or None, password=${password}, keepalive=${keepalive})`, Order.FUNCTION_CALL];
  },
  mqtt_on_message(block, generator) {
    const target = receiver(block, generator);
    const topic = generator.getVariableName(block.getFieldValue('TOPIC_VAR'));
    const message = generator.getVariableName(block.getFieldValue('MESSAGE_VAR'));
    if (topic === message) throw new PythonBlockError(t('mqttDistinctParameters'));
    const { name, code } = eventHandler(block, generator, '_on_mqtt_message', {
      parameters: [topic, message],
      setup: `${generator.INDENT}${topic} = ${topic}.decode('utf-8')\n`,
    });
    return code + `${target}.set_callback(${name})\n`;
  },
  mqtt_subscribe(block, generator) {
    const target = receiver(block, generator);
    const topic = bytes(generator, value(block, generator, 'TOPIC', "'test'"));
    return `${target}.subscribe(${topic}, qos=${block.getFieldValue('QOS')})\n`;
  },
  mqtt_publish(block, generator) {
    const target = receiver(block, generator);
    const topic = bytes(generator, value(block, generator, 'TOPIC', "''"));
    const message = bytes(generator, value(block, generator, 'MESSAGE', "b''"));
    return `${target}.publish(${topic}, ${message}, retain=${block.getFieldValue('RETAIN') === 'TRUE' ? 'True' : 'False'}, qos=${block.getFieldValue('QOS')})\n`;
  },
  ...Object.fromEntries([
    ['mqtt_connect', 'connect'], ['mqtt_check_msg', 'check_msg'],
    ['mqtt_ping', 'ping'], ['mqtt_disconnect', 'disconnect'],
  ].map(([type, method]) => [type, (block, generator) => `${receiver(block, generator)}.${method}()\n`])),
});
