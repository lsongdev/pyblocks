import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';

const colour = 20;
const eventField = () => ({ type: 'field_dropdown', name: 'EVENT', options: [
  [blockMessage('microbitSoundLoud'), 'LOUD'], [blockMessage('microbitSoundQuiet'), 'QUIET'],
] });
common.defineBlocksWithJsonArray([
  { type: 'microbit_microphone_level', message0: blockMessage('microbitMicrophoneLevel'), output: 'Number', colour, tooltip: blockMessage('microbitMicrophoneLevelHint') },
  { type: 'microbit_sound_event', message0: blockMessage('microbitSoundEvent'), args0: [eventField()], output: 'MicrobitSoundEvent', colour, tooltip: blockMessage('microbitMicrophoneHint') },
  { type: 'microbit_microphone_current_event', message0: blockMessage('microbitMicrophoneCurrent'), output: 'MicrobitSoundEvent', colour, tooltip: blockMessage('microbitMicrophoneHint') },
  { type: 'microbit_microphone_is_event', message0: blockMessage('microbitMicrophoneIs'), args0: [eventField()], output: 'Boolean', colour, tooltip: blockMessage('microbitMicrophoneHint') },
  { type: 'microbit_microphone_was_event', message0: blockMessage('microbitMicrophoneWas'), args0: [eventField()], output: 'Boolean', colour, tooltip: blockMessage('microbitMicrophoneHistoryHint') },
  { type: 'microbit_microphone_events', message0: blockMessage('microbitMicrophoneEvents'), output: null, colour, tooltip: blockMessage('microbitMicrophoneHistoryHint') },
  { type: 'microbit_microphone_threshold', message0: blockMessage('microbitMicrophoneThreshold'), args0: [eventField(), { type: 'input_value', name: 'VALUE', check: 'Number' }], previousStatement: null, nextStatement: null, colour, tooltip: blockMessage('microbitMicrophoneThresholdHint') },
]);
pythonGenerator.addReservedWords('_microbit');
function board(generator) {
  generator.definitions_.import_microbit = 'import microbit as _microbit';
  return '_microbit';
}
const sound = (block, generator) => `${board(generator)}.SoundEvent.${block.getFieldValue('EVENT')}`;
pythonGenerator.forBlock.microbit_sound_event = (block, generator) => [sound(block, generator), Order.MEMBER];
for (const [type, method] of [['level', 'sound_level'], ['current_event', 'current_event'], ['events', 'get_events']]) {
  pythonGenerator.forBlock[`microbit_microphone_${type}`] = (_block, generator) => [`${board(generator)}.microphone.${method}()`, Order.FUNCTION_CALL];
}
for (const method of ['is_event', 'was_event']) {
  pythonGenerator.forBlock[`microbit_microphone_${method}`] = (block, generator) => [`${board(generator)}.microphone.${method}(${sound(block, generator)})`, Order.FUNCTION_CALL];
}
pythonGenerator.forBlock.microbit_microphone_threshold = (block, generator) =>
  `${board(generator)}.microphone.set_threshold(${sound(block, generator)}, int(${generator.valueToCode(block, 'VALUE', Order.NONE) || '128'}))\n`;
