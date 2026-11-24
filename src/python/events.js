import { Names } from 'blockly/core';

export function eventHandler(block, generator, baseName, parameter = '') {
  const name = generator.nameDB_.getDistinctName(baseName, Names.NameType.PROCEDURE);
  const variables = new Set();
  const bodyBlock = block.getInputTargetBlock('DO');
  for (const child of bodyBlock?.getDescendants(false) ?? []) {
    for (const variable of child.getVarModels()) {
      variables.add(generator.getVariableName(variable.getId()));
    }
  }
  const globals = variables.size ? `${generator.INDENT}global ${[...variables].join(', ')}\n` : '';
  const body = generator.statementToCode(block, 'DO') || `${generator.INDENT}pass\n`;
  return { name, code: `def ${name}(${parameter}):\n${globals}${body}\n` };
}
