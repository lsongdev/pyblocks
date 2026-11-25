import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';

common.defineBlocksWithJsonArray([
  { type: 'bytes_encode_utf8', message0: blockMessage('bytesEncodeUtf8'),
    args0: [{ type: 'input_value', name: 'VALUE', check: 'String' }], output: 'Bytes', colour: 160 },
  { type: 'bytes_decode_utf8', message0: blockMessage('bytesDecodeUtf8'),
    args0: [{ type: 'input_value', name: 'VALUE', check: 'Bytes' }], output: 'String', colour: 160,
    tooltip: blockMessage('bytesDecodeHint') },
]);

for (const [type, method] of [['bytes_encode_utf8', 'encode'], ['bytes_decode_utf8', 'decode']]) {
  pythonGenerator.forBlock[type] = (block, generator) => {
    const value = generator.valueToCode(block, 'VALUE', Order.MEMBER);
    if (!value) throw new PythonBlockError(t('requiredExpression', t('bytesValue')));
    return [`${value}.${method}('utf-8')`, Order.FUNCTION_CALL];
  };
}
