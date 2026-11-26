import { common, Extensions } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';

const colour = 20;
const statement = { previousStatement: null, nextStatement: null };
const value = name => ({ type: 'input_value', name, check: 'Number' });

const pin = {
  type: 'field_dropdown',
  name: 'PIN',
  options: Array.from({ length: 21 }, (_, index) => index)
    .filter(index => index !== 17 && index !== 18)
    .map(index => [`P${index}`, String(index)]),
};

const analogPin = {
  ...pin,
  options: [0, 1, 2, 3, 4, 10].map(index => [`P${index}`, String(index)]),
};

const button = { type: 'field_dropdown', name: 'BUTTON', options: [['A', 'a'], ['B', 'b']] };

Extensions.register('microbit_image_rows', function () {
  for (let row = 0; row < 5; row++) {
    this.getField(`ROW${row}`).setValidator(text => /^[0-9]{5}$/.test(text) ? text : null);
  }
});

const imageInput = { type: 'input_value', name: 'IMAGE', check: 'MicrobitImage' };
const checkbox = name => ({ type: 'field_checkbox', name, checked: name === 'WAIT' });

const musicPin = { type: 'field_dropdown', name: 'PIN', options: ['0', '1', '2'].map(pin => [`P${pin}`, pin]) };

common.defineBlocksWithJsonArray([
  {
    type: 'microbit_music_pitch', message0: blockMessage('microbitMusicPitch'),
    args0: [value('FREQ'), value('DURATION'), musicPin, checkbox('WAIT')],
    tooltip: blockMessage('microbitMusicPitchHint'), ...statement, colour,
  },
  {
    type: 'microbit_music_melody', message0: blockMessage('microbitMusicMelody'),
    args0: [{ type: 'field_dropdown', name: 'MELODY', options: [
      'BA_DING', 'BIRTHDAY', 'DADADADUM', 'ENTERTAINER', 'PRELUDE', 'ODE', 'NYAN',
      'RINGTONE', 'FUNK', 'BLUES', 'WEDDING', 'FUNERAL', 'PUNCHLINE', 'PYTHON',
      'BADDY', 'CHASE', 'WAWAWAWAA', 'JUMP_UP', 'JUMP_DOWN', 'POWER_UP', 'POWER_DOWN',
    ].map(name => [name, name]) }],
    output: 'Array', colour,
  },
  {
    type: 'microbit_music_play', message0: blockMessage('microbitMusicPlay'),
    args0: [{ type: 'input_value', name: 'NOTES', check: ['String', 'Array'] }],
    message1: blockMessage('microbitMusicPlayOptions'), args1: [musicPin, checkbox('WAIT'), checkbox('LOOP')],
    tooltip: blockMessage('microbitMusicPlayHint'), ...statement, colour,
  },
  {
    type: 'microbit_music_stop', message0: blockMessage('microbitMusicStop'),
    args0: [musicPin], ...statement, colour,
  },
  {
    type: 'microbit_music_tempo', message0: blockMessage('microbitMusicTempo'),
    args0: [value('BPM'), value('TICKS')], ...statement, colour,
  },
  {
    type: 'microbit_music_volume', message0: blockMessage('microbitMusicVolume'), tooltip: blockMessage('microbitMusicVolumeHint'),
    args0: [value('VOLUME')], ...statement, colour,
  },
  {
    type: 'microbit_speaker_power', message0: blockMessage('microbitSpeakerPower'),
    args0: [{ type: 'field_dropdown', name: 'POWER', options: [
      [blockMessage('powerOn'), 'on'], [blockMessage('powerOff'), 'off'],
    ] }], ...statement, colour,
  },
  {
    type: 'microbit_image_builtin',
    message0: blockMessage('microbitImageBuiltin'),
    args0: [{ type: 'field_dropdown', name: 'IMAGE', options: [
      'HEART', 'HEART_SMALL', 'HAPPY', 'SMILE', 'SAD', 'CONFUSED', 'ANGRY', 'ASLEEP',
      'SURPRISED', 'YES', 'NO', 'DIAMOND', 'DIAMOND_SMALL', 'SQUARE', 'SQUARE_SMALL',
      'ARROW_N', 'ARROW_NE', 'ARROW_E', 'ARROW_SE', 'ARROW_S', 'ARROW_SW', 'ARROW_W', 'ARROW_NW',
    ].map(name => [name, name]) }],
    output: 'MicrobitImage', colour,
  },
  {
    type: 'microbit_image_custom',
    ...Object.fromEntries(Array.from({ length: 5 }, (_, row) => [
      [`message${row}`, blockMessage(row === 0 ? 'microbitImageRowFirst' : 'microbitImageRow')],
      [`args${row}`, [{ type: 'field_input', name: `ROW${row}`, text: ['09090', '99999', '99999', '09990', '00900'][row] }]],
    ]).flat()),
    tooltip: blockMessage('microbitImageCustomHint'),
    extensions: ['microbit_image_rows'], output: 'MicrobitImage', colour,
  },
  {
    type: 'microbit_image_transform',
    message0: blockMessage('microbitImageTransform'),
    args0: [imageInput, { type: 'field_dropdown', name: 'METHOD', options: [
      [blockMessage('microbitImageCopy'), 'copy'], [blockMessage('microbitImageInvert'), 'invert'],
    ] }],
    inputsInline: true, output: 'MicrobitImage', colour,
  },
  {
    type: 'microbit_image_shift',
    message0: blockMessage('microbitImageShift'),
    args0: [imageInput, { type: 'field_dropdown', name: 'DIRECTION', options: [
      [blockMessage('microbitLeft'), 'left'], [blockMessage('microbitRight'), 'right'],
      [blockMessage('microbitUp'), 'up'], [blockMessage('microbitDown'), 'down'],
    ] }, value('AMOUNT')],
    inputsInline: true, output: 'MicrobitImage', colour,
  },
  {
    type: 'microbit_show', message0: blockMessage('microbitShow'),
    args0: [{ type: 'input_value', name: 'IMAGE', check: ['MicrobitImage', 'Array', 'String', 'Number'] }],
    message1: blockMessage('microbitShowOptions'),
    args1: [value('DELAY'), checkbox('WAIT'), checkbox('LOOP')],
    tooltip: blockMessage('microbitShowHint'), ...statement, colour,
  },
  {
    type: 'microbit_scroll', message0: blockMessage('microbitScroll'),
    args0: [{ type: 'input_value', name: 'TEXT', check: ['String', 'Number'] }],
    message1: blockMessage('microbitShowOptions'),
    args1: [value('DELAY'), checkbox('WAIT'), checkbox('LOOP')],
    ...statement, colour,
  },
  {
    type: 'microbit_display_power', message0: blockMessage('microbitDisplayPower'),
    args0: [{ type: 'field_dropdown', name: 'POWER', options: [
      [blockMessage('powerOn'), 'on'], [blockMessage('powerOff'), 'off'],
    ] }],
    tooltip: blockMessage('microbitDisplayPowerHint'), ...statement, colour,
  },
  {
    type: 'microbit_display_is_on', message0: blockMessage('microbitDisplayIsOn'),
    output: 'Boolean', colour,
  },
  ...[
    ['microbit_light_level', 'microbitLightLevel'],
    ['microbit_temperature', 'microbitTemperature'],
    ['microbit_running_time', 'microbitRunningTime'],
  ].map(([type, message]) => ({ type, message0: blockMessage(message), output: 'Number', colour })),
  {
    type: 'microbit_acceleration', message0: blockMessage('microbitAcceleration'),
    args0: [{ type: 'field_dropdown', name: 'AXIS', options: ['x', 'y', 'z'].map(axis => [axis.toUpperCase(), axis]) }],
    output: 'Number', colour,
  },
  {
    type: 'microbit_set_pixel',
    message0: blockMessage('matrixSetPixel'),
    args0: [value('X'), value('Y'), value('BRIGHTNESS')],
    tooltip: blockMessage('matrixSetPixelHint'),
    inputsInline: true,
    ...statement,
    colour,
  },
  {
    type: 'microbit_get_pixel',
    message0: blockMessage('matrixGetPixel'),
    args0: [value('X'), value('Y')],
    tooltip: blockMessage('matrixGetPixelHint'),
    inputsInline: true,
    output: 'Number',
    colour,
  },
  {
    type: 'microbit_clear_display',
    message0: blockMessage('matrixClear'),
    ...statement,
    colour,
  },
  {
    type: 'microbit_read_digital',
    message0: blockMessage('pinRead'),
    args0: [pin],
    tooltip: blockMessage('microbitPinReadHint'),
    output: 'Number',
    colour,
  },
  {
    type: 'microbit_read_analog',
    message0: blockMessage('microbitPinReadAnalog'),
    args0: [analogPin],
    tooltip: blockMessage('microbitPinReadAnalogHint'),
    output: 'Number',
    colour,
  },
  {
    type: 'microbit_write_digital',
    message0: blockMessage('pinWrite'),
    args0: [
      pin,
      {
        type: 'field_dropdown',
        name: 'LEVEL',
        options: [[blockMessage('pinLow'), '0'], [blockMessage('pinHigh'), '1']],
      },
    ],
    tooltip: blockMessage('microbitPinWriteHint'),
    ...statement,
    colour,
  },
  {
    type: 'microbit_write_analog',
    message0: blockMessage('microbitPinWriteAnalog'),
    args0: [pin, value('DUTY')],
    tooltip: blockMessage('microbitPinWriteAnalogHint'),
    inputsInline: true,
    ...statement,
    colour,
  },
  {
    type: 'microbit_set_analog_period',
    message0: blockMessage('microbitPinAnalogPeriod'),
    args0: [pin, value('PERIOD'), {
      type: 'field_dropdown', name: 'UNIT', options: [
        [blockMessage('milliseconds'), 'ms'], [blockMessage('microseconds'), 'us'],
      ],
    }],
    tooltip: blockMessage('microbitPinAnalogPeriodHint'),
    inputsInline: true,
    ...statement,
    colour,
  },
  {
    type: 'microbit_set_pull',
    message0: blockMessage('microbitPinSetPull'),
    args0: [pin, {
      type: 'field_dropdown', name: 'PULL', options: [
        [blockMessage('pullDown'), 'PULL_DOWN'],
        [blockMessage('pullUp'), 'PULL_UP'],
        [blockMessage('pullNone'), 'NO_PULL'],
      ],
    }],
    tooltip: blockMessage('microbitPinSetPullHint'),
    ...statement,
    colour,
  },
  {
    type: 'microbit_button_is_pressed',
    message0: blockMessage('buttonIsPressed'),
    args0: [button],
    output: 'Boolean',
    colour,
  },
  {
    type: 'microbit_button_was_pressed',
    message0: blockMessage('buttonWasPressed'),
    args0: [button],
    tooltip: blockMessage('buttonWasPressedHint'),
    output: 'Boolean',
    colour,
  },
  {
    type: 'microbit_button_press_count',
    message0: blockMessage('buttonPressCount'),
    args0: [button],
    tooltip: blockMessage('buttonPressCountHint'),
    output: 'Number',
    colour,
  },
  {
    type: 'microbit_logo_is_touched',
    message0: blockMessage('microbitLogoIsTouched'),
    tooltip: blockMessage('microbitLogoTouchHint'),
    output: 'Boolean',
    colour,
  },

]);

