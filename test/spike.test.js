import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/index.js';

const b = (type, fields = {}, inputs = {}) => ({ type, fields, inputs: Object.fromEntries(Object.entries(inputs).map(([key, block]) => [key, { block }])) });
const num = NUM => b('math_number', { NUM });
const text = TEXT => b('text', { TEXT });
const print = TEXT => b('text_print', {}, { TEXT });
const run = DO => b('spike_run', {}, { DO });
function chain(...blocks) {
  blocks.slice(0, -1).forEach((block, i) => { block.next = { block: blocks[i + 1] }; });
  return blocks[0];
}
function generate(blocks) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks } }, workspace);
    const code = pythonGenerator.workspaceToCode(workspace);
    assert.equal(code, pythonGenerator.workspaceToCode(workspace));
    return code;
  } finally { workspace.dispose(); }
}
function python(code) {
  const result = spawnSync('python3', ['-c', code], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}
applyLanguage('en');

test('SPIKE toolbox blocks in both languages compile, including all awaited actions', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    const group = createToolbox().contents.find(item => item.name === 'SPIKE Prime');
    const entries = group.contents.flatMap(item => item.contents).filter(item => item.kind === 'block');
    assert.equal(entries.length, 27);
    for (const entry of entries) {
      if (['spike_run', 'spike_on_condition'].includes(entry.type)) continue;
      const workspace = new Blockly.Workspace();
      try {
        const task = workspace.newBlock('spike_run');
        Blockly.serialization.blocks.append(entry, workspace);
        const block = workspace.getAllBlocks(false).find(item => item.type === entry.type);
        if (block.previousConnection) task.getInput('DO').connection.connect(block.previousConnection);
        else {
          const output = workspace.newBlock('text_print');
          output.getInput('TEXT').connection.connect(block.outputConnection);
          task.getInput('DO').connection.connect(output.previousConnection);
        }
        const code = pythonGenerator.workspaceToCode(workspace);
        python(`compile(${JSON.stringify(code)}, '<spike>', 'exec')`);
      } finally { workspace.dispose(); }
    }
  }
  applyLanguage('en');
});

test('SPIKE awaited operations require async scope and reject nested event loops', () => {
  for (const type of ['spike_until', 'spike_sleep', 'spike_write', 'spike_motor_degrees', 'spike_motor_time', 'spike_pair_degrees']) {
    assert.throws(() => generate([b(type)]), /SPIKE task/);
    assert.throws(() => generate([b('procedures_defnoreturn', { NAME: 'sync' }, { STACK: b(type) })]), /SPIKE task/);
  }
  assert.throws(() => generate([run(b('spike_run'))]), /run/);
});

