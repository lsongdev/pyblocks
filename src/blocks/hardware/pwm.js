import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage, t } from '../../i18n/index.js';
import { PythonBlockError } from '../../python/errors.js';

const input = (name, check = 'Number') => ({ type: 'input_value', name, check });
const pin = input('PIN', ['Number', 'String']);
const pwm = input('PWM', 'PWM');
const pixels = input('PIXELS', 'NeoPixel');
const rgb = [input('RED'), input('GREEN'), input('BLUE')];
const statement = { previousStatement: null, nextStatement: null };

common.defineBlocksWithJsonArray([
  { type: 'servo_angle', message0: blockMessage('servoAngle'), args0: [pin, input('ANGLE')], message1: blockMessage('servoRange'), args1: [input('MIN'), input('MAX')], tooltip: blockMessage('servoHint'), ...statement, colour: 155 },
  { type: 'servo_pulse', message0: blockMessage('servoPulse'), args0: [pin, input('PULSE')], tooltip: blockMessage('servoPulseHint'), inputsInline: true, ...statement, colour: 155 },
  { type: 'servo_stop', message0: blockMessage('servoStop'), args0: [pin], tooltip: blockMessage('servoStopHint'), ...statement, colour: 155 },
  { type: 'buzzer_tone', message0: blockMessage('buzzerTone'), args0: [pin, input('FREQ'), input('DURATION')], tooltip: blockMessage('buzzerHint'), inputsInline: true, ...statement, colour: 155 },
  { type: 'buzzer_start', message0: blockMessage('buzzerStart'), args0: [pin, input('FREQ')], tooltip: blockMessage('buzzerStartHint'), inputsInline: true, ...statement, colour: 155 },
  { type: 'buzzer_stop', message0: blockMessage('buzzerStop'), args0: [pin], ...statement, colour: 155 },
  { type: 'pwm_create', message0: blockMessage('pwmCreate'), tooltip: blockMessage('pwmDutyHint'), args0: [pin, input('FREQ'), input('DUTY')], output: 'PWM', colour: 155 },
  { type: 'pwm_frequency', message0: blockMessage('pwmFrequency'), args0: [pwm, input('FREQ')], ...statement, colour: 155 },
  { type: 'pwm_duty', message0: blockMessage('pwmDuty'), tooltip: blockMessage('pwmDutyHint'), args0: [pwm, input('DUTY')], ...statement, colour: 155 },
  { type: 'pwm_stop', message0: blockMessage('pwmStop'), args0: [pwm], ...statement, colour: 155 },
  { type: 'neopixel_create', message0: blockMessage('neoCreate'), args0: [pin, input('COUNT')], output: 'NeoPixel', colour: 290 },
  { type: 'neopixel_set', message0: blockMessage('neoSet'), args0: [pixels, input('INDEX'), ...rgb], ...statement, colour: 290 },
  { type: 'neopixel_fill', message0: blockMessage('neoFill'), args0: [pixels, ...rgb], ...statement, colour: 290 },
  { type: 'neopixel_write', message0: blockMessage('neoWrite'), args0: [pixels], ...statement, colour: 290 },
]);

pythonGenerator.addReservedWords('_output_pin,_output_pwm,_output_neopixel,_buzzer_channels,_buzzer_start,_buzzer_stop,_buzzer_tone,_buzzer_sleep_ms,_servo_channels,_servo_write,_servo_angle,_servo_stop');

const value = (block, generator, name, fallback = '0') =>
  generator.valueToCode(block, name, Order.NONE) || fallback;
function receiver(block, generator, name) {
  const code = generator.valueToCode(block, name, Order.MEMBER);
  if (!code) throw new PythonBlockError(t('requiredExpression', name === 'PWM' ? 'PWM' : 'NeoPixel'));
  return code;
}
const color = (block, generator) =>
  '(' + ['RED', 'GREEN', 'BLUE'].map(name => value(block, generator, name)).join(', ') + ')';

function prepareBuzzer(generator) {
  generator.definitions_.import_output_pin = 'from machine import Pin as _output_pin';
  generator.definitions_.import_output_pwm = 'from machine import PWM as _output_pwm';
  generator.definitions_.import_buzzer_sleep = 'from time import sleep_ms as _buzzer_sleep_ms';
  generator.definitions_.buzzer_helpers = `_buzzer_channels = {}

def _buzzer_stop(pin):
    channel = _buzzer_channels.pop(pin, None)
    if channel is not None:
        try:
            channel.duty_u16(0)
        finally:
            channel.deinit()

def _buzzer_start(pin, frequency):
    _buzzer_stop(pin)
    _buzzer_channels[pin] = _output_pwm(_output_pin(pin), freq=int(frequency), duty_u16=32768)

def _buzzer_tone(pin, frequency, duration):
    _buzzer_start(pin, frequency)
    try:
        _buzzer_sleep_ms(int(duration))
    finally:
        _buzzer_stop(pin)`;
}

