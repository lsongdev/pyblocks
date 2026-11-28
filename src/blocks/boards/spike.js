import { common, Names } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';
import { eventHandler } from '../../python/events.js';
import { inAsyncFunction, functionContext } from '../../python/async-context.js';

// LEGO official SPIKE App 3 API (not Legacy's spike module or Pybricks).
// Reference: https://spike.legoeducation.com/prime/help/lls-help-python
const colour = 45;
const statement = { previousStatement: null, nextStatement: null };
const number = name => ({ type: 'input_value', name, check: 'Number' });
const dropdown = (name, options) => ({ type: 'field_dropdown', name, options });
const port = (name = 'PORT') => dropdown(name, [...'ABCDEF'].map(p => [p, p]));
const pair = () => dropdown('PAIR', [1, 2, 3].map(p => [String(p), `PAIR_${p}`]));
const stop = () => dropdown('STOP', ['BRAKE', 'COAST', 'HOLD', 'CONTINUE', 'SMART_COAST', 'SMART_BRAKE'].map(mode => [blockMessage('spikeStop_' + mode), mode]));
const definitions = [];
function define(type, message, args, output, hint) {
  definitions.push({ type: `spike_${type}`, message0: blockMessage(message), args0: args,
    ...(output === undefined ? statement : { output }), colour,
    ...(hint ? { tooltip: blockMessage(hint) } : {}) });
}
define('run', 'spikeRun', [], undefined, 'spikeRunHint');
definitions[0].message1 = blockMessage('buttonEventBody');
definitions[0].args1 = [{ type: 'input_statement', name: 'DO' }];
for (const [type, message, args, hint] of [
  ['on_condition', 'spikeOnCondition', [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }], 'spikeOnConditionHint'],
]) {
  definitions.push({ type: `spike_${type}`, message0: blockMessage(message), args0: args,
    message1: blockMessage('buttonEventBody'), args1: [{ type: 'input_statement', name: 'DO' }],
    colour, ...statement, tooltip: blockMessage(hint) });
}
define('until', 'spikeUntil', [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }, number('TIMEOUT')], null, 'spikeUntilHint');
define('sleep', 'spikeSleep', [number('DURATION')], null);
define('write', 'spikeWrite', [{ type: 'input_value', name: 'TEXT', check: 'String' }, number('BRIGHTNESS'), number('DURATION')], null);
define('clear', 'spikeClear', []);
define('pixel', 'spikePixel', [number('X'), number('Y'), number('BRIGHTNESS')], undefined, 'spikePixelHint');
define('button', 'spikeButton', [dropdown('BUTTON', ['LEFT', 'RIGHT'].map(b => [blockMessage(b === 'LEFT' ? 'spikeLeft' : 'spikeRight'), b]))], 'Number', 'spikeButtonHint');
define('button_pressed', 'spikeButtonPressed', [dropdown('BUTTON', ['LEFT', 'RIGHT'].map(b => [blockMessage(b === 'LEFT' ? 'spikeLeft' : 'spikeRight'), b]))], 'Boolean', 'spikeButtonPressedHint');
define('tilt', 'spikeTilt', [dropdown('AXIS', ['Yaw', 'Pitch', 'Roll'].map((axis, i) => [blockMessage(`spike${axis}`), String(i)]))], 'Number', 'spikeTiltHint');
define('reset_yaw', 'spikeResetYaw', [number('ANGLE')]);
define('motor_run', 'spikeMotorRun', [port(), number('SPEED')], undefined, 'spikeMotorHint');
define('motor_degrees', 'spikeMotorDegrees', [port(), number('DEGREES'), number('SPEED'), stop()], null, 'spikeMotorHint');
define('motor_time', 'spikeMotorTime', [port(), number('DURATION'), number('SPEED'), stop()], null, 'spikeMotorHint');
define('motor_stop', 'spikeMotorStop', [port(), stop()]);
define('motor_position', 'spikeMotorPosition', [port()], 'Number');
define('motor_reset', 'spikeMotorReset', [port(), number('ANGLE')]);
define('color', 'spikeColor', [port()], 'Number');
define('reflection', 'spikeReflection', [port()], 'Number');
define('distance', 'spikeDistance', [port()], 'Number', 'spikeDistanceHint');
define('force', 'spikeForce', [port()], 'Number', 'spikeForceHint');
define('force_pressed', 'spikeForcePressed', [port()], 'Boolean');
define('color_constant', 'spikeColorConstant', [dropdown('COLOR', ["BLACK","MAGENTA","PURPLE","BLUE","AZURE","TURQUOISE","GREEN","YELLOW","ORANGE","RED","WHITE","UNKNOWN"].map(c => [c, c]))], 'Number');
define('pair', 'spikePair', [pair(), port('LEFT'), port('RIGHT')], undefined, 'spikePairHint');
define('tank', 'spikeTank', [pair(), number('LEFT_SPEED'), number('RIGHT_SPEED')], undefined, 'spikePairHint');
define('pair_degrees', 'spikePairDegrees', [pair(), number('DEGREES'), number('STEERING'), number('SPEED'), stop()], null, 'spikePairHint');
define('pair_stop', 'spikePairStop', [pair(), stop()]);
define('motor_absolute', 'spikeApi_motor_absolute', [port('PORT'), number('ANGLE'), number('SPEED'), dropdown('DIRECTION', [["SHORTEST_PATH","SHORTEST_PATH"],["CLOCKWISE","CLOCKWISE"],["COUNTERCLOCKWISE","COUNTERCLOCKWISE"],["LONGEST_PATH","LONGEST_PATH"]]), stop()], null);
define('motor_relative', 'spikeApi_motor_relative', [port('PORT'), number('ANGLE'), number('SPEED'), stop()], null);
define('motor_absolute_position', 'spikeApi_motor_absolute_position', [port('PORT')], "Number");
define('motor_velocity', 'spikeApi_motor_velocity', [port('PORT')], "Number");
define('motor_duty', 'spikeApi_motor_duty', [port('PORT')], "Number");
define('motor_set_duty', 'spikeApi_motor_set_duty', [port('PORT'), number('PWM')]);
define('motor_result', 'spikeApi_motor_result', [dropdown('VALUE', [["READY","READY"],["RUNNING","RUNNING"],["STALLED","STALLED"],["CANCELLED","CANCELLED"],["ERROR","ERROR"],["DISCONNECTED","DISCONNECTED"]])], "Number");
define('pair_move', 'spikeApi_pair_move', [pair(), number('STEERING'), number('SPEED')]);
define('pair_time', 'spikeApi_pair_time', [pair(), number('DURATION'), number('STEERING'), number('SPEED'), stop()], null);
define('tank_degrees', 'spikeApi_tank_degrees', [pair(), number('DEGREES'), number('LEFT_SPEED'), number('RIGHT_SPEED'), stop()], null);
define('tank_time', 'spikeApi_tank_time', [pair(), number('DURATION'), number('LEFT_SPEED'), number('RIGHT_SPEED'), stop()], null);
define('unpair', 'spikeApi_unpair', [pair()]);
define('get_pixel', 'spikeApi_get_pixel', [number('X'), number('Y')], "Number");
define('image_constant', 'spikeApi_image_constant', [dropdown('VALUE', [["IMAGE_HEART","IMAGE_HEART"],["IMAGE_HEART_SMALL","IMAGE_HEART_SMALL"],["IMAGE_HAPPY","IMAGE_HAPPY"],["IMAGE_SMILE","IMAGE_SMILE"],["IMAGE_SAD","IMAGE_SAD"],["IMAGE_CONFUSED","IMAGE_CONFUSED"],["IMAGE_ANGRY","IMAGE_ANGRY"],["IMAGE_ASLEEP","IMAGE_ASLEEP"],["IMAGE_SURPRISED","IMAGE_SURPRISED"],["IMAGE_SILLY","IMAGE_SILLY"],["IMAGE_FABULOUS","IMAGE_FABULOUS"],["IMAGE_MEH","IMAGE_MEH"],["IMAGE_YES","IMAGE_YES"],["IMAGE_NO","IMAGE_NO"],["IMAGE_CLOCK1","IMAGE_CLOCK1"],["IMAGE_CLOCK2","IMAGE_CLOCK2"],["IMAGE_CLOCK3","IMAGE_CLOCK3"],["IMAGE_CLOCK4","IMAGE_CLOCK4"],["IMAGE_CLOCK5","IMAGE_CLOCK5"],["IMAGE_CLOCK6","IMAGE_CLOCK6"],["IMAGE_CLOCK7","IMAGE_CLOCK7"],["IMAGE_CLOCK8","IMAGE_CLOCK8"],["IMAGE_CLOCK9","IMAGE_CLOCK9"],["IMAGE_CLOCK10","IMAGE_CLOCK10"],["IMAGE_CLOCK11","IMAGE_CLOCK11"],["IMAGE_CLOCK12","IMAGE_CLOCK12"],["IMAGE_ARROW_N","IMAGE_ARROW_N"],["IMAGE_ARROW_NE","IMAGE_ARROW_NE"],["IMAGE_ARROW_E","IMAGE_ARROW_E"],["IMAGE_ARROW_SE","IMAGE_ARROW_SE"],["IMAGE_ARROW_S","IMAGE_ARROW_S"],["IMAGE_ARROW_SW","IMAGE_ARROW_SW"],["IMAGE_ARROW_W","IMAGE_ARROW_W"],["IMAGE_ARROW_NW","IMAGE_ARROW_NW"],["IMAGE_GO_RIGHT","IMAGE_GO_RIGHT"],["IMAGE_GO_LEFT","IMAGE_GO_LEFT"],["IMAGE_GO_UP","IMAGE_GO_UP"],["IMAGE_GO_DOWN","IMAGE_GO_DOWN"],["IMAGE_TRIANGLE","IMAGE_TRIANGLE"],["IMAGE_TRIANGLE_LEFT","IMAGE_TRIANGLE_LEFT"],["IMAGE_CHESSBOARD","IMAGE_CHESSBOARD"],["IMAGE_DIAMOND","IMAGE_DIAMOND"],["IMAGE_DIAMOND_SMALL","IMAGE_DIAMOND_SMALL"],["IMAGE_SQUARE","IMAGE_SQUARE"],["IMAGE_SQUARE_SMALL","IMAGE_SQUARE_SMALL"],["IMAGE_RABBIT","IMAGE_RABBIT"],["IMAGE_COW","IMAGE_COW"],["IMAGE_MUSIC_CROTCHET","IMAGE_MUSIC_CROTCHET"],["IMAGE_MUSIC_QUAVER","IMAGE_MUSIC_QUAVER"],["IMAGE_MUSIC_QUAVERS","IMAGE_MUSIC_QUAVERS"],["IMAGE_PITCHFORK","IMAGE_PITCHFORK"],["IMAGE_XMAS","IMAGE_XMAS"],["IMAGE_PACMAN","IMAGE_PACMAN"],["IMAGE_TARGET","IMAGE_TARGET"],["IMAGE_TSHIRT","IMAGE_TSHIRT"],["IMAGE_ROLLERSKATE","IMAGE_ROLLERSKATE"],["IMAGE_DUCK","IMAGE_DUCK"],["IMAGE_HOUSE","IMAGE_HOUSE"],["IMAGE_TORTOISE","IMAGE_TORTOISE"],["IMAGE_BUTTERFLY","IMAGE_BUTTERFLY"],["IMAGE_STICKFIGURE","IMAGE_STICKFIGURE"],["IMAGE_GHOST","IMAGE_GHOST"],["IMAGE_SWORD","IMAGE_SWORD"],["IMAGE_GIRAFFE","IMAGE_GIRAFFE"],["IMAGE_SKULL","IMAGE_SKULL"],["IMAGE_UMBRELLA","IMAGE_UMBRELLA"],["IMAGE_SNAKE","IMAGE_SNAKE"]])], "Number");
define('show_image', 'spikeApi_show_image', [number('IMAGE')]);
define('matrix_show', 'spikeApi_matrix_show', [{ type: 'input_value', name: 'PIXELS' }]);
define('orientation_constant', 'spikeApi_orientation_constant', [dropdown('VALUE', [["UP","UP"],["RIGHT","RIGHT"],["DOWN","DOWN"],["LEFT","LEFT"]])], "Number");
define('matrix_orientation', 'spikeApi_matrix_orientation', [], "Number");
define('matrix_set_orientation', 'spikeApi_matrix_set_orientation', [number('ORIENTATION')]);
define('light_color', 'spikeApi_light_color', [dropdown('LIGHT', [["POWER","POWER"],["CONNECT","CONNECT"]]), number('COLOR')]);
define('light_rgb', 'spikeApi_light_rgb', [dropdown('LIGHT', [["POWER","POWER"],["CONNECT","CONNECT"]]), number('R'), number('G'), number('B')]);
define('beep', 'spikeApi_beep', [number('FREQ'), number('DURATION'), number('VOLUME')], null);
define('sound_stop', 'spikeApi_sound_stop', []);
define('sound_volume', 'spikeApi_sound_volume', [number('VOLUME')]);
define('gesture', 'spikeApi_gesture', [], "Number");
define('yaw_face', 'spikeApi_yaw_face', [], "Number");
define('quaternion', 'spikeApi_quaternion', [], null);
define('stable', 'spikeApi_stable', [], "Boolean");
define('tap_count', 'spikeApi_tap_count', [], "Number");
define('reset_tap_count', 'spikeApi_reset_tap_count', []);
define('up_face', 'spikeApi_up_face', [], "Number");
define('tilt_angles', 'spikeApi_tilt_angles', [], null);
define('acceleration', 'spikeApi_acceleration', [dropdown('RAW', [["False","False"],["True","True"]])], null);
define('angular_velocity', 'spikeApi_angular_velocity', [dropdown('RAW', [["False","False"],["True","True"]])], null);
define('gesture_constant', 'spikeApi_gesture_constant', [dropdown('VALUE', [["TAPPED","TAPPED"],["DOUBLE_TAPPED","DOUBLE_TAPPED"],["SHAKEN","SHAKEN"],["FALLING","FALLING"],["UNKNOWN","UNKNOWN"]])], "Number");
define('face_constant', 'spikeApi_face_constant', [dropdown('VALUE', [["TOP","TOP"],["FRONT","FRONT"],["RIGHT","RIGHT"],["BOTTOM","BOTTOM"],["BACK","BACK"],["LEFT","LEFT"]])], "Number");
define('set_yaw_face', 'spikeApi_set_yaw_face', [number('FACE')]);
define('rgbi', 'spikeApi_rgbi', [port('PORT')], null);
define('force_raw', 'spikeApi_force_raw', [port('PORT')], "Number");
define('distance_clear', 'spikeApi_distance_clear', [port('PORT')]);
define('distance_get_pixel', 'spikeApi_distance_get_pixel', [port('PORT'), number('X'), number('Y')], "Number");
define('distance_set_pixel', 'spikeApi_distance_set_pixel', [port('PORT'), number('X'), number('Y'), number('BRIGHTNESS')]);
define('distance_show', 'spikeApi_distance_show', [port('PORT'), { type: 'input_value', name: 'PIXELS' }]);
define('color_matrix_clear', 'spikeApi_color_matrix_clear', [port('PORT')]);
define('color_matrix_get_pixel', 'spikeApi_color_matrix_get_pixel', [port('PORT'), number('X'), number('Y')], null);
define('color_matrix_set_pixel', 'spikeApi_color_matrix_set_pixel', [port('PORT'), number('X'), number('Y'), number('COLOR'), number('INTENSITY')]);
define('color_matrix_show', 'spikeApi_color_matrix_show', [port('PORT'), { type: 'input_value', name: 'PIXELS' }]);
define('device_id', 'spikeApi_device_id', [port('PORT')], "Number");
define('device_ready', 'spikeApi_device_ready', [port('PORT')], "Boolean");
define('device_data', 'spikeApi_device_data', [port('PORT')], null);
define('device_duty', 'spikeApi_device_duty', [port('PORT')], "Number");
define('device_set_duty', 'spikeApi_device_set_duty', [port('PORT'), number('DUTY')]);
define('hub_temperature', 'spikeApi_hub_temperature', [], "Number");
define('hub_uuid', 'spikeApi_hub_uuid', [], "String");
define('hub_hardware', 'spikeApi_hub_hardware', [], "String");
const ramped = ['motor_run', 'motor_degrees', 'motor_time', 'motor_absolute', 'motor_relative', 'tank', 'pair_move', 'pair_degrees', 'pair_time', 'tank_degrees', 'tank_time'];
for (const type of ramped) {
  const definition = definitions.find(item => item.type === 'spike_' + type);
  const continuous = ['motor_run', 'tank', 'pair_move'].includes(type);
  definition.message1 = blockMessage(continuous ? 'spikeRampUp' : 'spikeRampBoth');
  definition.args1 = continuous ? [number('ACCELERATION')] : [number('ACCELERATION'), number('DECELERATION')];
}
define('hub_power_off', 'spikeApi_hub_power_off', []);
define('run_awaitables', 'spikeApi_run_awaitables', [{ type: 'input_value', name: 'TASKS' }]);
define('color_pixel', 'spikeApi_color_pixel', [number('COLOR'), number('INTENSITY')], null);
const beepDefinition = definitions.find(item => item.type === 'spike_beep');
beepDefinition.message1 = blockMessage('spikeBeepEnvelope');
beepDefinition.args1 = ['ATTACK', 'DECAY', 'SUSTAIN', 'RELEASE'].map(number);
beepDefinition.message2 = blockMessage('spikeBeepOptions');
beepDefinition.args2 = [number('TRANSITION'), number('WAVEFORM'), number('CHANNEL')];
define('waveform', 'spikeApi_waveform', [dropdown('VALUE', ['WAVEFORM_SINE', 'WAVEFORM_TRIANGLE', 'WAVEFORM_SQUARE', 'WAVEFORM_SAWTOOTH'].map(x => [x, x]))], 'Number');
define('sound_channel', 'spikeApi_sound_channel', [dropdown('VALUE', ['DEFAULT', 'ANY'].map(x => [x, x]))], 'Number');
common.defineBlocksWithJsonArray(definitions);

