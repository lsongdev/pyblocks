import { pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';
import { eventHandler } from '../../python/events.js';

export function buttonEventBlock(type, colour) {
  return {
    type,
    message0: blockMessage('whenButtonPressed'),
    args0: [{ type: 'field_dropdown', name: 'BUTTON', options: [['A', 'a'], ['B', 'b']] }],
    message1: blockMessage('buttonEventBody'),
    args1: [{ type: 'input_statement', name: 'DO' }],
    tooltip: blockMessage('buttonEventHint'),
    colour,
    hat: 'cap',
  };
}

const dispatcher = `_button_events = {}

def _button_press_edge(read, debounce_ms):
    stable = sample = read()
    changed_at = _button_time.ticks_ms()

    def poll():
        nonlocal stable, sample, changed_at
        now = _button_time.ticks_ms()
        current = read()
        if current != sample:
            sample = current
            changed_at = now
        if sample != stable and _button_time.ticks_diff(now, changed_at) >= debounce_ms:
            stable = sample
            return stable
        return False

    return poll

def _button_dispatch():
    sources = [
        (_button_press_edge(read, debounce_ms), handlers)
        for read, debounce_ms, handlers in _button_events.values()
    ]
    while True:
        for pressed, handlers in sources:
            if pressed():
                for handler in handlers:
                    handler()
        _button_time.sleep_ms(10)`;

pythonGenerator.addReservedWords('_button_time,_button_events,_button_press_edge,_button_dispatch');

export function buttonEventCode(block, generator, source, read, debounceMs) {
  generator.definitions_.import_button_time = 'import time as _button_time';
  generator.definitions_.button_dispatcher = dispatcher;

  const { name, code } = eventHandler(block, generator, `_on_${source}_pressed`);
  return code +
    `_button_events.setdefault('${source}', (lambda: ${read}, ${debounceMs}, []))[2].append(${name})\n`;
}

const finish = pythonGenerator.finish;
pythonGenerator.finish = function (code) {
  // Start listening after all top-level setup and handler registrations.
  if (this.definitions_.button_dispatcher) code += '\n_button_dispatch()\n';
  return finish.call(this, code);
};
