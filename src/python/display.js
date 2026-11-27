import { pythonGenerator } from 'blockly/python';

pythonGenerator.addReservedWords(
  '_display,_display_create,_DisplayOLED,_DisplayST7735,_display_pin,_display_i2c,_display_spi,_display_framebuf,_display_sleep_ms',
);

const oledDriver = `class _DisplayOLED(_display_framebuf.FrameBuffer):
    def __init__(self, width, height, i2c_id, scl, sda, address):
        self.width = width
        self.height = height
        if height % 8:
            raise ValueError('OLED height must be a multiple of 8')
        self.buffer = bytearray(width * height // 8)
        self.i2c = _display_i2c(i2c_id, scl=_display_pin(scl), sda=_display_pin(sda), freq=400000)
        self.address = address
        super().__init__(self.buffer, width, height, _display_framebuf.MONO_VLSB)
        com_pins = 0x12 if height >= 48 else 0x02
        self.i2c.writeto(self.address, bytes((0x00, 0xAE, 0x20, 0x00, 0x40, 0xA1, 0xA8, height - 1, 0xC8, 0xD3, 0x00, 0xDA, com_pins, 0xD5, 0x80, 0xD9, 0xF1, 0xDB, 0x30, 0x81, 0x7F, 0xA4, 0xA6, 0x8D, 0x14, 0xAF)))

    def show(self):
        self.i2c.writeto(self.address, bytes((0x00, 0x21, 0, self.width - 1, 0x22, 0, self.height // 8 - 1)))
        self.i2c.writevto(self.address, (bytes((0x40,)), self.buffer))`;

const st7735Driver = `class _DisplayST7735(_display_framebuf.FrameBuffer):
    def __init__(self, width, height, spi_id, baud, sck, mosi, cs, dc, res, rotation):
        self.width = width
        self.height = height
        self.buffer = bytearray(width * height * 2)
        self.spi = _display_spi(spi_id, baudrate=baud, polarity=0, phase=0, sck=_display_pin(sck), mosi=_display_pin(mosi))
        self.cs = _display_pin(cs, _display_pin.OUT, value=1)
        self.dc = _display_pin(dc, _display_pin.OUT)
        self.res = _display_pin(res, _display_pin.OUT, value=1)
        super().__init__(self.buffer, self.width, self.height, _display_framebuf.RGB565)
        self._reset()
        self._init((0x08, 0x68, 0xC8, 0xA8)[rotation])

    def _cmd(self, command, data=None):
        self.cs(0)
        self.dc(0)
        self.spi.write(bytes((command,)))
        if data is not None:
            self.dc(1)
            self.spi.write(data)
        self.cs(1)

    def _reset(self):
        self.cs(0)
        self.res(0)
        _display_sleep_ms(20)
        self.res(1)
        _display_sleep_ms(120)
        self.cs(1)

    def _init(self, madctl):
        self._cmd(0x01)
        _display_sleep_ms(150)
        self._cmd(0x11)
        _display_sleep_ms(120)
        self._cmd(0x36, bytes((madctl,)))
        self._cmd(0x3A, bytes((0x05,)))
        self._cmd(0x20)
        self._cmd(0xB1, bytes((0x01, 0x2C, 0x2D)))
        self._cmd(0xB2, bytes((0x01, 0x2C, 0x2D)))
        self._cmd(0xB3, bytes((0x01, 0x2C, 0x2D, 0x01, 0x2C, 0x2D)))
        self._cmd(0xB4, bytes((0x07,)))
        self._cmd(0xC0, bytes((0xA2, 0x02, 0x84)))
        self._cmd(0xC1, bytes((0xC5,)))
        self._cmd(0xC2, bytes((0x0A, 0x00)))
        self._cmd(0xC3, bytes((0x8A, 0x2A)))
        self._cmd(0xC4, bytes((0x8A, 0xEE)))
        self._cmd(0xC5, bytes((0x0E,)))
        self._cmd(0xE0, bytes((0x02, 0x1C, 0x07, 0x12, 0x37, 0x32, 0x29, 0x2D, 0x29, 0x25, 0x2B, 0x39, 0x00, 0x01, 0x03, 0x10)))
        self._cmd(0xE1, bytes((0x03, 0x1D, 0x07, 0x06, 0x2E, 0x2C, 0x29, 0x2D, 0x2E, 0x2E, 0x37, 0x3F, 0x00, 0x00, 0x02, 0x10)))
        self._cmd(0x13)
        self._cmd(0x29)
        _display_sleep_ms(50)

    def show(self):
        self._cmd(0x2A, bytes((0, 0, (self.width - 1) >> 8, (self.width - 1) & 255)))
        self._cmd(0x2B, bytes((0, 0, (self.height - 1) >> 8, (self.height - 1) & 255)))
        self._cmd(0x2C, self.buffer)`;

const displayFactory = `def _display_create(config):
    if config['type'] == 'oled':
        return _DisplayOLED(config['width'], config['height'], config['i2c'], config['scl'], config['sda'], config['address'])
    if config['type'] == 'st7735':
        return _DisplayST7735(config['width'], config['height'], config['spi'], config['baud'], config['sck'], config['mosi'], config['cs'], config['dc'], config['res'], config['rotation'])
    raise ValueError('Unsupported display configuration')`;

export function prepareOledDisplay(generator) {
  generator.definitions_.import_display_pin = 'from machine import Pin as _display_pin';
  generator.definitions_.import_display_i2c = 'from machine import I2C as _display_i2c';
  generator.definitions_.import_display_framebuf = 'import framebuf as _display_framebuf';
  generator.definitions_.display_oled_driver = oledDriver;
}

export function prepareSt7735Display(generator) {
  generator.definitions_.import_display_pin = 'from machine import Pin as _display_pin';
  generator.definitions_.import_display_spi = 'from machine import SPI as _display_spi';
  generator.definitions_.import_display_framebuf = 'import framebuf as _display_framebuf';
  generator.definitions_.import_display_sleep = 'from time import sleep_ms as _display_sleep_ms';
  generator.definitions_.display_st7735_driver = st7735Driver;
}

export function prepareDisplayFactory(generator) {
  generator.definitions_.display_factory = displayFactory;
}

function configCode(type, values) {
  const fields = Object.entries(values).map(([key, value]) => `'${key}': ${value}`).join(', ');
  return `{'type': '${type}', ${fields}}`;
}

export function oledConfig(generator, values) {
  prepareOledDisplay(generator);
  return configCode('oled', values);
}

export function st7735Config(generator, values) {
  prepareSt7735Display(generator);
  return configCode('st7735', values);
}
