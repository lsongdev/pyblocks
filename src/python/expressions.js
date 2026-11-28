import { Order } from 'blockly/python';
import { t } from '../i18n/index.js';
import { PythonBlockError } from './errors.js';
import { isPythonIdentifier } from './names.js';

export function identifier(name, label) {
  if (!isPythonIdentifier(name)) throw new PythonBlockError(t('invalidIdentifier', label, name));
  return name;
}

export function requiredValue(block, generator, input, order, label) {
  const code = generator.valueToCode(block, input, order);
  if (!code) throw new PythonBlockError(t('requiredExpression', label));
  return code;
}

export function memberReceiver(block, generator, input) {
  const code = requiredValue(block, generator, input, Order.MEMBER, t('objectValue'));
  return /^\d+$/.test(code) ? '(' + code + ')' : code;
}
