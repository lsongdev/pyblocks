import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import { conditionEventRuntime } from '../src/python/condition-events.js';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/index.js';
const b = (type, fields = {}, inputs = {}) => ({ type, fields, inputs: Object.fromEntries(Object.entries(inputs).map(([key, block]) => [key, { block }])) });
const num = NUM => b('math_number', { NUM });
const text = TEXT => b('text', { TEXT });
const print = TEXT => b('text_print', {}, { TEXT });
const when = (CONDITION, DO, STABLE = 0) => b('events_when', { STABLE }, { CONDITION, DO });
function chain(...blocks) { blocks.slice(0, -1).forEach((block, i) => { block.next = { block: blocks[i + 1] }; }); return blocks[0]; }
function generate(blocks, variables = []) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({variables,blocks:{languageVersion:0,blocks}},workspace);
    const code = pythonGenerator.workspaceToCode(workspace);
    assert.equal(pythonGenerator.workspaceToCode(workspace),code);
    return code;
  } finally { workspace.dispose(); }
}
function python(code) {
  const result = spawnSync('python3', ['-c', code], {encoding:'utf8',timeout:5000});
  assert.equal(result.status,0,result.stderr || result.error?.message);
  return result.stdout;
}
applyLanguage('en');

test('condition edges debounce both transitions, suppress startup hold and handle tick wrap', () => {
  python(`import types
now = 0
state = False
_condition_time = types.SimpleNamespace(ticks_ms=lambda: now % 256, ticks_diff=lambda a,b: (a-b+128)%256-128)
${conditionEventRuntime}
def make_poll(read, delay):
    memory = []
    _condition_sample(memory, read(), delay)
    return lambda: _condition_sample(memory, read(), delay)
read = lambda: state
poll = make_poll(read, 25)
def sample(t, value, expected):
    global now, state
    now, state = t, value
    assert poll() == expected, (t, value, expected)
sample(1, True, False)
sample(5, False, False)
sample(8, True, False)
sample(32, True, False)
sample(33, True, True)
sample(80, True, False)
sample(81, False, False)
sample(85, True, False)
sample(90, False, False)
sample(115, False, False)
sample(120, True, False)
sample(145, True, True)
# Initial true is ignored until stable release and a new press.
held = make_poll(read, 0)
assert held() is False
state = False
assert held() is False
state = True
assert held() is True
assert held() is False
# Timers use ticks_diff across counter wrap.
state, now = False, 240
wrapped = make_poll(read, 25)
sample = None
state, now = True, 250
assert wrapped() is False
now = 276
assert wrapped() is True
# Same predicate, independent stability intervals.
state, now = False, 300
fast, slow = make_poll(read, 0), make_poll(read, 25)
state, now = True, 301
assert fast() is True and slow() is False
now = 326
assert fast() is False and slow() is True
`);
});

