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
const stop = () => dropdown('STOP', ['BRAKE', 'COAST', 'HOLD'].map(mode => [blockMessage(`spike${mode[0]}${mode.slice(1).toLowerCase()}`), mode]));
const definitions = [];
function define(type, message, args, output, hint) {
  definitions.push({ type: `spike_${type}`, message0: blockMessage(message), args0: args,
    ...(output === undefined ? statement : { output }), colour,
    ...(hint ? { tooltip: blockMessage(hint) } : {}) });
}
define('run', 'spikeRun', [], undefined, 'spikeRunHint');
definitions[0].message1 = blockMessage('buttonEventBody');
definitions[0].args1 = [{ type: 'input_statement', name: 'TASKS', check: 'SpikeTask' }];
for (const [type, message, args, hint] of [
  ['task', 'spikeTask', [], 'spikeTaskHint'],
  ['on_button_pressed', 'spikeOnButton', [dropdown('BUTTON', ['LEFT', 'RIGHT'].map(b => [blockMessage(b === 'LEFT' ? 'spikeLeft' : 'spikeRight'), b]))], 'spikeOnButtonHint'],
]) {
  define(type, message, args, undefined, hint);
  Object.assign(definitions.at(-1), {
    previousStatement: 'SpikeTask', nextStatement: 'SpikeTask',
    message1: blockMessage('buttonEventBody'), args1: [{ type: 'input_statement', name: 'DO' }],
  });
}
define('until', 'spikeUntil', [{ type: 'input_value', name: 'CONDITION', check: 'Boolean' }, number('TIMEOUT')], undefined, 'spikeUntilHint');
define('sleep', 'spikeSleep', [number('DURATION')]);
define('write', 'spikeWrite', [{ type: 'input_value', name: 'TEXT', check: 'String' }, number('BRIGHTNESS'), number('DURATION')]);
define('clear', 'spikeClear', []);
define('pixel', 'spikePixel', [number('X'), number('Y'), number('BRIGHTNESS')], undefined, 'spikePixelHint');
define('button', 'spikeButton', [dropdown('BUTTON', ['LEFT', 'RIGHT'].map(b => [blockMessage(b === 'LEFT' ? 'spikeLeft' : 'spikeRight'), b]))], 'Number', 'spikeButtonHint');
define('tilt', 'spikeTilt', [dropdown('AXIS', ['Yaw', 'Pitch', 'Roll'].map((axis, i) => [blockMessage(`spike${axis}`), String(i)]))], 'Number', 'spikeTiltHint');
define('reset_yaw', 'spikeResetYaw', [number('ANGLE')]);
define('motor_run', 'spikeMotorRun', [port(), number('SPEED')], undefined, 'spikeMotorHint');
define('motor_degrees', 'spikeMotorDegrees', [port(), number('DEGREES'), number('SPEED'), stop()], undefined, 'spikeMotorHint');
define('motor_time', 'spikeMotorTime', [port(), number('DURATION'), number('SPEED'), stop()], undefined, 'spikeMotorHint');
define('motor_stop', 'spikeMotorStop', [port(), stop()]);
define('motor_position', 'spikeMotorPosition', [port()], 'Number');
define('motor_reset', 'spikeMotorReset', [port(), number('ANGLE')]);
define('color', 'spikeColor', [port()], 'Number');
define('reflection', 'spikeReflection', [port()], 'Number');
define('distance', 'spikeDistance', [port()], 'Number', 'spikeDistanceHint');
define('force', 'spikeForce', [port()], 'Number', 'spikeForceHint');
define('force_pressed', 'spikeForcePressed', [port()], 'Boolean');
define('color_constant', 'spikeColorConstant', [dropdown('COLOR', ['RED', 'GREEN', 'BLUE', 'YELLOW', 'MAGENTA', 'WHITE', 'BLACK'].map(c => [c, c]))], 'Number');
define('pair', 'spikePair', [pair(), port('LEFT'), port('RIGHT')], undefined, 'spikePairHint');
define('tank', 'spikeTank', [pair(), number('LEFT_SPEED'), number('RIGHT_SPEED')], undefined, 'spikePairHint');
define('pair_degrees', 'spikePairDegrees', [pair(), number('DEGREES'), number('STEERING'), number('SPEED')], undefined, 'spikePairHint');
define('pair_stop', 'spikePairStop', [pair(), stop()]);
common.defineBlocksWithJsonArray(definitions);

