import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import '../src/blocks/boards/microbit.js';
import '../src/blocks/shared/condition-events.js';

applyLanguage('en');

function generate(state) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [state] } }, workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally {
    workspace.dispose();
  }
}
const number = NUM => ({ block: { type: 'math_number', fields: { NUM } } });
const heart = { block: { type: 'microbit_image_builtin', fields: { IMAGE: 'HEART' } } };

test('show accepts an animation list and generates keyword playback options', () => {
  const code = generate({ type: 'microbit_show', fields: { WAIT: false, LOOP: true }, inputs: {
    IMAGE: { block: { type: 'lists_create_with', extraState: { itemCount: 2 }, inputs: {
      ADD0: heart, ADD1: { block: { type: 'microbit_image_builtin', fields: { IMAGE: 'HEART_SMALL' } } },
    } } }, DELAY: number(120),
  } });
  assert.match(code, /show\(\[_microbit.Image.HEART, _microbit.Image.HEART_SMALL\], delay=int\(120\), wait=False, loop=True\)/);
  assert.equal(code.match(/import microbit as _microbit/g).length, 1);
});

test('custom image rows retain brightness and reject invalid edits', () => {
  const workspace = new Blockly.Workspace();
  try {
    const block = workspace.newBlock('microbit_image_custom');
    block.setFieldValue('12345', 'ROW0');
    block.setFieldValue('invalid', 'ROW0');
    assert.equal(block.getFieldValue('ROW0'), '12345');
    const saved = Blockly.serialization.workspaces.save(workspace);
    workspace.clear();
    Blockly.serialization.workspaces.load(saved, workspace);
    assert.match(pythonGenerator.workspaceToCode(workspace), /Image\('12345:99999:99999:09990:00900'\)/);
  } finally { workspace.dispose(); }
});

test('image transformations can be composed into display input', () => {
  const code = generate({ type: 'microbit_show', inputs: { IMAGE: { block: {
    type: 'microbit_image_shift', fields: { DIRECTION: 'left' }, inputs: {
      AMOUNT: number(1), IMAGE: { block: { type: 'microbit_image_transform', fields: { METHOD: 'invert' }, inputs: { IMAGE: heart } } },
    },
  } }, DELAY: number(400) } });
  assert.match(code, /show\(_microbit.Image.HEART.invert\(\).shift_left\(int\(1\)\)/);
});

test('new block definitions and generators work in both languages', () => {
  const types = [
    'microbit_image_builtin', 'microbit_image_custom', 'microbit_image_transform', 'microbit_image_shift',
    'microbit_show', 'microbit_scroll', 'microbit_display_power', 'microbit_display_is_on',
    'microbit_music_pitch', 'microbit_music_melody', 'microbit_music_play', 'microbit_music_stop',
    'microbit_music_tempo', 'microbit_music_volume', 'microbit_speaker_power',
    'microbit_logo_is_touched',
    'microbit_write_analog', 'microbit_set_analog_period', 'microbit_set_pull',
    'microbit_light_level', 'microbit_temperature', 'microbit_running_time', 'microbit_acceleration',
  ];
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    for (const type of types) assert.doesNotThrow(() => generate({ type }));
  }
  applyLanguage('en');
});

test('V2 logo touch works as a Boolean condition and uses the generic condition event', () => {
  const condition = generate({ type: 'controls_if', inputs: {
    IF0: { block: { type: 'microbit_logo_is_touched' } },
    DO0: { block: { type: 'microbit_clear_display' } },
  } });
  assert.match(condition, /if _microbit.pin_logo.is_touched\(\):/);

  const event = generate({type:'events_when', inputs:{
    CONDITION:{block:{type:'microbit_logo_is_touched'}},
    DO:{block:{type:'microbit_clear_display'}},
  }});
  assert.match(event, /if _condition_sample\(_condition_state, _microbit.pin_logo.is_touched\(\), 0\):\n  _microbit_display.clear\(\)/);
  assert.doesNotMatch(event, /while True|_run_condition_events/);

});

test('music supports a sustained background tone and stops the selected output', () => {
  const code = generate({type: 'microbit_music_pitch', fields: {PIN: '1', WAIT: false}, inputs: {
    FREQ: number(440), DURATION: number(-1),
  }, next: {block: {type: 'microbit_music_stop', fields: {PIN: '1'}}}});
  assert.match(code, /pitch\(int\(440\), int\(-1\), pin=_microbit.pin1, wait=False\)/);
  assert.match(code, /stop\(_microbit.pin1\)/);
  assert.equal(code.match(/import music as _microbit_music/g).length, 1);
});

test('melodies compose with playback controls and tempo uses named parameters', () => {
  const code = generate({type: 'microbit_music_tempo', inputs: {BPM: number(180), TICKS: number(4)}, next: {block: {
    type: 'microbit_music_play', fields: {WAIT: false, LOOP: true}, inputs: {
      NOTES: {block: {type: 'microbit_music_melody', fields: {MELODY: 'BA_DING'}}},
    },
  }}});
  assert.match(code, /set_tempo\(ticks=int\(4\), bpm=int\(180\)\)/);
  assert.match(code, /play\(_microbit_music.BA_DING, pin=_microbit.pin0, wait=False, loop=True\)/);
});

test('P2 raw PWM and period blocks call native Microbit APIs without servo wrappers', () => {
  const code = generate({type:'microbit_write_analog',fields:{PIN:'2'},inputs:{DUTY:number(77)},next:{block:{
    type:'microbit_set_analog_period',fields:{PIN:'2',UNIT:'ms'},inputs:{PERIOD:number(20)},
  }}});
  assert.match(code, /_microbit.pin2.write_analog\(int\(77\)\)\n_microbit.pin2.set_analog_period\(int\(20\)\)/);
  assert.ok(!code.includes('machine'));
  assert.ok(!code.includes('def '));
  const micros = generate({type:'microbit_set_analog_period',fields:{PIN:'2',UNIT:'us'},inputs:{PERIOD:number(20000)}});
  assert.match(micros, /pin2.set_analog_period_microseconds\(int\(20000\)\)/);
});

test('P2 input pull selection uses the selected pin constants', () => {
  for (const PULL of ['PULL_DOWN','PULL_UP','NO_PULL']) {
    const code = generate({type:'microbit_set_pull',fields:{PIN:'2',PULL}});
    assert.ok(code.includes(`_microbit.pin2.set_pull(_microbit.pin2.${PULL})`));
    assert.ok(!code.includes('machine'));
  }
});
