import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { requiredValue, identifier, memberReceiver } from '../../python/expressions.js';

const statement = { previousStatement: null, nextStatement: null };
const value = name => ({ type: 'input_value', name });
const dropdown = (name, values) => ({ type: 'field_dropdown', name, options: values.map(v => [v, v]) });
const field = (name, text) => ({ type: 'field_input', name, text });
const read = (b, g, name, order = Order.NONE) => requiredValue(b, g, name, order, t('expressionLabel'));
const expr = code => [code, Order.FUNCTION_CALL];

common.defineBlocksWithJsonArray([
  { type: 'python_index', message0: blockMessage('py_index'), args0: [value('OBJECT'), value('KEY')], output: null, colour: 260, tooltip: blockMessage('pyNativeIndexHint') },
  { type: 'python_index_set', message0: blockMessage('py_index_set'), args0: [value('OBJECT'), value('KEY'), value('VALUE')], ...statement, colour: 260 },
  { type: 'python_index_delete', message0: blockMessage('py_index_delete'), args0: [value('OBJECT'), value('KEY')], ...statement, colour: 260 },
  { type: 'python_slice', message0: blockMessage('py_slice'), args0: [value('OBJECT'), value('START'), value('STOP'), value('STEP')], output: null, colour: 260, tooltip: blockMessage('pySliceHint') },
  { type: 'python_dict', message0: blockMessage('py_dict'), args0: [{ type: 'input_statement', name: 'ITEMS', check: 'PythonDictEntry' }], output: null, colour: 260 },
  { type: 'python_dict_entry', message0: blockMessage('py_dict_entry'), args0: [value('KEY'), value('VALUE')], previousStatement: 'PythonDictEntry', nextStatement: 'PythonDictEntry', colour: 260 },
  { type: 'python_dict_get', message0: blockMessage('py_dict_get'), args0: [value('OBJECT'), value('KEY'), value('DEFAULT')], output: null, colour: 260 },
  { type: 'python_dict_view', message0: blockMessage('py_dict_view'), args0: [value('OBJECT'), dropdown('METHOD', ["keys","values","items"])], output: null, colour: 260 },
  { type: 'python_dict_update', message0: blockMessage('py_dict_update'), args0: [value('OBJECT'), value('VALUE')], ...statement, colour: 260 },
  { type: 'python_list_append', message0: blockMessage('py_list_append'), args0: [value('OBJECT'), value('VALUE')], ...statement, colour: 260 },
  { type: 'python_list_extend', message0: blockMessage('py_list_extend'), args0: [value('OBJECT'), value('VALUE')], ...statement, colour: 260 },
  { type: 'python_list_insert', message0: blockMessage('py_list_insert'), args0: [value('OBJECT'), value('KEY'), value('VALUE')], ...statement, colour: 260 },
  { type: 'python_collection_remove', message0: blockMessage('py_collection_remove'), args0: [value('OBJECT'), value('VALUE')], ...statement, colour: 260 },
  { type: 'python_collection_pop', message0: blockMessage('py_collection_pop'), args0: [value('OBJECT'), value('KEY')], output: null, colour: 260 },
  { type: 'python_collection_clear', message0: blockMessage('py_collection_clear'), args0: [value('OBJECT')], ...statement, colour: 260 },
  { type: 'python_list_sort', message0: blockMessage('py_list_sort'), args0: [value('OBJECT'), { type: 'field_checkbox', name: 'REVERSE', checked: false }], ...statement, colour: 260 },
  { type: 'python_list_reverse', message0: blockMessage('py_list_reverse'), args0: [value('OBJECT')], ...statement, colour: 260 },
  { type: 'python_set_add', message0: blockMessage('py_set_add'), args0: [value('OBJECT'), value('VALUE')], ...statement, colour: 260 },
  { type: 'python_set_discard', message0: blockMessage('py_set_discard'), args0: [value('OBJECT'), value('VALUE')], ...statement, colour: 260 },
  { type: 'python_set_operation', message0: blockMessage('py_set_operation'), args0: [value('OBJECT'), dropdown('OP', ["union","intersection","difference","symmetric_difference"]), value('VALUE')], output: null, colour: 260 },
  { type: 'python_convert', message0: blockMessage('py_convert'), args0: [dropdown('TYPE', ["list","tuple","dict","set","bytes","bytearray","int","float","str","bool"]), value('VALUE')], output: null, colour: 260 },
  { type: 'python_length', message0: blockMessage('py_length'), args0: [value('VALUE')], output: "Number", colour: 260 },
  { type: 'python_range', message0: blockMessage('py_range'), args0: [value('START'), value('STOP'), value('STEP')], output: null, colour: 260 },
  { type: 'python_membership', message0: blockMessage('py_membership'), args0: [value('VALUE'), dropdown('OP', ["in","not in","is","is not"]), value('OBJECT')], output: "Boolean", colour: 210 },
  { type: 'python_bitwise', message0: blockMessage('py_bitwise'), args0: [value('A'), dropdown('OP', ["&","|","^","<<",">>","//"]), value('B')], output: "Number", colour: 230 },
  { type: 'python_bit_not', message0: blockMessage('py_bit_not'), args0: [value('VALUE')], output: "Number", colour: 230 },
  { type: 'python_aggregate', message0: blockMessage('py_aggregate'), args0: [dropdown('METHOD', ["sum","min","max","abs","round","hex","bin","oct","ord","chr","all","any","sorted","reversed","enumerate"]), value('VALUE')], output: null, colour: 230 },
  { type: 'python_member_set', message0: blockMessage('py_member_set'), args0: [value('OBJECT'), field('NAME', 'value'), value('VALUE')], ...statement, colour: 210 },
  { type: 'python_member_delete', message0: blockMessage('py_member_delete'), args0: [value('OBJECT'), field('NAME', 'value')], ...statement, colour: 210 },
]);
Object.assign(pythonGenerator.forBlock, {
  python_index: (b, g) => [`${memberReceiver(b, g, 'OBJECT')}[${read(b, g, 'KEY')}]`, Order.MEMBER],
  python_index_set: (b, g) => `${memberReceiver(b, g, 'OBJECT')}[${read(b, g, 'KEY')}]` + ' = ' + read(b, g, 'VALUE') + '\n',
  python_index_delete: (b, g) => 'del ' + `${memberReceiver(b, g, 'OBJECT')}[${read(b, g, 'KEY')}]` + '\n',
  python_slice: (b, g) => {
    const start = g.valueToCode(b, 'START', Order.NONE);
    const stop = g.valueToCode(b, 'STOP', Order.NONE);
    const step = g.valueToCode(b, 'STEP', Order.NONE);
    return [`${memberReceiver(b, g, 'OBJECT')}[${start}:${stop}${step ? ':' + step : ''}]`, Order.MEMBER];
  },
  python_dict: (b, g) => {
    const items = [];
    for (let item = b.getInputTargetBlock('ITEMS'); item; item = item.getNextBlock()) {
      if (item.isEnabled()) items.push(read(item, g, 'KEY') + ': ' + read(item, g, 'VALUE'));
    }
    return ['{' + items.join(', ') + '}', Order.COLLECTION];
  },
  python_dict_entry: () => '',
  python_dict_get: (b, g) => expr(`${memberReceiver(b, g, 'OBJECT')}.get(${read(b, g, 'KEY')}, ${g.valueToCode(b, 'DEFAULT', Order.NONE) || 'None'})`),
  python_dict_view: (b, g) => expr(`${memberReceiver(b, g, 'OBJECT')}.${b.getFieldValue('METHOD')}()`),
  python_dict_update: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.update(${read(b, g, 'VALUE')})\n`,
  python_list_append: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.append(${read(b, g, 'VALUE')})\n`,
  python_list_extend: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.extend(${read(b, g, 'VALUE')})\n`,
  python_list_insert: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.insert(${read(b, g, 'KEY')}, ${read(b, g, 'VALUE')})\n`,
  python_collection_remove: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.remove(${read(b, g, 'VALUE')})\n`,
  python_collection_pop: (b, g) => expr(`${memberReceiver(b, g, 'OBJECT')}.pop(${g.valueToCode(b, 'KEY', Order.NONE)})`),
  python_collection_clear: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.clear()\n`,
  python_list_sort: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.sort(reverse=${b.getFieldValue('REVERSE') === 'TRUE' ? 'True' : 'False'})\n`,
  python_list_reverse: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.reverse()\n`,
  python_set_add: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.add(${read(b, g, 'VALUE')})\n`,
  python_set_discard: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.discard(${read(b, g, 'VALUE')})\n`,
  python_set_operation: (b, g) => expr(`${memberReceiver(b, g, 'OBJECT')}.${b.getFieldValue('OP')}(${read(b, g, 'VALUE')})`),
  python_convert: (b, g) => expr(`${b.getFieldValue('TYPE')}(${g.valueToCode(b, 'VALUE', Order.NONE)})`),
  python_length: (b, g) => expr('len(' + read(b, g, 'VALUE') + ')'),
  python_range: (b, g) => expr(`range(${g.valueToCode(b, 'START', Order.NONE) || '0'}, ${read(b, g, 'STOP')}, ${g.valueToCode(b, 'STEP', Order.NONE) || '1'})`),
  python_membership: (b, g) => [`(${read(b, g, 'VALUE')}) ${b.getFieldValue('OP')} (${read(b, g, 'OBJECT')})`, Order.RELATIONAL],
  python_bitwise: (b, g) => {
    const op = b.getFieldValue('OP');
    // Explicit grouping preserves the AST even for mixed binary operators.
    return [`((${read(b, g, 'A')}) ${op} (${read(b, g, 'B')}))`, Order.ATOMIC];
  },
  python_bit_not: (b, g) => [`~(${read(b, g, 'VALUE')})`, Order.BITWISE_NOT],
  python_aggregate: (b, g) => expr(`${b.getFieldValue('METHOD')}(${read(b, g, 'VALUE')})`),
  python_member_set: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.${identifier(b.getFieldValue('NAME').trim(), t('memberName'))} = ${read(b, g, 'VALUE')}\n`,
  python_member_delete: (b, g) => `del ${memberReceiver(b, g, 'OBJECT')}.${identifier(b.getFieldValue('NAME').trim(), t('memberName'))}\n`,
});
