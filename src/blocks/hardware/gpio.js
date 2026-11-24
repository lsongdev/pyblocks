import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';
import { eventHandler } from '../../python/events.js';

const colour = 155;
const pin = { type: 'input_value', name: 'PIN', check: ['Number', 'String'] };
const level = {
  type: 'field_dropdown',
  name: 'LEVEL',
  options: [[blockMessage('pinLow'), '0'], [blockMessage('pinHigh'), '1']],
};

const pullField = (keep = false) => ({
  type: 'field_dropdown', name: 'PULL', options: [
    ...(keep ? [[blockMessage('pullKeep'), 'KEEP']] : []),
    [blockMessage('pullDown'), 'DOWN'], [blockMessage('pullUp'), 'UP'], [blockMessage('pullNone'), 'NONE'],
  ],
});
const statement = { previousStatement: null, nextStatement: null, colour };

const irqTriggers = {
  rising: '_gpio_pin.IRQ_RISING',
  falling: '_gpio_pin.IRQ_FALLING',
  both: '_gpio_pin.IRQ_RISING | _gpio_pin.IRQ_FALLING',
};

common.defineBlocksWithJsonArray([
  {
    type: 'gpio_set_pull', message0: blockMessage('gpioSetPull'), args0: [pin, pullField()],
    tooltip: blockMessage('gpioSetPullHint'), inputsInline: true, ...statement,
  },
  {
    type: 'gpio_read_digital',
    message0: blockMessage('pinRead'),
    args0: [pin],
    message1: blockMessage('gpioInputPull'),
    args1: [pullField(true)],
    tooltip: blockMessage('gpioReadHint'),
    inputsInline: true,
    output: 'Number',
    colour,
  },
  {
    type: 'gpio_write_digital',
    message0: blockMessage('pinWrite'),
    args0: [pin, level],
    tooltip: blockMessage('gpioWriteHint'),
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour,
  },
  {
    type: 'gpio_on_edge',
    message0: blockMessage('gpioOnEdge'),
    args0: [
      pin,
      {
        type: 'field_dropdown',
        name: 'EDGE',
        options: [
          [blockMessage('gpioRising'), 'rising'],
          [blockMessage('gpioFalling'), 'falling'],
          [blockMessage('gpioBoth'), 'both'],
        ],
      },
    ],
    message1: blockMessage('gpioInputPull'),
    args1: [pullField(true)],
    message2: blockMessage('buttonEventBody'),
    args2: [{ type: 'input_statement', name: 'DO' }],
    tooltip: blockMessage('gpioOnEdgeHint'),
    colour,
    hat: 'cap',
  },
]);

pythonGenerator.addReservedWords('_gpio_pin,_gpio_irq_inputs,_gpio_callback_pin');

function pinId(block, generator) {
  generator.definitions_.import_gpio_pin = 'from machine import Pin as _gpio_pin';
  return generator.valueToCode(block, 'PIN', Order.NONE) || '0';
}

function pullOption(block) {
  const pull = block.getFieldValue('PULL');
  if (pull === 'KEEP') return '';
  return `, pull=${{DOWN: '_gpio_pin.PULL_DOWN', UP: '_gpio_pin.PULL_UP', NONE: 'None'}[pull]}`;
}

Object.assign(pythonGenerator.forBlock, {
  gpio_set_pull: (block, generator) => `_gpio_pin(${pinId(block, generator)}, _gpio_pin.IN${pullOption(block)})\n`,
  gpio_on_edge: (block, generator) => {
    const pin = pinId(block, generator);
    const trigger = irqTriggers[block.getFieldValue('EDGE')];
    const { name, code } = eventHandler(block, generator, '_on_gpio_edge', '_gpio_callback_pin');
    generator.definitions_.gpio_irq_inputs = '_gpio_irq_inputs = []';
    return code +
      `_gpio_irq_inputs.append(_gpio_pin(${pin}, _gpio_pin.IN${pullOption(block)}))\n` +
      `_gpio_irq_inputs[-1].irq(handler=${name}, trigger=${trigger})\n`;
  },
  gpio_read_digital: (block, generator) => [
    `_gpio_pin(${pinId(block, generator)}, _gpio_pin.IN${pullOption(block)}).value()`, Order.FUNCTION_CALL,
  ],
  gpio_write_digital: (block, generator) =>
    `_gpio_pin(${pinId(block, generator)}, _gpio_pin.OUT, value=${block.getFieldValue('LEVEL')})\n`,
});