test('SPIKE native calls preserve argument order, await completion, units and sentinel readings', () => {
  const code = generate([run(chain(
    b('spike_write', {}, { TEXT: text('Hi'), BRIGHTNESS: num(80), DURATION: num(200) }),
    b('spike_pixel', {}, { X: num(1), Y: num(4), BRIGHTNESS: num(60) }),
    b('spike_motor_degrees', { PORT: 'F', STOP: 'HOLD' }, { DEGREES: num(180), SPEED: num(-360) }),
    b('spike_motor_time', { PORT: 'B', STOP: 'COAST' }, { DURATION: num(500), SPEED: num(200) }),
    b('spike_sleep', {}, { DURATION: num(10) }),
    b('spike_pair', { LEFT: 'A', RIGHT: 'E', PAIR: 'PAIR_2' }),
    b('spike_tank', { PAIR: 'PAIR_2' }, { LEFT_SPEED: num(100), RIGHT_SPEED: num(-100) }),
    b('spike_pair_degrees', { PAIR: 'PAIR_2' }, { DEGREES: num(360), STEERING: num(-20), SPEED: num(280) }),
    b('spike_pair_stop', { PAIR: 'PAIR_2', STOP: 'BRAKE' }),
    print(b('spike_button', { BUTTON: 'RIGHT' })),
    print(b('spike_tilt', { AXIS: '1' })),
    print(b('spike_distance', { PORT: 'C' })),
    print(b('spike_force', { PORT: 'D' })),
    print(b('spike_force_pressed', { PORT: 'D' })),
    print(b('spike_reflection', { PORT: 'E' })),
    print(b('spike_color', { PORT: 'E' })),
    print(b('spike_color_constant', { COLOR: 'RED' })),
  ))]);
  assert.equal(code.match(/import motor as _spike_motor\n/g)?.length, 1);
  const setup = `import sys, types, asyncio
calls = []
def record(name):
    def call(*args, **kwargs):
        calls.append((name, args, kwargs))
    return call
def awaited(name):
    async def call(*args, **kwargs):
        await asyncio.sleep(0)
        calls.append((name, args, kwargs))
    return call
hub = types.ModuleType('hub')
hub.port = types.SimpleNamespace(**{c: i for i, c in enumerate('ABCDEF')})
async def write(text, intensity, time_per_character, /):
    await asyncio.sleep(0)
    calls.append(('write', (text, intensity, time_per_character), {}))
hub.light_matrix = types.SimpleNamespace(write=write, set_pixel=record('pixel'))
hub.button = types.SimpleNamespace(LEFT=1, RIGHT=2, pressed=lambda button: 123 if button == 2 else 0)
hub.motion_sensor = types.SimpleNamespace(tilt_angles=lambda: (900, -450, 0))
sys.modules['hub'] = hub
sys.modules['runloop'] = types.SimpleNamespace(run=asyncio.run, sleep_ms=awaited('sleep'))
sys.modules['motor'] = types.SimpleNamespace(BRAKE=1, COAST=0, HOLD=2, run_for_degrees=awaited('degrees'), run_for_time=awaited('time'))
sys.modules['motor_pair'] = types.SimpleNamespace(PAIR_2=1, pair=record('pair'), move_tank=record('tank'), move_for_degrees=awaited('pair_degrees'), stop=record('stop'))
sys.modules['distance_sensor'] = types.SimpleNamespace(distance=lambda port: -1)
sys.modules['force_sensor'] = types.SimpleNamespace(force=lambda port: 25, pressed=lambda port: True)
sys.modules['color_sensor'] = types.SimpleNamespace(reflection=lambda port: 70, color=lambda port: 9)
sys.modules['color'] = types.SimpleNamespace(RED=9)
`;
  const output = python(`${setup}\n${code}\nassert calls == [
('write', ('Hi', 80, 200), {}),
('pixel', (1, 4, 60), {}), ('degrees', (5, 180, -360), {'stop': 2}),
('time', (1, 500, 200), {'stop': 0}), ('sleep', (10,), {}),
('pair', (1, 0, 4), {}), ('tank', (1, 100, -100), {}),
('pair_degrees', (1, 360, -20), {'velocity': 280}), ('stop', (1,), {'stop': 1})
], calls`);
  assert.equal(output.trim(), '123\n-450\n-1\n25\nTrue\n70\n9\n9');
});

test('SPIKE hello example generates native runloop code', () => {
  const project = JSON.parse(readFileSync(new URL('../examples/spike-hello.blockly.json', import.meta.url), 'utf8'));
  const code = generate(project.workspace.blocks.blocks);
  assert.match(code, /await _spike_light_matrix.write\('Hello!', 100, 500\)/);
  assert.match(code, /_spike_runloop.run\(\s*_spike_task\(\),\s*\)/);
  assert.doesNotMatch(code, /asyncio|machine|pybricks/);
});

test('SPIKE until re-evaluates its predicate, passes timeout, and resumes on timeout', () => {
  const condition = b('spike_button_pressed');
  const code = generate([run(chain(
    b('spike_until', {}, { CONDITION: condition, TIMEOUT: num(0) }),
    print(text('pressed')),
    b('spike_until', {}, { CONDITION: b('logic_boolean', { BOOL: 'FALSE' }), TIMEOUT: num(30) }),
    print(text('timeout')),
  ))]);
  const output = python(`import sys, types, asyncio
reads = 0
calls = []
def pressed(button):
    global reads
    reads += 1
    return 20 if reads >= 3 else 0
async def until(predicate, timeout=0):
    calls.append(timeout)
    if timeout:
        assert predicate() is False
        return
    while not predicate():
        await asyncio.sleep(0)
sys.modules['hub'] = types.SimpleNamespace(button=types.SimpleNamespace(LEFT=1, pressed=pressed))
sys.modules['runloop'] = types.SimpleNamespace(run=asyncio.run, until=until)
${code}
assert reads == 3
assert calls == [0, 30]
`);
  assert.equal(output.trim(), 'pressed\ntimeout');
  assert.throws(() => generate([run(b('spike_until'))]), /condition/);
  assert.throws(() => generate([run(b('spike_until', {}, {
    CONDITION: b('logic_compare', { OP: 'EQ' }, { A: b('asyncio_await_task', {}, { TASK: b('python_name', { NAME: 'task' }) }), B: num(0) }),
  }))]), /async/);
});

