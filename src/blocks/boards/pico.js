import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';

// Original Pico's exposed GP labels and physical header positions.
// https://datasheets.raspberrypi.com/pico/Pico-R3-A4-Pinout.pdf
const pins = [...Array.from({ length: 23 }, (_, i) => i), 26, 27, 28];
const headers = [1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 17, 19, 20, 21, 22, 24, 25, 26, 27, 29, 31, 32, 34];
const colour = 145;
common.defineBlocksWithJsonArray([
  {
    type: 'pico_led_power', message0: blockMessage('picoLedPower'),
    args0: [{ type: 'field_dropdown', name: 'POWER', options: [
      [blockMessage('powerOn'), 'on'], [blockMessage('powerOff'), 'off'],
    ] }],
    previousStatement: null, nextStatement: null, colour,
    tooltip: blockMessage('picoLedHint'),
  },
  {
    type: 'pico_pin_number', message0: blockMessage('picoPinNumber'),
    args0: [{ type: 'field_dropdown', name: 'PIN', options: pins.map((pin, index) => [`GP${pin} · #${headers[index]}`, String(pin)]) }],
    output: 'Number', colour, tooltip: blockMessage('picoPinHint'),
  },
  {
    type: 'pico_temperature', message0: blockMessage('picoTemperature'),
    output: 'Number', colour, tooltip: blockMessage('picoTemperatureHint'),
  },
]);

pythonGenerator.addReservedWords('_pico_pin,_pico_adc');
pythonGenerator.forBlock.pico_led_power = (block, generator) => {
  generator.definitions_.import_pico_pin = 'from machine import Pin as _pico_pin';
  return `_pico_pin('LED', _pico_pin.OUT).${block.getFieldValue('POWER')}()\n`;
};
pythonGenerator.forBlock.pico_pin_number = block => [block.getFieldValue('PIN'), Order.ATOMIC];
pythonGenerator.forBlock.pico_temperature = (_block, generator) => {
  generator.definitions_.import_pico_adc = 'from machine import ADC as _pico_adc';
  // RP2040 temperature sensor calibration: 0.706 V at 27°C, -1.721 mV/°C.
  // Inline composition; no runtime helper or fabricated native temperature API.
  return ['27 - (_pico_adc(4).read_u16() * (3.3 / 65535) - 0.706) / 0.001721', Order.ADDITIVE];
};