function prepareServo(generator) {
  generator.definitions_.import_output_pin = 'from machine import Pin as _output_pin';
  generator.definitions_.import_output_pwm = 'from machine import PWM as _output_pwm';
  generator.definitions_.servo_helpers = `_servo_channels = {}

def _servo_write(pin, pulse_us):
    pulse_ns = int(pulse_us * 1000)
    if not 0 < pulse_ns < 20000000:
        raise ValueError('Servo pulse must be between 0 and 20000 us')
    if pin not in _servo_channels:
        _servo_channels[pin] = _output_pwm(_output_pin(pin), freq=50, duty_u16=0)
    _servo_channels[pin].duty_ns(pulse_ns)

def _servo_angle(pin, angle, minimum, maximum):
    if not 0 < minimum < maximum < 20000:
        raise ValueError('Invalid servo pulse range')
    angle = max(0, min(180, angle))
    _servo_write(pin, minimum + (maximum - minimum) * angle / 180)

def _servo_stop(pin):
    channel = _servo_channels.pop(pin, None)
    if channel is not None:
        try:
            channel.duty_u16(0)
        finally:
            channel.deinit()`;
}

Object.assign(pythonGenerator.forBlock, {
  servo_angle(block, generator) {
    prepareServo(generator);
    const args = [['PIN', '18'], ['ANGLE', '90'], ['MIN', '1000'], ['MAX', '2000']]
      .map(([name, fallback]) => value(block, generator, name, fallback));
    return `_servo_angle(${args.join(', ')})\n`;
  },
  servo_pulse(block, generator) {
    prepareServo(generator);
    return `_servo_write(${value(block, generator, 'PIN', '18')}, ${value(block, generator, 'PULSE', '1500')})\n`;
  },
  servo_stop(block, generator) {
    prepareServo(generator);
    return `_servo_stop(${value(block, generator, 'PIN', '18')})\n`;
  },
  buzzer_start(block, generator) {
    prepareBuzzer(generator);
    return `_buzzer_start(${value(block, generator, 'PIN', '16')}, ${value(block, generator, 'FREQ', '440')})\n`;
  },
  buzzer_stop(block, generator) {
    prepareBuzzer(generator);
    return `_buzzer_stop(${value(block, generator, 'PIN', '16')})\n`;
  },
  buzzer_tone(block, generator) {
    prepareBuzzer(generator);
    return `_buzzer_tone(${value(block, generator, 'PIN', '16')}, ${value(block, generator, 'FREQ', '440')}, ${value(block, generator, 'DURATION', '200')})\n`;
  },
  pwm_create(block, generator) {
    generator.definitions_.import_output_pin = 'from machine import Pin as _output_pin';
    generator.definitions_.import_output_pwm = 'from machine import PWM as _output_pwm';
    const gpio = value(block, generator, 'PIN');
    const freq = value(block, generator, 'FREQ', '440');
    const duty = value(block, generator, 'DUTY');
    return [`_output_pwm(_output_pin(${gpio}), freq=${freq}, duty_u16=${duty})`, Order.FUNCTION_CALL];
  },
  pwm_frequency(block, generator) {
    const channel = receiver(block, generator, 'PWM');
    return `${channel}.freq(${value(block, generator, 'FREQ', '440')})\n`;
  },
  pwm_duty(block, generator) {
    const channel = receiver(block, generator, 'PWM');
    return `${channel}.duty_u16(${value(block, generator, 'DUTY')})\n`;
  },
  pwm_stop(block, generator) {
    const channel = receiver(block, generator, 'PWM');
    return `${channel}.deinit()\n`;
  },
  neopixel_create(block, generator) {
    generator.definitions_.import_output_pin = 'from machine import Pin as _output_pin';
    generator.definitions_.import_output_neopixel = 'from neopixel import NeoPixel as _output_neopixel';
    const gpio = value(block, generator, 'PIN');
    const count = value(block, generator, 'COUNT', '1');
    return [`_output_neopixel(_output_pin(${gpio}), ${count})`, Order.FUNCTION_CALL];
  },
  neopixel_set(block, generator) {
    const strip = receiver(block, generator, 'PIXELS');
    return `${strip}[${value(block, generator, 'INDEX')}] = ${color(block, generator)}\n`;
  },
  neopixel_fill(block, generator) {
    const strip = receiver(block, generator, 'PIXELS');
    return `${strip}.fill(${color(block, generator)})\n`;
  },
  neopixel_write(block, generator) {
    const strip = receiver(block, generator, 'PIXELS');
    return `${strip}.write()\n`;
  },
});
