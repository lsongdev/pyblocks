import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { requiredValue, memberReceiver } from '../../python/expressions.js';

const statement = { previousStatement: null, nextStatement: null };
const value = name => ({ type: 'input_value', name });
const dropdown = (name, values) => ({ type: 'field_dropdown', name, options: values.map(v => [v, v]) });
const read = (b, g, name, order = Order.NONE) => requiredValue(b, g, name, order, t('expressionLabel'));
const expr = code => [code, Order.FUNCTION_CALL];

common.defineBlocksWithJsonArray([
  { type: 'python_file_open', message0: blockMessage('py_file_open'), args0: [value('PATH'), dropdown('MODE', ["r","w","a","rb","wb","ab","r+","w+","a+","r+b","w+b","a+b"])], output: null, colour: 35, tooltip: blockMessage('pyFileHint') },
  { type: 'python_file_read', message0: blockMessage('py_file_read'), args0: [value('OBJECT'), value('SIZE')], output: null, colour: 35 },
  { type: 'python_file_readline', message0: blockMessage('py_file_readline'), args0: [value('OBJECT')], output: null, colour: 35 },
  { type: 'python_file_write', message0: blockMessage('py_file_write'), args0: [value('OBJECT'), value('VALUE')], output: null, colour: 35 },
  { type: 'python_file_seek', message0: blockMessage('py_file_seek'), args0: [value('OBJECT'), value('OFFSET'), dropdown('WHENCE', ["0","1","2"])], output: null, colour: 35 },
  { type: 'python_file_tell', message0: blockMessage('py_file_tell'), args0: [value('OBJECT')], output: "Number", colour: 35 },
  { type: 'python_file_flush', message0: blockMessage('py_file_flush'), args0: [value('OBJECT')], ...statement, colour: 35 },
  { type: 'python_file_close', message0: blockMessage('py_file_close'), args0: [value('OBJECT')], ...statement, colour: 35 },
  { type: 'python_with', message0: blockMessage('py_with'), args0: [value('CONTEXT'), { type: 'field_variable', name: 'VAR', variable: 'file' }, { type: 'input_statement', name: 'DO' }], ...statement, colour: 35 },
]);
Object.assign(pythonGenerator.forBlock, {
  python_file_open: (b, g) => expr(`open(${read(b, g, 'PATH')}, ${g.quote_(b.getFieldValue('MODE'))})`),
  python_file_read: (b, g) => expr(`${memberReceiver(b, g, 'OBJECT')}.read(${g.valueToCode(b, 'SIZE', Order.NONE)})`),
  python_file_readline: (b, g) => expr(`${memberReceiver(b, g, 'OBJECT')}.readline()`),
  python_file_write: (b, g) => expr(`${memberReceiver(b, g, 'OBJECT')}.write(${read(b, g, 'VALUE')})`),
  python_file_seek: (b, g) => expr(`${memberReceiver(b, g, 'OBJECT')}.seek(${read(b, g, 'OFFSET')}, ${b.getFieldValue('WHENCE')})`),
  python_file_tell: (b, g) => expr(`${memberReceiver(b, g, 'OBJECT')}.tell()`),
  python_file_flush: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.flush()\n`,
  python_file_close: (b, g) => `${memberReceiver(b, g, 'OBJECT')}.close()\n`,
  python_with: (b, g) => `with ${read(b, g, 'CONTEXT')} as ${g.getVariableName(b.getFieldValue('VAR'))}:\n${g.statementToCode(b, 'DO') || g.PASS}`,
});