pythonGenerator.addReservedWords('_microbit_display,_microbit,_microbit_music');

function displayCall(generator, method, args = []) {
  generator.definitions_.import_microbit_display = 'from microbit import display as _microbit_display';
  return `_microbit_display.${method}(${args.join(', ')})`;
}

function microbitModule(generator) {
  generator.definitions_.import_microbit = 'import microbit as _microbit';
  return '_microbit';
}

function musicModule(generator) {
  generator.definitions_.import_microbit_music = 'import music as _microbit_music';
  return '_microbit_music';
}

function booleanField(block, name) {
  return block.getFieldValue(name) === 'TRUE' ? 'True' : 'False';
}

function edgePin(block, generator) {
  return `${microbitModule(generator)}.pin${block.getFieldValue('PIN')}`;
}

function buttonCall(block, generator, method) {
  return [`${microbitModule(generator)}.button_${block.getFieldValue('BUTTON')}.${method}()`, Order.FUNCTION_CALL];
}

function integers(block, generator, inputs) {
  return inputs.map(name => `int(${generator.valueToCode(block, name, Order.NONE) || '0'})`);
}

function imageCode(block, generator) {
  return generator.valueToCode(block, 'IMAGE', Order.MEMBER) || `${microbitModule(generator)}.Image()`;
}

