import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';

const input = (name, check = 'Number') => ({ type: 'input_value', name, check });
const pin = name => input(name, ['Number', 'String']);
const bus = input('BUS', 'I2C');
const uart = input('UART', 'UART');
const count = input('COUNT');
const address = input('ADDRESS');
const register = input('REGISTER');
const data = input('DATA', ['String', 'Array', 'Bytes']);
const statement = { previousStatement: null, nextStatement: null };
const i2cColour = 175;
const uartColour = 205;

common.defineBlocksWithJsonArray([
  { type: 'i2c_create', message0: blockMessage('i2cCreate'),
    args0: [input('ID'), pin('SCL'), pin('SDA'), input('FREQ')], output: 'I2C', colour: i2cColour },
  { type: 'i2c_scan', message0: blockMessage('i2cScan'), args0: [bus], output: 'Array', colour: i2cColour },
  { type: 'i2c_read', message0: blockMessage('i2cRead'), args0: [bus, address, count], output: 'Bytes', colour: i2cColour },
  { type: 'i2c_write', message0: blockMessage('i2cWrite'), args0: [bus, address, data], ...statement, colour: i2cColour },
  { type: 'i2c_read_register', message0: blockMessage('i2cReadRegister'),
    args0: [bus, address, register, count], output: 'Bytes', colour: i2cColour },
  { type: 'i2c_write_register', message0: blockMessage('i2cWriteRegister'),
    args0: [bus, address, register, data], ...statement, colour: i2cColour },
  {
    type: 'uart_create',
    message0: blockMessage('uartCreate'),
    args0: [input('ID'), pin('TX'), pin('RX'), input('BAUD')],
    message1: blockMessage('uartOptions'),
    args1: [
      { type: 'field_dropdown', name: 'BITS', options: [['8', '8'], ['7', '7'], ['9', '9']] },
      { type: 'field_dropdown', name: 'PARITY', options: [
        [blockMessage('uartNoParity'), 'None'], [blockMessage('uartEvenParity'), '0'], [blockMessage('uartOddParity'), '1'],
      ] },
      { type: 'field_dropdown', name: 'STOP', options: [['1', '1'], ['2', '2']] },
      input('TIMEOUT'),
    ],
    output: 'UART',
    colour: uartColour,
  },
  { type: 'uart_any', message0: blockMessage('uartAny'), args0: [uart], output: 'Boolean', colour: uartColour },
  { type: 'uart_read', message0: blockMessage('uartRead'), args0: [uart, count], output: 'Bytes', colour: uartColour },
  { type: 'uart_read_line', message0: blockMessage('uartReadLine'), args0: [uart], output: 'Bytes', colour: uartColour },
  { type: 'uart_write', message0: blockMessage('uartWrite'), args0: [uart, data], ...statement, colour: uartColour },
  { type: 'uart_close', message0: blockMessage('uartClose'), args0: [uart], ...statement, colour: uartColour },
]);

pythonGenerator.addReservedWords('_bus_pin,_bus_i2c,_bus_uart,_bus_bytes');

const value = (block, generator, name, fallback) =>
  generator.valueToCode(block, name, Order.NONE) || fallback;

function encodeData(block, generator) {
  generator.definitions_.bus_bytes = `def _bus_bytes(data):
    if isinstance(data, str):
        return data.encode("utf-8")
    return bytes(data)`;
  return `_bus_bytes(${value(block, generator, 'DATA', "b''")})`;
}

function busMethod(socket, method, args, statement = false) {
  return (block, generator) => {
    const receiver = generator.valueToCode(block, socket, Order.MEMBER);
    if (!receiver) throw new PythonBlockError(t('requiredExpression', socket === 'BUS' ? 'I2C' : t('uart')));
    const parameters = args.map(arg => arg === 'DATA'
      ? encodeData(block, generator)
      : value(block, generator, arg, arg === 'COUNT' ? '1' : '0'));
    const expression = `${receiver}.${method}(${parameters.join(', ')})`;
    return statement ? expression + '\n' : [expression, Order.FUNCTION_CALL];
  };
}

const uartAny = busMethod('UART', 'any', []);

Object.assign(pythonGenerator.forBlock, {
  i2c_create(block, generator) {
    generator.definitions_.import_bus_pin = 'from machine import Pin as _bus_pin';
    generator.definitions_.import_bus_i2c = 'from machine import I2C as _bus_i2c';
    const id = value(block, generator, 'ID', '0');
    const scl = value(block, generator, 'SCL', '22');
    const sda = value(block, generator, 'SDA', '23');
    const frequency = value(block, generator, 'FREQ', '100000');
    return [`_bus_i2c(${id}, scl=_bus_pin(${scl}), sda=_bus_pin(${sda}), freq=${frequency})`, Order.FUNCTION_CALL];
  },
  i2c_scan: busMethod('BUS', 'scan', []),
  i2c_read: busMethod('BUS', 'readfrom', ['ADDRESS', 'COUNT']),
  i2c_write: busMethod('BUS', 'writeto', ['ADDRESS', 'DATA'], true),
  i2c_read_register: busMethod('BUS', 'readfrom_mem', ['ADDRESS', 'REGISTER', 'COUNT']),
  i2c_write_register: busMethod('BUS', 'writeto_mem', ['ADDRESS', 'REGISTER', 'DATA'], true),
  uart_create(block, generator) {
    generator.definitions_.import_bus_pin = 'from machine import Pin as _bus_pin';
    generator.definitions_.import_bus_uart = 'from machine import UART as _bus_uart';
    const id = value(block, generator, 'ID', '1');
    const tx = value(block, generator, 'TX', '25');
    const rx = value(block, generator, 'RX', '26');
    const baud = value(block, generator, 'BAUD', '9600');
    const timeout = value(block, generator, 'TIMEOUT', '100');
    const bits = block.getFieldValue('BITS');
    const parity = block.getFieldValue('PARITY');
    const stop = block.getFieldValue('STOP');
    return [`_bus_uart(${id}, baudrate=${baud}, tx=_bus_pin(${tx}), rx=_bus_pin(${rx}), bits=${bits}, parity=${parity}, stop=${stop}, timeout=${timeout})`, Order.FUNCTION_CALL];
  },
  uart_any(block, generator) {
    const [expression] = uartAny(block, generator);
    return [`bool(${expression})`, Order.FUNCTION_CALL];
  },
  uart_read: busMethod('UART', 'read', ['COUNT']),
  uart_read_line: busMethod('UART', 'readline', []),
  uart_write: busMethod('UART', 'write', ['DATA'], true),
  uart_close: busMethod('UART', 'deinit', [], true),
});
