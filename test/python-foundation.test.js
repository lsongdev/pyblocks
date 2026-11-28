import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Blockly from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import '../src/blocks/index.js';

applyLanguage('en');
const b = (type, fields = {}, inputs = {}) => ({ type, fields, inputs: Object.fromEntries(Object.entries(inputs).map(([key, block]) => [key, { block }])) });
const n = NUM => b('math_number', { NUM });
const s = TEXT => b('text', { TEXT });
const name = NAME => b('python_name', { NAME });
const get = id => b('variables_get', { VAR: { id } });
const set = (id, VALUE) => b('variables_set', { VAR: { id } }, { VALUE });
const print = TEXT => b('text_print', {}, { TEXT });
const evalBlock = VALUE => b('python_expression_statement', {}, { VALUE });
const list = (...items) => ({ ...b('lists_create_with', {}, Object.fromEntries(items.map((v,i)=>['ADD'+i,v]))), extraState: { itemCount: items.length } });
const entry = (KEY, VALUE) => b('python_dict_entry', {}, { KEY, VALUE });
function chain(...blocks) {
  blocks.slice(0,-1).forEach((block,i) => { block.next = { block: blocks[i+1] }; });
  return blocks[0];
}
function generate(blocks, variables = []) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({ variables, blocks: { languageVersion: 0, blocks } }, workspace);
    const code = pythonGenerator.workspaceToCode(workspace);
    assert.equal(pythonGenerator.workspaceToCode(workspace), code);
    return code;
  } finally { workspace.dispose(); }
}
function python(code, cwd) {
  const result = spawnSync('python3', ['-c', code], { cwd, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}
test('dictionary literals, key lookup, update, deletion and native indexing', () => {
  const code = generate([chain(
    set('d', b('python_dict', {}, { ITEMS: chain(entry(s('温度'), n(24)), entry(s('湿度'), n(60))) })),
    b('python_index_set', {}, { OBJECT: get('d'), KEY: s('温度'), VALUE: n(25) }),
    print(b('python_index', {}, { OBJECT: get('d'), KEY: s('温度') })),
    print(b('python_dict_get', {}, { OBJECT: get('d'), KEY: s('不存在'), DEFAULT: n(-1) })),
    b('python_index_delete', {}, { OBJECT: get('d'), KEY: s('湿度') }),
    print(b('python_membership', { OP: 'in' }, { VALUE: s('湿度'), OBJECT: get('d') })),
    print(b('python_index', {}, { OBJECT: list(n(4),n(5)), KEY: n(0) })),
    print(b('python_index', {}, { OBJECT: list(n(4),n(5)), KEY: n(-1) })),
  )], [{ id:'d', name:'数据' }]);
  assert.match(code, /数据\['温度'\] = 25/);
  assert.equal(python(code), '25\n-1\nFalse\n4\n5');
});
test('collections, native slices, conversions, bitwise grouping and range', () => {
  const convert = (TYPE, VALUE) => b('python_convert', { TYPE }, VALUE ? { VALUE } : {});
  const code = generate([chain(
    set('a', list(n(1),n(2),n(3))),
    b('python_list_append', {}, { OBJECT:get('a'), VALUE:n(4) }),
    print(b('python_slice', {}, { OBJECT:get('a'), STEP:n(-1) })),
    print(convert('tuple',get('a'))),
    print(b('python_length',{}, { VALUE:convert('set',list(n(1),n(1),n(2))) })),
    print(b('python_aggregate',{ METHOD:'sum' },{ VALUE:b('python_range',{}, { STOP:n(4) }) })),
    print(b('python_bitwise',{ OP:'&' },{ A:b('python_bitwise',{ OP:'<<' },{ A:n(1),B:n(3) }), B:n(15) })),
    print(b('python_bit_not',{}, { VALUE:n(0) })),
    print(convert('bytes',list(n(65),n(66)))),
  )], [{ id:'a', name:'values' }]);
  assert.equal(python(code), "[4, 3, 2, 1]\n(1, 2, 3, 4)\n2\n6\n8\n-1\nb'AB'");
});
test('attribute assignment and deletion preserve native member syntax', () => {
  const code = generate([chain(
    b('python_member_set',{ NAME:'值' },{ OBJECT:name('obj'), VALUE:n(7) }),
    print(b('python_member',{ NAME:'值' },{ OBJECT:name('obj') })),
    b('python_member_delete',{ NAME:'值' },{ OBJECT:name('obj') }),
  )]);
  assert.equal(python('class Object: pass\nobj = Object()\n'+code+'\nassert not hasattr(obj, "值")'), '7');
  assert.throws(() => generate([b('python_member_set',{ NAME:'class' },{ OBJECT:name('obj'), VALUE:n(1) })]), /identifier/i);
});
test('with open writes, reads and closes even when an exception escapes the body', t => {
  const dir=mkdtempSync(join(tmpdir(),'pyblocks-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const open = MODE => b('python_file_open',{ MODE },{ PATH:s('data.txt') });
  const file = id => get(id);
  const code = generate([chain(
    b('python_with',{ VAR:{id:'f'} },{ CONTEXT:open('w'), DO:evalBlock(b('python_file_write',{}, { OBJECT:file('f'), VALUE:s('hello') })) }),
    b('python_with',{ VAR:{id:'f'} },{ CONTEXT:open('r'), DO:print(b('python_file_read',{}, { OBJECT:file('f') })) }),
  )], [{id:'f',name:'文件'}]);
  assert.match(code,/with open\('data.txt', 'w'\) as 文件:/);
  assert.equal(python(code+'\nassert 文件.closed',dir),'hello');
  const bad=generate([b('python_with',{ VAR:{id:'f'} },{ CONTEXT:open('r'), DO:evalBlock(b('python_index',{}, { OBJECT:list(n(1)), KEY:n(9) })) })],[{id:'f',name:'文件'}]);
  python('try:\n'+bad.split('\n').map(l=>'    '+l).join('\n')+'\nexcept IndexError:\n    assert 文件.closed\nelse:\n    raise AssertionError("expected IndexError")',dir);
});
test('missing operands are rejected and all 38 new blocks appear in both languages', () => {
  for (const type of ['python_index','python_file_write','python_member_set']) {
    assert.throws(()=>generate([type==='python_member_set'?b(type):evalBlock(b(type))]), /Connect an expression/);
  }
  for (const language of ['en','zh-CN']) {
    applyLanguage(language);
    const entries=createToolbox().contents.flatMap(x=>x.contents??[]).filter(x=>x.kind==='block' && /^python_(index|slice|dict|list_|collection_|set_|convert|length|range|membership|bit|aggregate|member_(set|delete)|file_|with$)/.test(x.type));
    assert.equal(entries.length,38);
    assert.equal(new Set(entries.map(e=>e.type)).size,38);
    const workspace=new Blockly.Workspace();
    try {
      for(const e of entries) {
        const block=workspace.newBlock(e.type);
        assert.doesNotMatch(block.toString(), /%\{BKY_/);
      }
    } finally {workspace.dispose();}
  }
  applyLanguage('en');
});
