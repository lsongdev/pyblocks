import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/hardware/pwm.js';

applyLanguage('en');
const number = NUM => ({block:{type:'math_number',fields:{NUM}}});
function generate(workspaceState) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(workspaceState, workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally { workspace.dispose(); }
}

test('generic buzzer and servo live in PWM while Microbit music stays board-specific', () => {
  const {contents} = createToolbox();
  assert.ok(!contents.some(category => category.name === 'Buzzer'));
  const pwm = contents.find(category => category.name === 'PWM');
  for (const type of ['buzzer_tone','buzzer_start','buzzer_stop','servo_angle','servo_pulse','servo_stop']) {
    assert.ok(pwm.contents.some(block => block.type === type), type);
  }
  assert.ok(!contents.find(category=>category.name==='Matrix:bit').contents.some(category=>category.name==='Buzzer'));
  assert.ok(contents.find(category=>category.name==='Micro:bit').contents.some(category=>category.name==='Buzzer'));
});

test('buzzer calls retain independent pins and support named board pins', () => {
  const code = generate({blocks:{languageVersion:0,blocks:[{
    type:'buzzer_start', inputs:{PIN:number(16), FREQ:number(440)}, next:{block:{
      type:'buzzer_start', inputs:{PIN:{block:{type:'text',fields:{TEXT:'GP18'}}}, FREQ:number(660)}, next:{block:{
        type:'buzzer_stop', inputs:{PIN:number(16)},
      }},
    }},
  }]}});
  assert.match(code, /_buzzer_start\(16, 440\)\n_buzzer_start\('GP18', 660\)\n_buzzer_stop\(16\)/);
  assert.match(code, /_buzzer_channels\.pop\(pin, None\)/);
  assert.ok(!code.includes('_matrixbit'));
});

test('generic buzzer toolbox blocks generate in both languages', () => {
  for (const language of ['en','zh-CN']) {
    applyLanguage(language);
    const buzzer = createToolbox().contents.find(category=>category.contents?.some(block=>block.type==='buzzer_tone'));
    for (const {kind,...block} of buzzer.contents.filter(block => block.type?.startsWith('buzzer_') || block.type?.startsWith('servo_'))) {
      assert.doesNotThrow(()=>generate({blocks:{languageVersion:0,blocks:[block]}}));
    }
  }
  applyLanguage('en');
});
