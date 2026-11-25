import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';

const colour = 20;
const statement = { previousStatement: null, nextStatement: null, colour };
const input = (name, check) => ({ type: 'input_value', name, ...(check ? { check } : {}) });
common.defineBlocksWithJsonArray([
  {
    type: 'microbit_radio_power', message0: blockMessage('microbitRadioPower'),
    args0: [{ type: 'field_dropdown', name: 'POWER', options: [[blockMessage('powerOn'), 'on'], [blockMessage('powerOff'), 'off']] }],
    tooltip: blockMessage('microbitRadioHint'), ...statement,
  },
  {
    type: 'microbit_radio_config', message0: blockMessage('microbitRadioConfig'),
    args0: ['GROUP', 'CHANNEL', 'POWER'].map(name => input(name, 'Number')),
    tooltip: blockMessage('microbitRadioConfigHint'), ...statement,
  },
  {
    type: 'microbit_radio_buffers', message0: blockMessage('microbitRadioBuffers'),
    args0: ['LENGTH', 'QUEUE'].map(name => input(name, 'Number')),
    tooltip: blockMessage('microbitRadioBuffersHint'), ...statement,
  },
  { type: 'microbit_radio_reset', message0: blockMessage('microbitRadioReset'), ...statement },
  { type: 'microbit_radio_send', message0: blockMessage('microbitRadioSend'), args0: [input('MESSAGE', 'String')], tooltip: blockMessage('microbitRadioTextHint'), ...statement },
  { type: 'microbit_radio_receive', message0: blockMessage('microbitRadioReceive'), output: null, colour, tooltip: blockMessage('microbitRadioReceiveHint') },
  { type: 'microbit_radio_send_bytes', message0: blockMessage('microbitRadioSendBytes'), args0: [input('MESSAGE', 'Bytes')], ...statement },
  { type: 'microbit_radio_receive_bytes', message0: blockMessage('microbitRadioReceiveBytes'), output: null, colour, tooltip: blockMessage('microbitRadioReceiveHint') },
  { type: 'microbit_radio_receive_full', message0: blockMessage('microbitRadioReceiveFull'), output: null, colour, tooltip: blockMessage('microbitRadioFullHint') },
]);
pythonGenerator.addReservedWords('_microbit_radio');
function radio(generator) {
  generator.definitions_.import_microbit_radio = 'import radio as _microbit_radio';
  return '_microbit_radio';
}
const number = (block, generator, name, fallback) => `int(${generator.valueToCode(block, name, Order.NONE) || fallback})`;
pythonGenerator.forBlock.microbit_radio_power = (block, generator) => `${radio(generator)}.${block.getFieldValue('POWER')}()\n`;
pythonGenerator.forBlock.microbit_radio_config = (block, generator) => `${radio(generator)}.config(group=${number(block, generator, 'GROUP', '0')}, channel=${number(block, generator, 'CHANNEL', '7')}, power=${number(block, generator, 'POWER', '6')})\n`;
pythonGenerator.forBlock.microbit_radio_buffers = (block, generator) => `${radio(generator)}.config(length=${number(block, generator, 'LENGTH', '32')}, queue=${number(block, generator, 'QUEUE', '3')})\n`;
pythonGenerator.forBlock.microbit_radio_reset = (_block, generator) => `${radio(generator)}.reset()\n`;
for (const method of ['send', 'send_bytes']) {
  pythonGenerator.forBlock[`microbit_radio_${method}`] = (block, generator) =>
    `${radio(generator)}.${method}(${generator.valueToCode(block, 'MESSAGE', Order.NONE) || (method === 'send' ? "''" : "b''")})\n`;
}
for (const method of ['receive', 'receive_bytes', 'receive_full']) {
  pythonGenerator.forBlock[`microbit_radio_${method}`] = (_block, generator) => [`${radio(generator)}.${method}()`, Order.FUNCTION_CALL];
}