const modules = ['runloop', 'light_matrix', 'button', 'motion_sensor', 'port', 'motor', 'motor_pair', 'color_sensor', 'distance_sensor', 'force_sensor', 'color'];
pythonGenerator.addReservedWords(modules.map(m => `_spike_${m}`).join(','));
function module(generator, name) {
  const alias = `_spike_${name}`;
  generator.definitions_[`import_spike_${name}`] = ['light_matrix', 'button', 'motion_sensor', 'port'].includes(name)
    ? `from hub import ${name} as ${alias}` : `import ${name} as ${alias}`;
  return alias;
}
const selectedPort = (b, g, name = 'PORT') => `${module(g, 'port')}.${b.getFieldValue(name)}`;
const selectedPair = (b, g) => `${module(g, 'motor_pair')}.${b.getFieldValue('PAIR')}`;
const stopCode = (b, g) => `${module(g, 'motor')}.${b.getFieldValue('STOP')}`;
const value = (b, g, name, fallback = '0') => g.valueToCode(b, name, Order.NONE) || fallback;
function requireAsync(generator) {
  if (!inAsyncFunction(generator)) throw new PythonBlockError(t('spikeAsyncRequired'));
}
function call(type, name, method, args, { awaited = false, output = false } = {}) {
  pythonGenerator.forBlock[`spike_${type}`] = (b, g) => {
    if (awaited) requireAsync(g);
    const code = `${module(g, name)}.${method}(${args(b, g)})`;
    return output ? [code, Order.FUNCTION_CALL] : `${awaited ? 'await ' : ''}${code}\n`;
  };
}
// Task blocks describe awaitables passed to runloop.run(), not detached tasks.
const taskLists = new WeakSet();
pythonGenerator.forBlock.spike_run = (b, g) => {
  if (inAsyncFunction(g)) throw new PythonBlockError(t('asyncNestedRun'));
  const runloop = module(g, 'runloop');
  taskLists.add(g);
  let tasks;
  try { tasks = g.statementToCode(b, 'TASKS'); }
  finally { taskLists.delete(g); }
  if (!tasks) throw new PythonBlockError(t('spikeTasksRequired'));
  return `${runloop}.run(\n${tasks})\n`;
};
function taskHandler(b, g, generate) {
  if (!taskLists.has(g)) throw new PythonBlockError(t('spikeTaskContext'));
  taskLists.delete(g);
  try { return generate(); }
  finally { taskLists.add(g); }
}
pythonGenerator.forBlock.spike_task = (b, g) => taskHandler(b, g, () => {
  const { name, code } = eventHandler(b, g, '_spike_task', { asynchronous: true });
  g.definitions_[name] = code;
  return `${name}(),\n`;
});
pythonGenerator.forBlock.spike_until = (b, g) => {
  requireAsync(g);
  // The predicate is a synchronous lambda, even inside an async task.
  const condition = functionContext(g, false, () => g.valueToCode(b, 'CONDITION', Order.NONE));
  if (!condition) throw new PythonBlockError(t('requiredExpression', t('spikeCondition')));
  return `await ${module(g, 'runloop')}.until(lambda: ${condition}, timeout=${value(b, g, 'TIMEOUT')})\n`;
};
pythonGenerator.forBlock.spike_on_button_pressed = (b, g) => taskHandler(b, g, () => {
  const runloop = module(g, 'runloop');
  const button = module(g, 'button');
  const read = `${button}.pressed(${button}.${b.getFieldValue('BUTTON')})`;
  const { name, code } = eventHandler(b, g, '_spike_on_press', { asynchronous: true });
  const watcher = g.nameDB_.getDistinctName('_spike_watch_button', Names.NameType.PROCEDURE);
  g.definitions_[name] = code;
  g.definitions_[watcher] = `async def ${watcher}():
    await ${runloop}.until(lambda: ${read} == 0)
    while True:
        await ${runloop}.until(lambda: ${read} > 0)
        await ${name}()
        await ${runloop}.until(lambda: ${read} == 0)
`;
  return `${watcher}(),\n`;
});
call('sleep', 'runloop', 'sleep_ms', (b, g) => value(b, g, 'DURATION'), { awaited: true });
call('write', 'light_matrix', 'write', (b, g) => `${value(b, g, 'TEXT', "''")}, intensity=${value(b, g, 'BRIGHTNESS', '100')}, time_per_character=${value(b, g, 'DURATION', '500')}`, { awaited: true });
call('clear', 'light_matrix', 'clear', () => '');
call('pixel', 'light_matrix', 'set_pixel', (b, g) => ['X', 'Y', 'BRIGHTNESS'].map(n => value(b, g, n)).join(', '));
call('button', 'button', 'pressed', (b, g) => `${module(g, 'button')}.${b.getFieldValue('BUTTON')}`, { output: true });
pythonGenerator.forBlock.spike_tilt = (b, g) => [`${module(g, 'motion_sensor')}.tilt_angles()[${b.getFieldValue('AXIS')}]`, Order.MEMBER];
call('reset_yaw', 'motion_sensor', 'reset_yaw', (b, g) => value(b, g, 'ANGLE'));
call('motor_run', 'motor', 'run', (b, g) => `${selectedPort(b, g)}, ${value(b, g, 'SPEED')}`);
call('motor_degrees', 'motor', 'run_for_degrees', (b, g) => `${selectedPort(b, g)}, ${value(b, g, 'DEGREES')}, ${value(b, g, 'SPEED')}, stop=${stopCode(b, g)}`, { awaited: true });
call('motor_time', 'motor', 'run_for_time', (b, g) => `${selectedPort(b, g)}, ${value(b, g, 'DURATION')}, ${value(b, g, 'SPEED')}, stop=${stopCode(b, g)}`, { awaited: true });
call('motor_stop', 'motor', 'stop', (b, g) => `${selectedPort(b, g)}, stop=${stopCode(b, g)}`);
call('motor_position', 'motor', 'relative_position', selectedPort, { output: true });
call('motor_reset', 'motor', 'reset_relative_position', (b, g) => `${selectedPort(b, g)}, ${value(b, g, 'ANGLE')}`);
for (const [type, name, method] of [
  ['color', 'color_sensor', 'color'], ['reflection', 'color_sensor', 'reflection'],
  ['distance', 'distance_sensor', 'distance'], ['force', 'force_sensor', 'force'], ['force_pressed', 'force_sensor', 'pressed'],
]) call(type, name, method, selectedPort, { output: true });
pythonGenerator.forBlock.spike_color_constant = (b, g) => [`${module(g, 'color')}.${b.getFieldValue('COLOR')}`, Order.MEMBER];
call('pair', 'motor_pair', 'pair', (b, g) => `${selectedPair(b, g)}, ${selectedPort(b, g, 'LEFT')}, ${selectedPort(b, g, 'RIGHT')}`);
call('tank', 'motor_pair', 'move_tank', (b, g) => `${selectedPair(b, g)}, ${value(b, g, 'LEFT_SPEED')}, ${value(b, g, 'RIGHT_SPEED')}`);
call('pair_degrees', 'motor_pair', 'move_for_degrees', (b, g) => `${selectedPair(b, g)}, ${value(b, g, 'DEGREES')}, ${value(b, g, 'STEERING')}, velocity=${value(b, g, 'SPEED')}`, { awaited: true });
call('pair_stop', 'motor_pair', 'stop', (b, g) => `${selectedPair(b, g)}, stop=${stopCode(b, g)}`);