const modules = ['runloop', 'light_matrix', 'button', 'motion_sensor', 'port', 'motor', 'motor_pair', 'color_sensor', 'distance_sensor', 'force_sensor', 'color', 'color_matrix', 'device', 'orientation', 'light', 'sound', 'hub'];
pythonGenerator.addReservedWords(modules.map(m => `_spike_${m}`).join(','));
function module(generator, name) {
  const alias = `_spike_${name}`;
  generator.definitions_[`import_spike_${name}`] = ['light_matrix', 'button', 'motion_sensor', 'port', 'light', 'sound'].includes(name)
    ? `from hub import ${name} as ${alias}` : `import ${name} as ${alias}`;
  return alias;
}
const selectedPort = (b, g, name = 'PORT') => `${module(g, 'port')}.${b.getFieldValue(name)}`;
const selectedPair = (b, g) => `${module(g, 'motor_pair')}.${b.getFieldValue('PAIR')}`;
const stopCode = (b, g) => `${module(g, 'motor')}.${b.getFieldValue('STOP')}`;
const value = (b, g, name, fallback = '0') => g.valueToCode(b, name, Order.NONE) || fallback;
// Omitted optional input means use the native firmware default.
function motorRamp(b, g, deceleration) {
  const names = deceleration ? ['ACCELERATION', 'DECELERATION'] : ['ACCELERATION'];
  return names.map(name => {
    const code = g.valueToCode(b, name, Order.NONE);
    return code ? `, ${name.toLowerCase()}=${code}` : '';
  }).join('');
}
function call(type, name, method, args, { output = false } = {}) {
  pythonGenerator.forBlock[`spike_${type}`] = (b, g) => {
    const code = `${module(g, name)}.${method}(${args(b, g)})`;
    return output ? [code, Order.FUNCTION_CALL] : `${code}\n`;
  };
}
const runContexts = new WeakMap();
function requireEventScope(b, g) {
  const context = runContexts.get(g);
  if (!context || b.getSurroundParent() !== context.block) throw new PythonBlockError(t('spikeEventScope'));
  return context;
}
pythonGenerator.forBlock.spike_run = (b, g) => {
  if (inAsyncFunction(g)) throw new PythonBlockError(t('asyncNestedRun'));
  const previous = runContexts.get(g);
  const context = { block: b, listeners: [] };
  runContexts.set(g, context);
  try {
    const runloop = module(g, 'runloop');
    const { name, code } = eventHandler(b, g, '_spike_task', { asynchronous: true });
    g.definitions_[name] = code;
    return `${runloop}.run(\n${[name, ...context.listeners].map(task => `${g.INDENT}${task}(),`).join('\n')}\n)\n`;
  } finally {
    if (previous) runContexts.set(g, previous);
    else runContexts.delete(g);
  }
};
function conditionCode(b, g) {
  const condition = functionContext(g, false, () => g.valueToCode(b, 'CONDITION', Order.NONE));
  if (!condition) throw new PythonBlockError(t('requiredExpression', t('spikeCondition')));
  return condition;
}
pythonGenerator.forBlock.spike_until = (b, g) => {
  // The predicate is a synchronous lambda, even inside an async task.
  const condition = conditionCode(b, g);
  return [`${module(g, 'runloop')}.until(lambda: ${condition}, timeout=${value(b, g, 'TIMEOUT')})`, Order.FUNCTION_CALL];
};
function conditionEvent(b, g, condition) {
  const runloop = module(g, 'runloop');
  const { name, code } = eventHandler(b, g, '_spike_on_true', { asynchronous: true });
  const watcher = g.nameDB_.getDistinctName('_spike_watch_condition', Names.NameType.PROCEDURE);
  g.definitions_[name] = code;
  g.definitions_[watcher] = `async def ${watcher}():
    await ${runloop}.until(lambda: not (${condition}))
    while True:
        await ${runloop}.until(lambda: ${condition})
        await ${name}()
        await ${runloop}.until(lambda: not (${condition}))
`;
  requireEventScope(b, g).listeners.push(watcher);
  return '';
}
pythonGenerator.forBlock.spike_on_condition = (b, g) => {
  requireEventScope(b, g);
  return conditionEvent(b, g, conditionCode(b, g));
};
call('sleep', 'runloop', 'sleep_ms', (b, g) => value(b, g, 'DURATION'), { output: true });
call('write', 'light_matrix', 'write', (b, g) => [
  value(b, g, 'TEXT', "''"),
  value(b, g, 'BRIGHTNESS', '100'),
  value(b, g, 'DURATION', '500'),
].join(', '), { output: true });
call('clear', 'light_matrix', 'clear', () => '');
call('pixel', 'light_matrix', 'set_pixel', (b, g) => ['X', 'Y', 'BRIGHTNESS'].map(n => value(b, g, n)).join(', '));
call('button', 'button', 'pressed', (b, g) => `${module(g, 'button')}.${b.getFieldValue('BUTTON')}`, { output: true });
pythonGenerator.forBlock.spike_button_pressed = (b, g) => [`${module(g, 'button')}.pressed(${module(g, 'button')}.${b.getFieldValue('BUTTON')}) > 0`, Order.RELATIONAL];
pythonGenerator.forBlock.spike_tilt = (b, g) => [`${module(g, 'motion_sensor')}.tilt_angles()[${b.getFieldValue('AXIS')}]`, Order.MEMBER];
call('reset_yaw', 'motion_sensor', 'reset_yaw', (b, g) => value(b, g, 'ANGLE'));
call('motor_run', 'motor', 'run', (b, g) => `${selectedPort(b, g)}, ${value(b, g, 'SPEED')}` + motorRamp(b, g, false));
call('motor_degrees', 'motor', 'run_for_degrees', (b, g) => `${selectedPort(b, g)}, ${value(b, g, 'DEGREES')}, ${value(b, g, 'SPEED')}, stop=${stopCode(b, g)}` + motorRamp(b, g, true), { output: true });
call('motor_time', 'motor', 'run_for_time', (b, g) => `${selectedPort(b, g)}, ${value(b, g, 'DURATION')}, ${value(b, g, 'SPEED')}, stop=${stopCode(b, g)}` + motorRamp(b, g, true), { output: true });
call('motor_stop', 'motor', 'stop', (b, g) => `${selectedPort(b, g)}, stop=${stopCode(b, g)}`);
call('motor_position', 'motor', 'relative_position', selectedPort, { output: true });
call('motor_reset', 'motor', 'reset_relative_position', (b, g) => `${selectedPort(b, g)}, ${value(b, g, 'ANGLE')}`);
for (const [type, name, method] of [
  ['color', 'color_sensor', 'color'], ['reflection', 'color_sensor', 'reflection'],
  ['distance', 'distance_sensor', 'distance'], ['force', 'force_sensor', 'force'], ['force_pressed', 'force_sensor', 'pressed'],
]) call(type, name, method, selectedPort, { output: true });
pythonGenerator.forBlock.spike_color_constant = (b, g) => [`${module(g, 'color')}.${b.getFieldValue('COLOR')}`, Order.MEMBER];
call('pair', 'motor_pair', 'pair', (b, g) => `${selectedPair(b, g)}, ${selectedPort(b, g, 'LEFT')}, ${selectedPort(b, g, 'RIGHT')}`);
call('tank', 'motor_pair', 'move_tank', (b, g) => `${selectedPair(b, g)}, ${value(b, g, 'LEFT_SPEED')}, ${value(b, g, 'RIGHT_SPEED')}` + motorRamp(b, g, false));
call('pair_degrees', 'motor_pair', 'move_for_degrees', (b, g) => `${selectedPair(b, g)}, ${value(b, g, 'DEGREES')}, ${value(b, g, 'STEERING')}, velocity=${value(b, g, 'SPEED')}, stop=${stopCode(b, g)}` + motorRamp(b, g, true), { output: true });
call('pair_stop', 'motor_pair', 'stop', (b, g) => `${selectedPair(b, g)}, stop=${stopCode(b, g)}`);