test('SPIKE events require explicit scope and generation state does not leak', () => {
  assert.throws(() => generate([run(b('spike_run'))]), /run/);
  assert.throws(() => generate([b('spike_on_condition')]), /directly inside/);
  assert.throws(() => generate([run(b('spike_until'))]), /condition/);
  const code = generate([run(print(text('ok')))]);
  assert.equal((code.match(/_spike_runloop.run\(/g) || []).length, 1);
  assert.match(code, /print\('ok'\)/);
  assert.doesNotMatch(generate([print(text('plain'))]), /runloop/);
});

test('SPIKE polling listeners share runloop, ignore startup hold, re-arm and remain independent', () => {
  const listener = (BUTTON, message) => b('spike_on_condition', {}, { CONDITION: b('spike_button_pressed', { BUTTON }),
    DO: chain(print(text(message)), b('spike_sleep', {}, { DURATION: num(1) })),
  });
  const code = generate([run(chain(print(text('started')),
    listener('LEFT', 'left'), listener('RIGHT', 'right'),
    b('spike_on_condition', {}, { CONDITION: b('spike_force_pressed', { PORT: 'C' }), DO: print(text('left2')) }),
  ))]);
  assert.equal((code.match(/_spike_runloop.run\(/g) || []).length, 1);
  python(`import sys, types, asyncio
state = {1: 100, 2: 0}
events = []
def print(message): events.append(message)
class Done(Exception): pass
async def until(predicate, timeout=0):
    while not predicate():
        await asyncio.sleep(0)
async def sleep_ms(duration):
    await asyncio.sleep(0)
async def settle():
    for _ in range(10): await asyncio.sleep(0)
async def driver():
    await settle()
    assert events == ['started'], events
    state[1] = 0
    await settle()
    state[1] = state[2] = 80
    await settle()
    assert events.count('left') == events.count('left2') == events.count('right') == 1, events
    await settle()  # Holding cannot repeat an event.
    assert len(events) == 4, events
    state[1] = 0
    await settle()
    state[1] = 90
    await settle()
    assert events.count('left') == events.count('left2') == 2, events
    assert events.count('right') == 1, events
    state[2] = 0
    await settle()
    state[2] = 60
    await settle()
    assert events.count('right') == 2, events
    raise Done()
def run(*tasks):
    assert len(tasks) == 4
    async def together():
        try: await asyncio.gather(*tasks, driver())
        except Done: pass
    asyncio.run(together())
sys.modules['hub'] = types.SimpleNamespace(button=types.SimpleNamespace(LEFT=1, RIGHT=2, pressed=lambda b: state[b]), port=types.SimpleNamespace(C=2))
sys.modules['force_sensor'] = types.SimpleNamespace(pressed=lambda port: state[1] > 0)
sys.modules['runloop'] = types.SimpleNamespace(run=run, until=until, sleep_ms=sleep_ms)
${code}`);
});

test('SPIKE run blocks execute independently in program order', () => {
  const code = generate([chain(run(print(text('first'))), print(text('between')), run(print(text('second'))))]);
  assert.equal((code.match(/_spike_runloop.run\(/g) || []).length, 2);
  const output = python(`import sys, types, asyncio
sys.modules['runloop'] = types.SimpleNamespace(run=asyncio.run)
${code}`);
  assert.equal(output.trim(), 'first\nbetween\nsecond');
  assert.throws(() => generate([b('spike_on_condition', {}, { CONDITION: b('spike_button_pressed') })]), /directly inside/);
  assert.throws(() => generate([run(b('controls_repeat_ext', {}, {
    TIMES: num(2), DO: b('spike_on_condition', {}, { CONDITION: b('spike_button_pressed') }),
  }))]), /directly inside/);
});

test('named async procedures accept parameters and can be awaited from SPIKE events', () => {
  const parameter = { name: '角度', id: 'degrees' };
  const define = (NAME, body, params = []) => ({
    ...b('procedures_defnoreturn', { NAME, ASYNC: true }, { STACK: body }),
    extraState: { params },
  });
  const invoke = (name, args = {}) => ({
    ...b('procedures_callnoreturn', {}, args),
    extraState: { name, params: Object.keys(args).map(() => '角度') },
  });
  const back = define('後退', b('spike_pair_degrees', { PAIR: 'PAIR_1' }, {
    DEGREES: b('variables_get', { VAR: parameter }), STEERING: num(0), SPEED: num(180),
  }), [parameter]);
  const avoid = define('避障', invoke('後退', { ARG0: num(-90) }));
  const event = b('spike_on_condition', {}, {
    CONDITION: b('logic_boolean', { BOOL: 'TRUE' }), DO: invoke('避障'),
  });
  const code = generate([back, avoid, run(event)]);
  assert.match(code, /async def 後退\(角度\):/);
  assert.match(code, /await _spike_motor_pair\.move_for_degrees\([^\n]*角度/);
  assert.match(code, /async def 避障\(\):(?:\n  global 角度)?\s+await 後退\(-90\)/);
  assert.match(code, /await 避障\(\)/);
  assert.throws(() => generate([back, invoke('後退', { ARG0: num(-90) })]), /async task|异步任务/);
});