function displayOptions(block, generator) {
  const [delay] = integers(block, generator, ['DELAY']);
  const flag = name => block.getFieldValue(name) === 'TRUE' ? 'True' : 'False';
  return [ `delay=${delay}`, `wait=${flag('WAIT')}`, `loop=${flag('LOOP')}` ];
}

Object.assign(pythonGenerator.forBlock, {
  microbit_logo_is_touched: (_block, generator) => [
    `${microbitModule(generator)}.pin_logo.is_touched()`, Order.FUNCTION_CALL,
  ],
  microbit_music_pitch: (block, generator) => {
    const [frequency, duration] = integers(block, generator, ['FREQ', 'DURATION']);
    return `${musicModule(generator)}.pitch(${frequency}, ${duration}, pin=${edgePin(block, generator)}, wait=${booleanField(block, 'WAIT')})\n`;
  },
  microbit_music_melody: (block, generator) => [
    `${musicModule(generator)}.${block.getFieldValue('MELODY')}`, Order.MEMBER,
  ],
  microbit_music_play: (block, generator) => {
    const notes = generator.valueToCode(block, 'NOTES', Order.NONE) || '[]';
    return `${musicModule(generator)}.play(${notes}, pin=${edgePin(block, generator)}, wait=${booleanField(block, 'WAIT')}, loop=${booleanField(block, 'LOOP')})\n`;
  },
  microbit_music_stop: (block, generator) => `${musicModule(generator)}.stop(${edgePin(block, generator)})\n`,
  microbit_music_tempo: (block, generator) => {
    const [bpm, ticks] = integers(block, generator, ['BPM', 'TICKS']);
    return `${musicModule(generator)}.set_tempo(ticks=${ticks}, bpm=${bpm})\n`;
  },
  microbit_music_volume: (block, generator) =>
    `${microbitModule(generator)}.set_volume(max(0, min(255, ${integers(block, generator, ['VOLUME'])[0]})))\n`,
  microbit_speaker_power: (block, generator) =>
    `${microbitModule(generator)}.speaker.${block.getFieldValue('POWER')}()\n`,
  microbit_image_builtin: (block, generator) => [
    `${microbitModule(generator)}.Image.${block.getFieldValue('IMAGE')}`, Order.MEMBER,
  ],
  microbit_image_custom: (block, generator) => [
    `${microbitModule(generator)}.Image(${generator.quote_(Array.from({ length: 5 }, (_, row) => block.getFieldValue(`ROW${row}`)).join(':'))})`,
    Order.FUNCTION_CALL,
  ],
  microbit_image_transform: (block, generator) => [
    `${imageCode(block, generator)}.${block.getFieldValue('METHOD')}()`, Order.FUNCTION_CALL,
  ],
  microbit_image_shift: (block, generator) => [
    `${imageCode(block, generator)}.shift_${block.getFieldValue('DIRECTION')}(${integers(block, generator, ['AMOUNT'])[0]})`,
    Order.FUNCTION_CALL,
  ],
  microbit_show: (block, generator) => {
    const content = generator.valueToCode(block, 'IMAGE', Order.NONE) || `${microbitModule(generator)}.Image()`;
    return `${displayCall(generator, 'show', [content, ...displayOptions(block, generator)])}\n`;
  },
  microbit_scroll: (block, generator) => {
    const text = generator.valueToCode(block, 'TEXT', Order.NONE) || "''";
    return `${displayCall(generator, 'scroll', [text, ...displayOptions(block, generator)])}\n`;
  },
  microbit_display_power: (block, generator) => `${displayCall(generator, block.getFieldValue('POWER'))}\n`,
  microbit_display_is_on: (_block, generator) => [displayCall(generator, 'is_on'), Order.FUNCTION_CALL],
  microbit_light_level: (_block, generator) => [displayCall(generator, 'read_light_level'), Order.FUNCTION_CALL],
  microbit_temperature: (_block, generator) => [`${microbitModule(generator)}.temperature()`, Order.FUNCTION_CALL],
  microbit_running_time: (_block, generator) => [`${microbitModule(generator)}.running_time()`, Order.FUNCTION_CALL],
  microbit_acceleration: (block, generator) => [
    `${microbitModule(generator)}.accelerometer.get_${block.getFieldValue('AXIS')}()`, Order.FUNCTION_CALL,
  ],
  microbit_button_is_pressed: (block, generator) => buttonCall(block, generator, 'is_pressed'),
  microbit_button_was_pressed: (block, generator) => buttonCall(block, generator, 'was_pressed'),
  microbit_button_press_count: (block, generator) => buttonCall(block, generator, 'get_presses'),
  microbit_set_pixel: (block, generator) => {
    const args = integers(block, generator, ['X', 'Y', 'BRIGHTNESS']);
    return `${displayCall(generator, 'set_pixel', args)}\n`;
  },
  microbit_get_pixel: (block, generator) => {
    const args = integers(block, generator, ['X', 'Y']);
    return [displayCall(generator, 'get_pixel', args), Order.FUNCTION_CALL];
  },
  microbit_read_digital: (block, generator) => [
    `${edgePin(block, generator)}.read_digital()`, Order.FUNCTION_CALL,
  ],
  microbit_read_analog: (block, generator) => [
    `${edgePin(block, generator)}.read_analog()`, Order.FUNCTION_CALL,
  ],
  microbit_write_digital: (block, generator) =>
    `${edgePin(block, generator)}.write_digital(${block.getFieldValue('LEVEL')})\n`,
  microbit_write_analog: (block, generator) =>
    `${edgePin(block, generator)}.write_analog(${integers(block, generator, ['DUTY'])[0]})\n`,
  microbit_set_analog_period: (block, generator) => {
    const method = block.getFieldValue('UNIT') === 'us' ? 'set_analog_period_microseconds' : 'set_analog_period';
    return `${edgePin(block, generator)}.${method}(${integers(block, generator, ['PERIOD'])[0]})\n`;
  },
  microbit_set_pull: (block, generator) => {
    const selected = edgePin(block, generator);
    return `${selected}.set_pull(${selected}.${block.getFieldValue('PULL')})\n`;
  },
  microbit_clear_display: (_block, generator) => `${displayCall(generator, 'clear')}\n`,
});
