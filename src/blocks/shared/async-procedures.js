import { Blocks, FieldCheckbox, Procedures } from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import { t } from '../../i18n/index.js';
import { functionContext } from '../../python/async-context.js';

for (const type of ['procedures_defnoreturn', 'procedures_defreturn']) {
  const definition = Blocks[type];
  const init = definition.init;
  definition.init = function () {
    init.call(this);
    this.appendDummyInput()
      .appendField(t('asyncProcedure'))
      .appendField(new FieldCheckbox('FALSE'), 'ASYNC');
  };
  const generate = pythonGenerator.forBlock[type];
  pythonGenerator.forBlock[type] = (block, generator) => {
    const asynchronous = block.getFieldValue('ASYNC') === 'TRUE';
    const result = functionContext(generator, asynchronous, () => generate(block, generator));
    if (asynchronous) {
      const name = generator.getProcedureName(block.getFieldValue('NAME'));
      const key = '%' + name;
      generator.definitions_[key] = generator.definitions_[key].replace(/^def /m, 'async def ');
    }
    return result;
  };
}

// Calling a no-return async function still produces a coroutine.
Blocks.procedures_call_expression = {
  ...Blocks.procedures_callreturn,
  defType_: 'procedures_defnoreturn',
};
pythonGenerator.forBlock.procedures_call_expression = pythonGenerator.forBlock.procedures_callreturn;

// Calls never insert await. Offer both call shapes for async no-return definitions.
export function procedureFlyout(workspace) {
  return Procedures.flyoutCategory(workspace, false).flatMap(entry => {
    if (entry.type !== 'procedures_callnoreturn') return [entry];
    const definition = Procedures.getDefinition(entry.extraState.name, workspace);
    return definition?.getFieldValue('ASYNC') === 'TRUE'
      ? [entry, { ...entry, type: 'procedures_call_expression' }]
      : [entry];
  });
}