test('synchronous events check once inside a user sensor loop, retain state and return control', () => {
  const variables = [{id:'count',name:'按下次数'},{id:'sensor',name:'最新读数'}];
  const get = () => b('variables_get',{VAR:{id:'count'}});
  const left = when(b('m5_button',{BUTTON:'BtnA',METHOD:'isPressed'}),chain(
    b('variables_set',{VAR:{id:'count'}},{VALUE:b('math_arithmetic',{OP:'ADD'},{A:get(),B:num(1)})}), print(text('left')),
  ));
  const right = when(b('m5_button',{BUTTON:'BtnB',METHOD:'isPressed'}),print(text('right')));
  const loop = b('controls_repeat_ext',{}, {TIMES:num(7),DO:chain(
    b('m5_update'),
    b('variables_set',{VAR:{id:'sensor'}},{VALUE:b('m5_stick_accel',{AXIS:'Z'})}),left,right,
  )});
  const code = generate([chain(b('variables_set',{VAR:{id:'count'}},{VALUE:num(0)}),b('m5_begin'),loop,print(text('done')))],variables);
  assert.doesNotMatch(code,/global 按下次数|asyncio|runloop|while True|sleep_ms|def _on_condition/);
  assert.equal(code.match(/_m5.update\(\)/g)?.length,1);
  const output = python(`import sys, types
step = -1
samples = []
states = [(True,False),(True,False),(False,False),(True,True),(True,True),(False,True),(True,False)]
class Button:
    def __init__(self,index): self.index=index
    def isPressed(self): return states[step][self.index]
def update():
    global step
    step += 1
def accel():
    samples.append(step)
    return (0,0,step)
sys.modules['M5'] = types.SimpleNamespace(begin=lambda:None,update=update,BtnA=Button(0),BtnB=Button(1),Imu=types.SimpleNamespace(getAccel=accel))
sys.modules['utime'] = types.SimpleNamespace(ticks_ms=lambda:step*10,ticks_diff=lambda a,b:a-b)
${code}
assert 按下次数 == 2, 按下次数
assert 最新读数 == 6
assert samples == list(range(7))
`);
  assert.equal(output.trim(),'left\nright\nleft\ndone');
  assert.doesNotMatch(generate([when(b('m5_button'),print(text('press')))]),/\.update\(/);
});

test('async listeners stay top-level while synchronous checks can be nested', () => {
  assert.doesNotThrow(()=>generate([b('controls_repeat_ext',{}, {TIMES:num(2),DO:when(b('logic_boolean'),print(text('x')))})]));
  assert.throws(()=>generate([b('controls_repeat_ext',{}, {TIMES:num(2),DO:{...when(b('logic_boolean'),print(text('x'))),type:'events_when_async'}})]),/previous/);
  assert.throws(()=>generate([when(b('logic_boolean'),b('asyncio_sleep'))]),/async/);
  assert.throws(()=>generate([b('events_when')]),/condition/);
  assert.doesNotMatch(generate([print(text('plain'))]),/_run_condition_events|_condition_time/);
  assert.match(generate([when(b('logic_boolean'),print(text('ok')))]),/print\('ok'\)/);
});

test('generic events compile for all state sources in both languages without touching SPIKE', () => {
  for (const language of ['en','zh-CN']) {
    applyLanguage(language);
    const toolbox = JSON.stringify(createToolbox());
    for (const old of ['microbit_on_button_pressed','matrixbit_on_button_pressed','matrixbit_on_touch','microbit_on_logo_touched']) assert.ok(!toolbox.includes(old));
    assert.ok(toolbox.includes('spike_on_condition'));
    for (const condition of [b('microbit_button_is_pressed'),b('microbit_logo_is_touched'),b('matrixbit_button_is_pressed'),b('matrixbit_touch_is_touched',{}, {THRESHOLD:num(400)}),b('m5_button')]) {
      const code = generate([when(condition,print(text('event')),25)]);
      python(`compile(${JSON.stringify(code)}, '<events>', 'exec')`);
    }
    for (const file of ['microbit-condition-events','matrixbit-condition-events','m5-condition-events','m5-sync-sensors']) {
      const project = JSON.parse(readFileSync(new URL(`../examples/${file}.blockly.json`, import.meta.url)));
      const code = generate(project.workspace.blocks.blocks, project.workspace.variables);
      python(`compile(${JSON.stringify(code)}, '<example>', 'exec')`);
    }
  }
  applyLanguage('en');
});

test('async condition listeners cooperate, re-arm and share an optional explicit asyncio entry', () => {
  for (const foreground of [false,true]) {
    const left = when(b('m5_button',{BUTTON:'BtnA'}),chain(print(text('left')),b('asyncio_sleep',{UNIT:'MS'},{DURATION:num(1000)})));
    const right = when(b('m5_button',{BUTTON:'BtnB'}),print(text('right')));
    left.type = right.type = 'events_when_async';
    const blocks = [left,right];
    if (foreground) blocks.push(b('asyncio_run',{}, {DO:print(text('main'))}));
    const code = generate(blocks);
    assert.equal(code.match(/_asyncio.run\(/g)?.length,1);
    assert.doesNotMatch(code,/\x00|pyblocks_async_entry/);
    assert.doesNotMatch(code,/\.update\(/);
    python(`import sys, types, asyncio, time
state = [False, False]
events = []
started = None
release = None
def print(value): events.append(value)
class Done(Exception): pass
async def sleep_ms(ms):
    if ms == 1000:
        started.set()
        await release.wait()
    else:
        await asyncio.sleep(0)
async def settle():
    for _ in range(15): await asyncio.sleep(0)
async def driver():
    await settle()
    state[0] = True
    await started.wait()
    assert events.count('left') == 1, events
    state[1] = True
    await settle()
    assert events.count('right') == 1, events  # left handler is still waiting
    assert events.count('left') == 1, events
    state[0] = state[1] = False
    release.set()
    await settle()
    state[0] = True
    await settle()
    assert events.count('left') == 2, events
    assert events.count('main') == ${foreground ? 1 : 0}, events
    raise Done()
original_run = asyncio.run
def run(coro):
    async def together():
        global started, release
        started, release = asyncio.Event(), asyncio.Event()
        try: await asyncio.gather(coro, driver())
        except Done: pass
    original_run(together())
asyncio.run = run
asyncio.sleep_ms = sleep_ms
class Button:
    def __init__(self,index): self.index=index
    def isPressed(self): return state[self.index]
sys.modules['M5'] = types.SimpleNamespace(BtnA=Button(0),BtnB=Button(1))
sys.modules['utime'] = types.SimpleNamespace(ticks_ms=lambda:int(time.monotonic()*1000),ticks_diff=lambda a,b:a-b)
${code}`);
  }
});

test('scheduling is an explicit block choice and conflicting loops produce actionable errors', () => {
  const sync = () => when(b('logic_boolean'),print(text('sync')));
  const asyncEvent = () => ({...when(b('logic_boolean'),print(text('async'))),type:'events_when_async'});
  assert.doesNotThrow(()=>generate([sync(),asyncEvent()]));
  assert.doesNotThrow(()=>generate([b('asyncio_run',{}, {DO:sync()})]));
  assert.throws(()=>generate([asyncEvent(),b('asyncio_run'),b('asyncio_run')]),/at most one/);
  // No board-name checks: choosing the async block is the user's responsibility.
  const microbit = {...when(b('microbit_button_is_pressed'),print(text('chosen'))),type:'events_when_async'};
  assert.match(generate([microbit]),/import asyncio/);
  const literal = generate([b('asyncio_run',{}, {DO:print(text('# __pyblocks_async_entry_0__'))})]);
  assert.match(literal,/print\('# __pyblocks_async_entry_0__'\)/);
});

test('synchronous checks use procedure parameters directly and first sample only when reached', () => {
  const parameter = {id:'flag',name:'状态'};
  const event = when(b('variables_get',{VAR:{id:'flag'}}),print(text('hit')));
  const code = generate([{
    type:'procedures_defnoreturn',fields:{NAME:'检查'},extraState:{params:[parameter]},inputs:{STACK:{block:event}},
  }],[parameter]);
  assert.match(code,/def 检查\(状态\):/);
  assert.doesNotMatch(code,/lambda: 状态|def _on_condition/);
  const output = python(`import sys, types
reads = 0
def tick():
    global reads
    reads += 1
    return reads
sys.modules['utime'] = types.SimpleNamespace(ticks_ms=tick,ticks_diff=lambda a,b:a-b)
${code}
assert reads == 0
检查(True)
检查(True)
检查(False)
检查(True)
检查(True)
检查(False)
检查(True)
assert reads == 7
`);
  assert.equal(output.trim(),'hit\nhit');
});