call('motor_absolute', 'motor', 'run_to_absolute_position', (b, g) => [selectedPort(b, g, 'PORT'), value(b, g, 'ANGLE', "90"), value(b, g, 'SPEED', "360"), `direction=${module(g, 'motor')}.${b.getFieldValue('DIRECTION')}`, `stop=${stopCode(b, g)}`].join(', ') + motorRamp(b, g, true), { output: true });
call('motor_relative', 'motor', 'run_to_relative_position', (b, g) => [selectedPort(b, g, 'PORT'), value(b, g, 'ANGLE', "90"), value(b, g, 'SPEED', "360"), `stop=${stopCode(b, g)}`].join(', ') + motorRamp(b, g, true), { output: true });
call('motor_absolute_position', 'motor', 'absolute_position', (b, g) => [selectedPort(b, g, 'PORT')].join(', '), { output: true });
call('motor_velocity', 'motor', 'velocity', (b, g) => [selectedPort(b, g, 'PORT')].join(', '), { output: true });
call('motor_duty', 'motor', 'get_duty_cycle', (b, g) => [selectedPort(b, g, 'PORT')].join(', '), { output: true });
call('motor_set_duty', 'motor', 'set_duty_cycle', (b, g) => [selectedPort(b, g, 'PORT'), value(b, g, 'PWM', "1000")].join(', '));
pythonGenerator.forBlock.spike_motor_result = (b, g) => [`${module(g, 'motor') }.${b.getFieldValue('VALUE')}`, Order.MEMBER];
call('pair_move', 'motor_pair', 'move', (b, g) => [selectedPair(b, g), value(b, g, 'STEERING', "0"), `velocity=${value(b, g, 'SPEED', "360")}`].join(', ') + motorRamp(b, g, false));
call('pair_time', 'motor_pair', 'move_for_time', (b, g) => [selectedPair(b, g), value(b, g, 'DURATION', "1000"), value(b, g, 'STEERING', "0"), `velocity=${value(b, g, 'SPEED', "360")}`, `stop=${stopCode(b, g)}`].join(', ') + motorRamp(b, g, true), { output: true });
call('tank_degrees', 'motor_pair', 'move_tank_for_degrees', (b, g) => [selectedPair(b, g), value(b, g, 'DEGREES', "360"), value(b, g, 'LEFT_SPEED', "360"), value(b, g, 'RIGHT_SPEED', "360"), `stop=${stopCode(b, g)}`].join(', ') + motorRamp(b, g, true), { output: true });
call('tank_time', 'motor_pair', 'move_tank_for_time', (b, g) => [selectedPair(b, g), value(b, g, 'LEFT_SPEED', "360"), value(b, g, 'RIGHT_SPEED', "360"), value(b, g, 'DURATION', "1000"), `stop=${stopCode(b, g)}`].join(', ') + motorRamp(b, g, true), { output: true });
call('unpair', 'motor_pair', 'unpair', (b, g) => [selectedPair(b, g)].join(', '));
call('get_pixel', 'light_matrix', 'get_pixel', (b, g) => [value(b, g, 'X', "0"), value(b, g, 'Y', "0")].join(', '), { output: true });
pythonGenerator.forBlock.spike_image_constant = (b, g) => [`${module(g, 'light_matrix') }.${b.getFieldValue('VALUE')}`, Order.MEMBER];
call('show_image', 'light_matrix', 'show_image', (b, g) => [value(b, g, 'IMAGE', "1")].join(', '));
call('matrix_show', 'light_matrix', 'show', (b, g) => [value(b, g, 'PIXELS', "[0] * 25")].join(', '));
pythonGenerator.forBlock.spike_orientation_constant = (b, g) => [`${module(g, 'orientation') }.${b.getFieldValue('VALUE')}`, Order.MEMBER];
call('matrix_orientation', 'light_matrix', 'get_orientation', (b, g) => [].join(', '), { output: true });
call('matrix_set_orientation', 'light_matrix', 'set_orientation', (b, g) => [value(b, g, 'ORIENTATION', "0")].join(', '));
call('light_color', 'light', 'color', (b, g) => `${module(g, 'light')}.${b.getFieldValue('LIGHT')}, ${value(b, g, 'COLOR')}`);
call('light_rgb', 'light', 'color', (b, g) => `${module(g, 'light')}.${b.getFieldValue('LIGHT')}, ${['R', 'G', 'B'].map(key => value(b, g, key)).join(', ')}`);
call('beep', 'sound', 'beep', (b, g) => {
  const args = ['FREQ', 'DURATION', 'VOLUME'].map((name, index) => value(b, g, name, ['440', '500', '100'][index]));
  for (const name of ['ATTACK', 'DECAY', 'SUSTAIN', 'RELEASE', 'TRANSITION', 'WAVEFORM', 'CHANNEL']) {
    const code = g.valueToCode(b, name, Order.NONE);
    if (code) args.push(`${name.toLowerCase()}=${code}`);
  }
  return args.join(', ');
}, { output: true });
call('sound_stop', 'sound', 'stop', (b, g) => [].join(', '));
call('sound_volume', 'sound', 'volume', (b, g) => [value(b, g, 'VOLUME', "100")].join(', '));
call('gesture', 'motion_sensor', 'gesture', (b, g) => [].join(', '), { output: true });
call('yaw_face', 'motion_sensor', 'get_yaw_face', (b, g) => [].join(', '), { output: true });
call('quaternion', 'motion_sensor', 'quaternion', (b, g) => [].join(', '), { output: true });
call('stable', 'motion_sensor', 'stable', (b, g) => [].join(', '), { output: true });
call('tap_count', 'motion_sensor', 'tap_count', (b, g) => [].join(', '), { output: true });
call('reset_tap_count', 'motion_sensor', 'reset_tap_count', (b, g) => [].join(', '));
call('up_face', 'motion_sensor', 'up_face', (b, g) => [].join(', '), { output: true });
call('tilt_angles', 'motion_sensor', 'tilt_angles', (b, g) => [].join(', '), { output: true });
call('acceleration', 'motion_sensor', 'acceleration', b => b.getFieldValue('RAW'), { output: true });
call('angular_velocity', 'motion_sensor', 'angular_velocity', b => b.getFieldValue('RAW'), { output: true });
pythonGenerator.forBlock.spike_gesture_constant = (b, g) => [`${module(g, 'motion_sensor') }.${b.getFieldValue('VALUE')}`, Order.MEMBER];
pythonGenerator.forBlock.spike_face_constant = (b, g) => [`${module(g, 'motion_sensor') }.${b.getFieldValue('VALUE')}`, Order.MEMBER];
call('set_yaw_face', 'motion_sensor', 'set_yaw_face', (b, g) => [value(b, g, 'FACE', "0")].join(', '));
call('rgbi', 'color_sensor', 'rgbi', (b, g) => [selectedPort(b, g, 'PORT')].join(', '), { output: true });
call('force_raw', 'force_sensor', 'raw', (b, g) => [selectedPort(b, g, 'PORT')].join(', '), { output: true });
call('distance_clear', 'distance_sensor', 'clear', (b, g) => [selectedPort(b, g, 'PORT')].join(', '));
call('distance_get_pixel', 'distance_sensor', 'get_pixel', (b, g) => [selectedPort(b, g, 'PORT'), value(b, g, 'X', "0"), value(b, g, 'Y', "0")].join(', '), { output: true });
call('distance_set_pixel', 'distance_sensor', 'set_pixel', (b, g) => [selectedPort(b, g, 'PORT'), value(b, g, 'X', "0"), value(b, g, 'Y', "0"), value(b, g, 'BRIGHTNESS', "100")].join(', '));
call('distance_show', 'distance_sensor', 'show', (b, g) => [selectedPort(b, g, 'PORT'), value(b, g, 'PIXELS', "[0] * 4")].join(', '));
call('color_matrix_clear', 'color_matrix', 'clear', (b, g) => [selectedPort(b, g, 'PORT')].join(', '));
call('color_matrix_get_pixel', 'color_matrix', 'get_pixel', (b, g) => [selectedPort(b, g, 'PORT'), value(b, g, 'X', "0"), value(b, g, 'Y', "0")].join(', '), { output: true });
call('color_matrix_set_pixel', 'color_matrix', 'set_pixel', (b, g) => `${selectedPort(b,g)}, ${value(b,g,'X')}, ${value(b,g,'Y')}, (${value(b,g,'COLOR')}, ${value(b,g,'INTENSITY')})`);
call('color_matrix_show', 'color_matrix', 'show', (b, g) => [selectedPort(b, g, 'PORT'), value(b, g, 'PIXELS', "[(0, 0)] * 9")].join(', '));
call('device_id', 'device', 'id', (b, g) => [selectedPort(b, g, 'PORT')].join(', '), { output: true });
call('device_ready', 'device', 'ready', (b, g) => [selectedPort(b, g, 'PORT')].join(', '), { output: true });
call('device_data', 'device', 'data', (b, g) => [selectedPort(b, g, 'PORT')].join(', '), { output: true });
call('device_duty', 'device', 'get_duty_cycle', (b, g) => [selectedPort(b, g, 'PORT')].join(', '), { output: true });
call('device_set_duty', 'device', 'set_duty_cycle', (b, g) => [selectedPort(b, g, 'PORT'), value(b, g, 'DUTY', "0")].join(', '));
call('hub_temperature', 'hub', 'temperature', (b, g) => [].join(', '), { output: true });
call('hub_uuid', 'hub', 'device_uuid', (b, g) => [].join(', '), { output: true });
call('hub_hardware', 'hub', 'hardware_id', (b, g) => [].join(', '), { output: true });

call('hub_power_off', 'hub', 'power_off', () => '');
pythonGenerator.forBlock.spike_run_awaitables = (b, g) => {
  if (inAsyncFunction(g)) throw new PythonBlockError(t('asyncNestedRun'));
  const tasks = g.valueToCode(b, 'TASKS', Order.NONE);
  if (!tasks) throw new PythonBlockError(t('requiredExpression', t('spikeApi_awaitables')));
  return `${module(g, 'runloop')}.run(*(${tasks}))\n`;
};
pythonGenerator.forBlock.spike_color_pixel = (b, g) => [`(${value(b,g,'COLOR')}, ${value(b,g,'INTENSITY')})`, Order.ATOMIC];
for (const type of ['waveform', 'sound_channel']) {
  pythonGenerator.forBlock['spike_' + type] = (b, g) => [`${module(g, 'sound')}.${b.getFieldValue('VALUE')}`, Order.MEMBER];
}
