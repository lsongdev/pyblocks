import { Names } from 'blockly/core';

export function eventHandler(block, generator, baseName, { parameters = [], setup = '' } = {}) {
  const name = generator.nameDB_.getDistinctName(baseName, Names.NameType.PROCEDURE);
  const variables = new Set();
  const bodyBlock = block.getInputTargetBlock('DO');
  for (const child of bodyBlock?.getDescendants(false) ?? []) {
    for (const variable of child.getVarModels()) {
      const variableName = generator.getVariableName(variable.getId());
      if (!parameters.includes(variableName)) variables.add(variableName);
    }
  }
  const globals = variables.size ? `${generator.INDENT}global ${[...variables].join(', ')}\n` : '';
  const body = generator.statementToCode(block, 'DO') || `${generator.INDENT}pass\n`;
  return { name, code: `def ${name}(${parameters.join(', ')}):\n${globals}${setup}${body}\n` };
}
