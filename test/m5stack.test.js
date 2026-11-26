import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as Blockly from 'blockly/core';
import { pythonGenerator } from 'blockly/python';
import { applyLanguage } from '../src/i18n/index.js';
import { createToolbox } from '../src/editor/toolbox.js';
import { resetEsp32 } from '../src/firmware/esp32.js';
import { matchFirmware } from '../src/firmware/catalog.js';
import { uiflowBootSetup } from '../src/firmware/uiflow.js';
import '../src/blocks/index.js';
const images = JSON.parse(readFileSync(new URL('../src/firmware/images.json', import.meta.url)));
const b = (type, fields = {}, inputs = {}) => ({ type, fields, inputs: Object.fromEntries(Object.entries(inputs).map(([name, block]) => [name, { block }])) });
const num = NUM => b('math_number', { NUM });
const text = TEXT => b('text', { TEXT });
const print = TEXT => b('text_print', {}, { TEXT });
function chain(...blocks) { blocks.slice(0, -1).forEach((block, i) => { block.next = { block: blocks[i + 1] }; }); return blocks[0]; }
function generate(state) {
  const workspace = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(state, workspace);
    const code = pythonGenerator.workspaceToCode(workspace);
    assert.equal(pythonGenerator.workspaceToCode(workspace), code);
    return code;
  } finally { workspace.dispose(); }
}
const program = (...blocks) => ({ blocks: { languageVersion: 0, blocks } });
function python(code) {
  const result = spawnSync('python3', ['-c', code], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout;
}
applyLanguage('en');

test('firmware catalog selects exact M5 model/capacity and generic ESP32 offsets', () => {
  for (const [family,model,size,key,address] of [
    ['esp32','auto','8MB','esp32',0x1000], ['m5stack','basic','4MB','m5basic4',0],
    ['m5stack','basic','16MB','m5basic16',0], ['m5stack','stickc','4MB','m5stickc',0],
  ]) {
    const result = matchFirmware({family,model},{transport:'serial',chip:'ESP32',flashSize:size},images);
    assert.ok(result.supported);
    assert.equal(result.target.image,images[key]);
    assert.equal(result.target.address,address);
    assert.equal(result.target.flashSize,size);
    assert.match(result.target.image.sha256,/^[a-f0-9]{64}$/);
  }
});

test('M5Stack toolbox API calls compile in both languages and examples compile', () => {
  for (const language of ['en', 'zh-CN']) {
    applyLanguage(language);
    const group = createToolbox().contents.find(item => item.name === 'M5Stack');
    const entries = group.contents.flatMap(item => item.contents).filter(item => item.kind === 'block');
    assert.equal(entries.length, 16);
    for (const entry of entries) {
      const code = generate(program(entry));
      python(`compile(${JSON.stringify(code)}, '<m5>', 'exec')`);
      assert.match(code, /import M5 as _m5/);
    }
    for (const file of ['m5-basic-hello', 'm5-stickc-hello']) {
      const project = JSON.parse(readFileSync(new URL(`../examples/${file}.blockly.json`, import.meta.url)));
      python(`compile(${JSON.stringify(generate(project.workspace))}, '<example>', 'exec')`);
    }
  }
  applyLanguage('en');
});

test('M5Stack calls native APIs in order and preserves IMU units and boolean readings', () => {
  const code = generate(program(chain(
    b('m5_begin'), b('m5_rotation', { ROTATION: '1' }),
    b('m5_fill', {}, { COLOR: num(0) }),
    b('m5_text_color', {}, { FOREGROUND: num(0xffffff), BACKGROUND: num(0) }),
    b('m5_text_size', {}, { SIZE: num(2) }),
    b('m5_text', {}, { TEXT: text('Hello!'), X: num(8), Y: num(12) }),
    b('m5_brightness', {}, { VALUE: num(128) }), b('m5_update'),
    print(b('m5_button', { BUTTON: 'BtnB', METHOD: 'wasPressed' })),
    print(b('m5_stick_accel', { AXIS: 'Z' })), print(b('m5_stick_gyro', { AXIS: 'Y' })),
    print(b('m5_dimension', { DIMENSION: 'width' })), print(b('m5_stick_battery')),
  )));
  assert.equal(code.match(/import M5 as _m5/g)?.length, 1);
  python(`import sys, types
calls = []
updated = False
def record(name):
    def call(*args): calls.append((name, args))
    return call
def update():
    global updated
    updated = True
    calls.append(('update', ()))
def wasPressed():
    assert updated
    return True
lcd = types.SimpleNamespace(**{name: record(name) for name in ['setRotation', 'fillScreen', 'setTextColor', 'setTextSize', 'drawString', 'setBrightness']})
lcd.width = lambda: 160
sys.modules['M5'] = types.SimpleNamespace(begin=record('begin'), update=update, Lcd=lcd,
    BtnB=types.SimpleNamespace(wasPressed=wasPressed), Imu=types.SimpleNamespace(getAccel=lambda: (0, 0, 1.0), getGyro=lambda: (2.0, -3.0, 4.0)), Power=types.SimpleNamespace(getBatteryLevel=lambda: 75))
${code}
assert calls == [('begin', ()), ('setRotation', (1,)), ('fillScreen', (0,)), ('setTextColor', (16777215, 0)), ('setTextSize', (2,)), ('drawString', ('Hello!', 8, 12)), ('setBrightness', (128,)), ('update', ())], calls`);
  assert.equal(python(`import sys, types
sys.modules['M5'] = types.SimpleNamespace(Imu=types.SimpleNamespace(getAccel=lambda: (0, 0, 1.0)))
${generate(program(print(b('m5_stick_accel', { AXIS: 'Z' }))))}`).trim(), '1.0');
});

test('UIFlow startup configuration commits only the native run-main NVS setting', () => {
  python(`import sys, types
calls = []
class NVS:
    def __init__(self, namespace): calls.append(namespace)
    def set_u8(self, key, value): calls.append((key, value))
    def commit(self): calls.append('commit')
sys.modules['esp32'] = types.SimpleNamespace(NVS=NVS)
${uiflowBootSetup}
assert calls == ['uiflow', ('boot_option', 0), 'commit']`);
});

test('ESP32 post-flash reset releases GPIO0 and pulses EN instead of only deasserting reset', async () => {
  const signals = [];
  await resetEsp32({
    async setDTR(value) { signals.push(['DTR', value]); },
    async setRTS(value) { signals.push(['RTS', value]); },
  });
  assert.deepEqual(signals, [['DTR', false], ['RTS', true], ['RTS', false]]);
});
