import { Blocks, FieldCheckbox, FieldLabel, Procedures } from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import { t } from '../../i18n/index.js';
import { functionContext, inAsyncFunction } from '../../python/async-context.js';
import { PythonBlockError } from '../../python/errors.js';

const definitionType = 'procedures_defnoreturn';
const callType = 'procedures_callnoreturn';

function isAsync(block) {
  return block?.type === definitionType && block.getFieldValue('ASYNC') === 'TRUE';
}

function callsAsync(block) {
  const workspace = block.workspace.targetWorkspace ?? block.workspace;
  return isAsync(Procedures.getDefinition(block.getProcedureCall(), workspace));
}

const definition = Blocks[definitionType];
const initDefinition = definition.init;
definition.init = function () {
  initDefinition.call(this);
  this.appendDummyInput()
    .appendField(t('asyncProcedure'))
    .appendField(new FieldCheckbox('FALSE'), 'ASYNC');
};

const call = Blocks[callType];
const initCall = call.init;
call.init = function () {
  initCall.call(this);
  this.getInput('TOPROW').insertFieldAt(0, new FieldLabel(''), 'AWAIT_LABEL');
};

function updateCallLabel(block) {
  block.setFieldValue(callsAsync(block) ? t('awaitProcedure') : '', 'AWAIT_LABEL');
}

for (const method of ['domToMutation', 'loadExtraState', 'onchange']) {
  const original = call[method];
  call[method] = function (...args) {
    original.apply(this, args);
    updateCallLabel(this);
  };
}

const generateDefinition = pythonGenerator.forBlock[definitionType];
pythonGenerator.forBlock[definitionType] = (block, generator) => {
  if (!isAsync(block)) return functionContext(generator, false, () => generateDefinition(block, generator));
  const result = functionContext(generator, true, () => generateDefinition(block, generator));
  const name = generator.getProcedureName(block.getFieldValue('NAME'));
  const key = '%' + name;
  generator.definitions_[key] = generator.definitions_[key].replace(/^def /m, 'async def ');
  return result;
};

const generateCall = pythonGenerator.forBlock[callType];
pythonGenerator.forBlock[callType] = (block, generator) => {
  if (!callsAsync(block)) return generateCall(block, generator);
  if (!inAsyncFunction(generator)) throw new PythonBlockError(t('awaitProcedureContext'));
  return `await ${generateCall(block, generator)}`;
};
