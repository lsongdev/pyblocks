import * as Blockly from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../i18n/index.js';
import { PythonBlockError } from '../python/errors.js';
import { isPythonIdentifier } from '../python/names.js';
import { inAsyncFunction } from '../python/async-context.js';

const colour = 210;
const argument = 'PythonArgument';
const statement = { previousStatement: null, nextStatement: null };
const expression = { output: null };
const text = (name, value) => ({ type: 'field_input', name, text: value });
const value = (name) => ({ type: 'input_value', name });
const args = { type: 'input_statement', name: 'ARGS', check: argument };

Blockly.common.defineBlocksWithJsonArray([
  {
    type: 'python_import',
    message0: blockMessage('importModule'),
    args0: [text('MODULE', 'time'), text('ALIAS', '')],
    tooltip: blockMessage('optionalAlias'),
    ...statement, colour,
  },
  {
    type: 'python_from_import',
    message0: blockMessage('importMember'),
    args0: [text('MODULE', 'machine'), text('NAME', 'Pin'), text('ALIAS', '')],
    tooltip: blockMessage('optionalAlias'),
    ...statement, colour,
  },
  {
    type: 'python_name',
    message0: blockMessage('pythonName'),
    args0: [text('NAME', 'Pin')],
    tooltip: blockMessage('nameHint'),
    ...expression, colour,
  },
  {
    type: 'python_member',
    message0: blockMessage('pythonMember'),
    args0: [value('OBJECT'), text('NAME', 'OUT')],
    inputsInline: true,
    ...expression, colour,
  },
  {
    type: 'python_call',
    message0: blockMessage('callResult'),
    args0: [value('CALLABLE')],
    message1: blockMessage('arguments'),
    args1: [args],
    ...expression, colour,
  },
  {
    type: 'python_call_statement',
    message0: blockMessage('callStatement'),
    args0: [value('CALLABLE')],
    message1: blockMessage('arguments'),
    args1: [args],
    ...statement, colour,
  },
  {
    type: 'python_expression_statement',
    message0: blockMessage('expressionStatement'),
    args0: [value('VALUE')], ...statement, colour,
    tooltip: blockMessage('expressionStatementHint'),
  },
  {
    type: 'python_await',
    message0: blockMessage('awaitExpression'),
    args0: [value('VALUE')], ...statement, colour: 260,
    tooltip: blockMessage('awaitExpressionHint'),
  },
  {
    type: 'python_await_value',
    message0: blockMessage('awaitExpressionValue'),
    args0: [value('VALUE')], ...expression, colour: 260,
    tooltip: blockMessage('awaitExpressionHint'),
  },
  {
    type: 'python_argument',
    message0: blockMessage('positionalArgument'),
    args0: [value('VALUE')],
    previousStatement: argument,
    nextStatement: argument,
    colour,
  },
  {
    type: 'python_keyword_argument',
    message0: blockMessage('keywordArgument'),
    args0: [text('NAME', 'value'), value('VALUE')],
    previousStatement: argument,
    nextStatement: argument,
    inputsInline: true,
    colour,
  },
]);


function identifier(name, label) {
  if (!isPythonIdentifier(name)) {
    throw new PythonBlockError(t('invalidIdentifier', label, name));
  }
  return name;
}

function moduleName(block) {
  return block.getFieldValue('MODULE').trim().split('.')
    .map(part => identifier(part, t('moduleName'))).join('.');
}

function alias(block) {
  const name = block.getFieldValue('ALIAS').trim();
  return name ? ` as ${identifier(name, t('aliasName'))}` : '';
}

function requiredValue(block, generator, input, order, label) {
  const code = generator.valueToCode(block, input, order);
  if (!code) throw new PythonBlockError(t('requiredExpression', label));
  return code;
}

function call(block, generator) {
  const target = requiredValue(block, generator, 'CALLABLE', Order.FUNCTION_CALL, t('callable'));
  const parameters = [];
  const keywordNames = new Set();
  for (let parameter = block.getInputTargetBlock('ARGS'); parameter; parameter = parameter.getNextBlock()) {
    if (!parameter.isEnabled()) continue;
    if (parameter.type === 'python_keyword_argument') {
      const name = identifier(parameter.getFieldValue('NAME').trim(), t('keywordName'));
      if (keywordNames.has(name)) throw new PythonBlockError(t('duplicateKeyword', name));
      keywordNames.add(name);
      parameters.push(`${name}=${requiredValue(parameter, generator, 'VALUE', Order.NONE, t('keywordValue'))}`);
    } else {
      if (keywordNames.size) throw new PythonBlockError(t('argumentOrder'));
      parameters.push(requiredValue(parameter, generator, 'VALUE', Order.NONE, t('positionValue')));
    }
  }
  return `${target}(${parameters.join(', ')})`;
}

function awaitExpression(block, generator) {
  if (!inAsyncFunction(generator)) throw new PythonBlockError(t('asyncContextRequired'));
  return 'await ' + requiredValue(block, generator, 'VALUE', Order.MEMBER, t('awaitableExpression'));
}

Object.assign(pythonGenerator.forBlock, {
  python_expression_statement: (block, generator) =>
    requiredValue(block, generator, 'VALUE', Order.NONE, t('expressionLabel')) + '\n',
  python_await: (block, generator) => awaitExpression(block, generator) + '\n',
  python_await_value: (block, generator) => ['(' + awaitExpression(block, generator) + ')', Order.ATOMIC],
  python_import: block => `import ${moduleName(block)}${alias(block)}\n`,
  python_from_import: block => {
    const name = identifier(block.getFieldValue('NAME').trim(), t('importedName'));
    return `from ${moduleName(block)} import ${name}${alias(block)}\n`;
  },
  python_name: block => [identifier(block.getFieldValue('NAME').trim(), t('pythonNameLabel')), Order.ATOMIC],
  python_member: (block, generator) => {
    const object = requiredValue(block, generator, 'OBJECT', Order.MEMBER, t('objectValue'));
    const name = identifier(block.getFieldValue('NAME').trim(), t('memberName'));
    const receiver = /^\d+$/.test(object) ? `(${object})` : object;
    return [`${receiver}.${name}`, Order.MEMBER];
  },
  python_call: (block, generator) => [call(block, generator), Order.FUNCTION_CALL],
  python_call_statement: (block, generator) => `${call(block, generator)}\n`,
  python_argument: () => '',
  python_keyword_argument: () => '',
});
