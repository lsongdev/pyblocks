import { common } from 'blockly/core';
import { Order, pythonGenerator } from 'blockly/python';
import { blockMessage } from '../../i18n/index.js';

// Native UIFlow2 2.5.3 M5 module. Basic and original StickC use separate firmware.
// https://github.com/m5stack/uiflow-micropython/tree/2.5.3/m5stack/cmodules/m5unified
const colour = 5;
const number = name => ({ type: 'input_value', name, check: 'Number' });
const dropdown = (name, values) => ({ type: 'field_dropdown', name, options: values.map(v => [String(v), String(v)]) });
const definitions = [];
function define(type, message, args = [], output, hint = 'm5ApiHint') {
  definitions.push({ type: `m5_${type}`, message0: blockMessage(message), args0: args,
    ...(output ? { output } : { previousStatement: null, nextStatement: null }), colour, tooltip: blockMessage(hint) });
}
define('begin', 'm5Begin', [], undefined, 'm5BeginHint');
define('update', 'm5Update', [], undefined, 'm5UpdateHint');
define('fill', 'm5Fill', [number('COLOR')]);
define('text', 'm5Text', [{ type: 'input_value', name: 'TEXT', check: 'String' }, number('X'), number('Y')]);
define('text_color', 'm5TextColor', [number('FOREGROUND'), number('BACKGROUND')]);
define('text_size', 'm5TextSize', [number('SIZE')]);
define('rotation', 'm5Rotation', [dropdown('ROTATION', [0, 1, 2, 3])]);
define('brightness', 'm5Brightness', [number('VALUE')], undefined, 'm5BrightnessHint');
define('dimension', 'm5Dimension', [dropdown('DIMENSION', ['width', 'height'])], 'Number');
define('pixel', 'm5Pixel', [number('X'), number('Y'), number('COLOR')]);
define('line', 'm5Line', [number('X1'), number('Y1'), number('X2'), number('Y2'), number('COLOR')]);
define('rectangle', 'm5Rectangle', [number('X'), number('Y'), number('WIDTH'), number('HEIGHT'), number('COLOR')]);
define('button', 'm5Button', [
  { type: 'field_dropdown', name: 'BUTTON', options: [['A', 'BtnA'], ['B', 'BtnB'], [blockMessage('m5ButtonC'), 'BtnC']] },
  { type: 'field_dropdown', name: 'METHOD', options: [['isPressed', 'isPressed'], ['wasPressed', 'wasPressed'], ['wasReleased', 'wasReleased'], ['wasClicked', 'wasClicked']] },
], 'Boolean', 'm5ButtonHint');
define('stick_accel', 'm5StickAccel', [dropdown('AXIS', ['X', 'Y', 'Z'])], 'Number', 'm5ImuHint');
define('stick_gyro', 'm5StickGyro', [dropdown('AXIS', ['X', 'Y', 'Z'])], 'Number', 'm5ImuHint');
define('stick_battery', 'm5StickBattery', [], 'Number', 'm5BatteryHint');
common.defineBlocksWithJsonArray(definitions);
pythonGenerator.addReservedWords('_m5');
function m5(g) { g.definitions_.import_m5 = 'import M5 as _m5'; return '_m5'; }
const value = (b, g, key, fallback = '0') => g.valueToCode(b, key, Order.NONE) || fallback;
function call(type, method, inputs = [], output = false) {
  pythonGenerator.forBlock[`m5_${type}`] = (b, g) => {
    const code = `${m5(g)}.${method}(${inputs.map(key => value(b, g, key, key === 'TEXT' ? "''" : '0')).join(', ')})`;
    return output ? [code, Order.FUNCTION_CALL] : `${code}\n`;
  };
}
call('begin', 'begin'); call('update', 'update');
call('fill', 'Lcd.fillScreen', ['COLOR']);
call('text', 'Lcd.drawString', ['TEXT', 'X', 'Y']);
call('text_color', 'Lcd.setTextColor', ['FOREGROUND', 'BACKGROUND']);
call('text_size', 'Lcd.setTextSize', ['SIZE']);
call('brightness', 'Lcd.setBrightness', ['VALUE']);
call('pixel', 'Lcd.drawPixel', ['X', 'Y', 'COLOR']);
call('line', 'Lcd.drawLine', ['X1', 'Y1', 'X2', 'Y2', 'COLOR']);
call('rectangle', 'Lcd.fillRect', ['X', 'Y', 'WIDTH', 'HEIGHT', 'COLOR']);
pythonGenerator.forBlock.m5_rotation = (b, g) => `${m5(g)}.Lcd.setRotation(${b.getFieldValue('ROTATION')})\n`;
pythonGenerator.forBlock.m5_dimension = (b, g) => [`${m5(g)}.Lcd.${b.getFieldValue('DIMENSION')}()`, Order.FUNCTION_CALL];
pythonGenerator.forBlock.m5_button = (b, g) => [`${m5(g)}.${b.getFieldValue('BUTTON')}.${b.getFieldValue('METHOD')}()`, Order.FUNCTION_CALL];
for (const [type, method] of [['stick_accel', 'getAccel'], ['stick_gyro', 'getGyro']]) {
  pythonGenerator.forBlock[`m5_${type}`] = (b, g) => [`${m5(g)}.Imu.${method}()[${['X', 'Y', 'Z'].indexOf(b.getFieldValue('AXIS'))}]`, Order.MEMBER];
}
call('stick_battery', 'Power.getBatteryLevel', [], true);
