import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { PythonNames, readablePythonName, isPythonIdentifier } from '../src/python/names.js';
import '../src/blocks/python.js';
import '../src/blocks/hardware/gpio.js';
import '../src/blocks/hardware/timing.js';
applyLanguage('en');
const number = NUM => ({block:{type:'math_number',fields:{NUM}}});

function generate(state) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(state, workspace);
    const before = workspace.getVariableMap().getAllVariables().map(variable=>({id:variable.getId(),name:variable.getName()}));
    const code = pythonGenerator.workspaceToCode(workspace);
    assert.equal(pythonGenerator.workspaceToCode(workspace),code);
    assert.deepEqual(workspace.getVariableMap().getAllVariables().map(variable=>({id:variable.getId(),name:variable.getName()})),before);
    return code;
  } finally {workspace.dispose();}
}
const state = (blocks,variables=[]) => ({variables,blocks:{languageVersion:0,blocks}});

test('valid Unicode identifiers keep exact spelling across scripts and normalization forms', () => {
  const names=['按下次数','押した回数','누른횟수','счётчик','μετρητής','عداد','गिनती','ｃｏｕｎｔ','e\u0301','__name','变量2','가'];
  for (const name of names) {
    assert.equal(readablePythonName(name),name);
    assert.ok(isPythonIdentifier(name),name);
    const code=generate(state([{type:'variables_set',fields:{VAR:{id:'v'}},inputs:{VALUE:number(1)}}],[{name,id:'v'}]));
    assert.ok(code.includes(`${name} = 1`),name);
  }
});

test('invalid names retain legal characters and use a fallback only as needed', () => {
  for (const [input,expected] of [['123','var_123'],['1回目','var_1回目'],['１号','var_１号'],['按钮 次数','按钮_次数'],['이름-값','이름_값'],['a\u200Bb','a_b'],['😀计数','_计数'],['😀','variable'],['','variable'],['---','variable']]) {
    assert.equal(readablePythonName(input),expected);
    assert.ok(isPythonIdentifier(expected));
  }
});

test('allocator avoids keywords, builtins, normalization aliases and sanitized-name collisions', () => {
  const names=new PythonNames('class,print,_gpio_pin');
  assert.equal(names.getDistinctName('class','VARIABLE'),'class_2');
  assert.equal(names.getDistinctName('print','PROCEDURE'),'print_2');
  assert.equal(names.getDistinctName('_gpio_pin','VARIABLE'),'_gpio_pin_2');
  assert.equal(names.getDistinctName('ｃｌａｓｓ','VARIABLE'),'ｃｌａｓｓ_3');
  assert.equal(names.getDistinctName('a b','VARIABLE'),'a_b');
  assert.equal(names.getDistinctName('a-b','PROCEDURE'),'a_b_2');
  assert.equal(names.getDistinctName('a_b','VARIABLE'),'a_b_3');
  assert.equal(names.getDistinctName('count','VARIABLE'),'count');
  assert.equal(names.getDistinctName('ｃｏｕｎｔ','VARIABLE'),'ｃｏｕｎｔ_2');
  assert.equal(names.getDistinctName('async','VARIABLE'),'async_2');
  assert.equal(names.getDistinctName('await','PROCEDURE'),'await_2');
  names.reset();
  assert.equal(names.getDistinctName('count','VARIABLE'),'count');
});

test('Unicode procedure names, parameters and calls use the same mapping', () => {
  const code=generate(state([
    {type:'procedures_defreturn',fields:{NAME:'计算合计'},extraState:{params:[{name:'입력값',id:'arg'}]},inputs:{RETURN:{block:{type:'variables_get',fields:{VAR:{id:'arg'}}}}}},
    {type:'text_print',inputs:{TEXT:{block:{type:'procedures_callreturn',extraState:{name:'计算合计',params:['입력값']},inputs:{ARG0:number(3)}}}}},
  ],[{name:'입력값',id:'arg'}]));
  assert.match(code,/def 计算合计\(입력값\):/);
  assert.match(code,/return 입력값/);
  assert.match(code,/print\(计算合计\(3\)\)/);
});

test('numeric procedure names are corrected consistently in definitions and calls', () => {
  const code=generate(state([
    {type:'procedures_defnoreturn',fields:{NAME:'123'}},
    {type:'procedures_callnoreturn',extraState:{name:'123'}},
  ]));
  assert.match(code,/def var_123\(\):/);
  assert.match(code,/\nvar_123\(\)/);
});

test('imports reserve their bindings without changing explicit names or literal strings', () => {
  const code=generate(state([
    {type:'python_import',fields:{MODULE:'time',ALIAS:'计时'}},
    {type:'variables_set',fields:{VAR:{id:'v'}},inputs:{VALUE:number(2)}},
    {type:'text_print',inputs:{TEXT:{block:{type:'text',fields:{TEXT:'_E6_8C_89_ 计时'}}}}},
    {type:'python_name',fields:{NAME:'計測'}},
  ],[{id:'v',name:'计时'}]));
  assert.match(code,/import time as 计时/);
  assert.match(code,/计时_2 = 2/);
  assert.ok(code.includes("print('_E6_8C_89_ 计时')"));
  assert.match(code,/\n計測\n/);
});

test('saved debounce example preserves Chinese names and callback globals', () => {
  const example=JSON.parse(readFileSync(new URL('../examples/gpio-button-debounce.blockly.json',import.meta.url),'utf8'));
  const code=generate(example.workspace);
  assert.match(code,/按下次数 = 0/);
  assert.match(code,/global 最近变化时间/);
  assert.match(code,/检查时间 = 最近变化时间/);
  assert.match(code,/按下次数 = 按下次数 \+ 1/);
  assert.ok(!code.includes('_E6_'));
});
