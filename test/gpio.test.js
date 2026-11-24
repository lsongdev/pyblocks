import test from 'node:test';
import assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import '../src/blocks/hardware/gpio.js';
import { createToolbox } from '../src/editor/toolbox.js';

applyLanguage('en');
const number = NUM => ({block:{type:'math_number',fields:{NUM}}});
function generate(state) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:[state]}},workspace);
    return pythonGenerator.workspaceToCode(workspace);
  } finally {workspace.dispose();}
}

test('digital input supports explicit pulls and keeps separate setup by default', () => {
  for (const [PULL, constant] of [['DOWN','_gpio_pin.PULL_DOWN'],['UP','_gpio_pin.PULL_UP'],['NONE','None']]) {
    const read = generate({type:'gpio_read_digital',fields:{PULL},inputs:{PIN:number(18)}});
    assert.ok(read.includes(`_gpio_pin(18, _gpio_pin.IN, pull=${constant}).value()`));
  }
  const code = generate({type:'gpio_set_pull',fields:{PULL:'DOWN'},inputs:{PIN:number(18)},next:{block:{
    type:'text_print',inputs:{TEXT:{block:{type:'gpio_read_digital',inputs:{PIN:number(18)}}}},
  }}});
  assert.match(code, /_gpio_pin\(18, _gpio_pin.IN, pull=_gpio_pin.PULL_DOWN\)/);
  assert.match(code, /print\(_gpio_pin\(18, _gpio_pin.IN\).value\(\)\)/);
});

test('edge event configures pull-down before registering a rising-edge interrupt', () => {
  const code = generate({type:'gpio_on_edge',fields:{PULL:'DOWN',EDGE:'rising'},inputs:{PIN:number(18)}});
  assert.match(code, /_gpio_irq_inputs.append\(_gpio_pin\(18, _gpio_pin.IN, pull=_gpio_pin.PULL_DOWN\)\)/);
  assert.match(code, /irq\(handler=_on_gpio_edge, trigger=_gpio_pin.IRQ_RISING\)/);
});

test('new GPIO blocks and pull controls work in both languages', () => {
  for (const language of ['en','zh-CN']) {
    applyLanguage(language);
    for (const type of ['gpio_set_pull','gpio_read_digital','gpio_write_digital','gpio_on_edge']) {
      assert.doesNotThrow(()=>generate({type}));
    }
  }
  applyLanguage('en');
});

test('Pins groups digital I/O and ADC without invented analog output wrappers', () => {
  const category = createToolbox().contents.find(category=>category.contents?.some(block=>block.type==='gpio_set_pull'));
  assert.deepEqual(category.contents.filter(block=>block.type).map(block=>block.type).sort(), ['adc_read_pin','gpio_on_edge','gpio_read_digital','gpio_set_pull','gpio_write_digital']);
  for (const type of ['gpio_write_analog','gpio_stop_analog','gpio_read_adc']) {
    assert.equal(Blockly.Blocks[type],undefined);
    assert.equal(pythonGenerator.forBlock[type],undefined);
  }
  const code = generate({type:'gpio_set_pull'});
  assert.ok(!code.includes('PWM'));
  assert.ok(!code.includes('ADC'));
});
