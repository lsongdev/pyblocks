import { CollapsibleToolboxCategory, registry, Toolbox, ToolboxCategory } from 'blockly/core';
import {
  faCode, faCalculator, faCodeBranch, faCube, faEquals, faFont, faListUl, faMicrochip, faRotateRight, faDisplay, faWifi, faPlug, faHandPointer, faClock, faFolderOpen, faWaveSquare, faLightbulb, faVolumeHigh, faMicrophone, faRightLeft,
} from '@fortawesome/free-solid-svg-icons';
import { t } from '../i18n/index.js';

function addIcon(icon, definition, colour) {
  const [width, height, , , pathData] = definition.icon;
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  const path = document.createElementNS(namespace, 'path');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');
  path.setAttribute('d', pathData);
  svg.append(path);
  icon.append(svg);
  icon.style.color = colour;
  return icon;
}

class IconCategory extends ToolboxCategory {
  createIconDom_() {
    return addIcon(super.createIconDom_(), this.toolboxItemDef_.icon, this.colour_);
  }
}

class IconCategoryGroup extends CollapsibleToolboxCategory {
  createIconDom_() {
    const icon = super.createIconDom_();
    icon.style.removeProperty('display');
    return addIcon(icon, this.toolboxItemDef_.icon, this.colour_);
  }
}

export class EditorToolbox extends Toolbox {
  onTreeBlur(nextTree) {
    const selected = this.getSelectedItem()?.getId();
    // The HTML controls and native file picker take focus outside Blockly.
    if (selected === 'files' || selected === 'libraries') return;
    super.onTreeBlur(nextTree);
  }
}

registry.register(registry.Type.TOOLBOX_ITEM, 'iconCategory', IconCategory);
registry.register(registry.Type.TOOLBOX_ITEM, 'iconCategoryGroup', IconCategoryGroup);

function category(name, colour, icon, blocks) {
  return {
    kind: 'iconCategory',
    name,
    icon,
    colour,
    contents: blocks.map((block) =>
      typeof block === 'string' ? { kind: 'block', type: block } : { kind: 'block', ...block },
    ),
  };
}

function numberInput(value) {
  return { shadow: { type: 'math_number', fields: { NUM: value } } };
}

function textInput(value) {
  return { shadow: { type: 'text', fields: { TEXT: value } } };
}

export function createToolbox() {
  return {
    kind: 'categoryToolbox',
    contents: [
      category(t('logic'), '%{BKY_LOGIC_HUE}', faCodeBranch, [
        'controls_if', 'logic_compare', 'logic_operation', 'logic_negate',
        'logic_boolean', 'logic_null', 'logic_ternary', 'python_membership',
        { kind: 'label', text: t('exceptionCategory') },
        'exception_try', 'exception_catch',
        { type: 'exception_raise', inputs: { MESSAGE: textInput('error') } },
        'exception_reraise', 'exception_text',
      ]),
      category(t('loops'), '%{BKY_LOOPS_HUE}', faRotateRight, [
        { type: 'controls_repeat_ext', inputs: { TIMES: numberInput(10) } },
        'controls_whileUntil',
        { type: 'controls_for', inputs: { FROM: numberInput(1), TO: numberInput(10), BY: numberInput(1) } },
        'controls_forEach', 'controls_flow_statements',
      ]),
      category(t('eventsCategory'), '#b57a36', faHandPointer, [
        { type: 'events_when', inputs: { CONDITION: { shadow: { type: 'logic_boolean', fields: { BOOL: 'FALSE' } } } } },
        { type: 'events_when_async', inputs: { CONDITION: { shadow: { type: 'logic_boolean', fields: { BOOL: 'FALSE' } } } } },
      ]),
      category(t('math'), '%{BKY_MATH_HUE}', faCalculator, [
        'math_number',
        { type: 'math_arithmetic', inputs: { A: numberInput(1), B: numberInput(1) } },
        'math_single', 'math_round', 'math_modulo', 'math_random_int',
        { type: 'python_bitwise', inputs: { A: numberInput(1), B: numberInput(1) } }, 'python_bit_not', 'python_aggregate',
      ]),
      category(t('text'), '%{BKY_TEXTS_HUE}', faFont, [
        'text', 'text_join', 'text_length', 'text_isEmpty', 'text_changeCase',
        'text_trim',
        { type: 'text_print', inputs: { TEXT: textInput('Hello') } },
        { type: 'bytes_encode_utf8', inputs: { VALUE: textInput('Hello') } },
        'bytes_decode_utf8',
        { type: 'text_input', inputs: { PROMPT: textInput('> ') } },
      ]),
      category(t('pyDataCategory'), '%{BKY_LISTS_HUE}', faListUl, [
        'lists_create_with', 'lists_length', 'lists_isEmpty',
        { type: 'python_index', inputs: { KEY: numberInput(0) } },
        'python_index_set',
        'python_index_delete',
        'python_slice',
        'python_dict',
        { type: 'python_dict_entry', inputs: { KEY: textInput('key'), VALUE: numberInput(0) } },
        'python_dict_get',
        'python_dict_view',
        'python_dict_update',
        'python_list_append',
        'python_list_extend',
        'python_list_insert',
        'python_collection_remove',
        'python_collection_pop',
        'python_collection_clear',
        'python_list_sort',
        'python_list_reverse',
        'python_set_add',
        'python_set_discard',
        'python_set_operation',
        'python_convert',
        'python_length',
        { type: 'python_range', inputs: { START: numberInput(0), STOP: numberInput(10), STEP: numberInput(1) } },
      ]),
      { kind: 'iconCategory', name: t('variables'), icon: faEquals, colour: '%{BKY_VARIABLES_HUE}', custom: 'VARIABLE' },
      { kind: 'iconCategory', name: t('functions'), icon: faCube, colour: '%{BKY_PROCEDURES_HUE}', custom: 'PYBLOCKS_PROCEDURE' },
      category(t('modules'), '#3575a6', faCode, [
        'python_import', 'python_from_import', 'python_name', 'python_member', 'python_member_set', 'python_member_delete',
        'python_call', 'python_call_statement', 'python_expression_statement', 'python_argument', 'python_keyword_argument',
      ]),
      category(t('pyFileCategory'), '#94722a', faFolderOpen, [
        { type: 'python_file_open', inputs: { PATH: textInput('data.txt') } },
        'python_file_read',
        'python_file_readline',
        'python_file_write',
        'python_file_seek',
        'python_file_tell',
        'python_file_flush',
        'python_file_close',
        'python_with',
      ]),
      category(t('timing'), '#94722a', faClock, [
        { type: 'timing_wait_ms', inputs: { MS: numberInput(100) } },
        'timing_ticks_ms', 'timing_epoch_seconds', 'timing_datetime',
        {
          type: 'timing_elapsed_ms',
          inputs: { START: numberInput(0), END: { shadow: { type: 'timing_ticks_ms' } } },
        },
        { kind: 'label', text: t('ntpTitle') },
        { type: 'ntptime_config', inputs: { HOST: textInput('pool.ntp.org'), TIMEOUT: numberInput(1) } },
        'ntptime_sync', 'ntptime_time',
      ]),
      category(t('asyncCategory'), '#7755aa', faRotateRight, [
        'python_await', 'python_await_value', 'asyncio_run', 'asyncio_create_task',
        { type: 'asyncio_sleep', inputs: { DURATION: numberInput(100) } },
        'asyncio_return', 'asyncio_cancel_task',
      ]),
      category(t('display'), '#3a7ca5', faDisplay, [
        { kind: 'label', text: t('displaySetup') },
        {
          type: 'display_setup', inputs: {
            CONFIG: {
              shadow: {
                type: 'display_oled_config', inputs: {
                  WIDTH: numberInput(128), HEIGHT: numberInput(64),
                  I2C: numberInput(0), SCL: numberInput(22), SDA: numberInput(23), ADDRESS: numberInput(60),
                }
              }
            },
          }
        },
        { kind: 'label', text: t('displayConfigs') },
        {
          type: 'display_oled_config',
          inputs: {
            WIDTH: numberInput(128), HEIGHT: numberInput(64),
            I2C: numberInput(0), SCL: numberInput(22), SDA: numberInput(23), ADDRESS: numberInput(60),
          },
        },
        {
          type: 'display_st7735_config', inputs: {
            WIDTH: numberInput(160), HEIGHT: numberInput(128),
            SPI: numberInput(2), BAUD: numberInput(20000000), SCK: numberInput(18), MOSI: numberInput(23),
            CS: numberInput(5), DC: numberInput(4), RES: numberInput(19),
          }
        },
        { kind: 'label', text: t('displayDrawing') },
        { type: 'display_text', inputs: { TEXT: textInput('Hello!'), X: numberInput(0), Y: numberInput(0), COLOR: numberInput(65535) } },
        { type: 'display_pixel', inputs: { X: numberInput(0), Y: numberInput(0), COLOR: numberInput(65535) } },
        { type: 'display_clear', inputs: { COLOR: numberInput(0) } },
        'display_refresh',
      ]),
      category(t('pins'), '#29806c', faPlug, [
        { type: 'adc_read_pin', inputs: { PIN: numberInput(0) } },
        { type: 'gpio_read_digital', inputs: { PIN: numberInput(0) } },
        { type: 'gpio_write_digital', inputs: { PIN: numberInput(0) } },
        { type: 'gpio_set_pull', inputs: { PIN: numberInput(0) } },
        { type: 'gpio_on_edge', inputs: { PIN: numberInput(0) } },
        { kind: 'label', text: t('touchKeys') },
        { type: 'touchpad_read', inputs: { PIN: numberInput(0) } },
        { type: 'touchpad_is_touched', inputs: { PIN: numberInput(0), THRESHOLD: numberInput(400) } },
      ]),
      category(t('i2c'), '#298477', faCodeBranch, [
        { type: 'i2c_create', inputs: { ID: numberInput(0), SCL: numberInput(22), SDA: numberInput(23), FREQ: numberInput(100000) } },
        'i2c_scan',
        { type: 'i2c_read', inputs: { ADDRESS: numberInput(60), COUNT: numberInput(1) } },
        { type: 'i2c_write', inputs: { ADDRESS: numberInput(60) } },
        { type: 'i2c_read_register', inputs: { ADDRESS: numberInput(60), REGISTER: numberInput(0), COUNT: numberInput(1) } },
        { type: 'i2c_write_register', inputs: { ADDRESS: numberInput(60), REGISTER: numberInput(0) } },
      ]),
      category('PWM', '#29806c', faWaveSquare, [
        { type: 'pwm_create', inputs: { PIN: numberInput(0), FREQ: numberInput(440), DUTY: numberInput(0) } },
        { type: 'pwm_frequency', inputs: { FREQ: numberInput(440) } },
        { type: 'pwm_duty', inputs: { DUTY: numberInput(32768) } },
        'pwm_stop',
        { kind: 'label', text: t('buzzer') },
        { type: 'buzzer_tone', inputs: { PIN: numberInput(16), FREQ: numberInput(440), DURATION: numberInput(200) } },
        { type: 'buzzer_start', inputs: { PIN: numberInput(16), FREQ: numberInput(440) } },
        { type: 'buzzer_stop', inputs: { PIN: numberInput(16) } },
        { kind: 'label', text: t('servo') },
        { type: 'servo_angle', inputs: { PIN: numberInput(18), ANGLE: numberInput(90), MIN: numberInput(1000), MAX: numberInput(2000) } },
        { type: 'servo_pulse', inputs: { PIN: numberInput(18), PULSE: numberInput(1500) } },
        { type: 'servo_stop', inputs: { PIN: numberInput(18) } },
      ]),
      category(t('uart'), '#3575a6', faRightLeft, [
        {
          type: 'uart_create', inputs: {
            ID: numberInput(1), TX: numberInput(25), RX: numberInput(26), BAUD: numberInput(9600), TIMEOUT: numberInput(100),
          }
        },
        'uart_any',
        { type: 'uart_read', inputs: { COUNT: numberInput(1) } },
        'uart_read_line',
        { type: 'uart_write', inputs: { DATA: textInput('Hello') } },
        'uart_close',
      ]),
      category(t('wifiCategory'), '#357d82', faWifi, [
        { kind: 'label', text: t('wifiStation') },
        {
          type: 'wifi_connect',
          inputs: { SSID: textInput('SSID'), PASSWORD: textInput('') },
        },
        'wifi_connected', 'wifi_ipv4', 'wifi_disconnect',
        'wifi_status', 'wifi_status_constant', 'wifi_rssi',
        { type: 'wifi_reconnects', inputs: { COUNT: numberInput(3) } },
        { kind: 'label', text: t('wifiScanTitle') },
        'wifi_scan', 'wifi_scan_field',
        { kind: 'label', text: t('wifiAccessPoint') },
        {
          type: 'wifi_ap_config', inputs: {
            SSID: textInput('MicroPython-AP'), PASSWORD: textInput('change-me-123'), CHANNEL: numberInput(1), CLIENTS: numberInput(4),
          }
        },
        { type: 'wifi_interface_power', fields: { MODE: 'AP' } },
        'wifi_ap_has_clients', 'wifi_ap_stations',
        { kind: 'label', text: t('wifiInterfaceTitle') },
        'wifi_interface_power', 'wifi_interface_active', 'wifi_mac',
        { type: 'wifi_network_address', fields: { MODE: 'AP' } },
        {
          type: 'wifi_set_ipv4', fields: { MODE: 'AP' }, inputs: {
            IP: textInput('192.168.4.1'), SUBNET: textInput('255.255.255.0'),
            GATEWAY: textInput('192.168.4.1'), DNS: textInput('8.8.8.8'),
          }
        },
      ]),
      category(t('httpCategory'), '#357d82', faRightLeft, [
        { type: 'http_request', inputs: { URL: textInput('http://example.com/'), TIMEOUT: numberInput(10) } },
        { type: 'http_header', inputs: { VALUE: textInput('application/json') } },
        'http_with_response', 'http_status_code', 'http_response_text', 'http_response_content', 'http_response_json',
        { type: 'http_response_header', inputs: { NAME: textInput('Content-Type') } },
        'http_close',
      ]),
      category(t('mqttCategory'), '#357d82', faRightLeft, [
        {
          type: 'mqtt_create', inputs: {
            SERVER: textInput('broker.emqx.io'), PORT: numberInput(1883), CLIENT_ID: textInput('blockly-client'),
            USER: textInput(''), PASSWORD: textInput(''), KEEPALIVE: numberInput(60),
          }
        },
        'mqtt_connect', 'mqtt_on_message',
        { type: 'mqtt_subscribe', inputs: { TOPIC: textInput('test') } },
        { type: 'mqtt_publish', inputs: { TOPIC: textInput('blockly/data'), MESSAGE: textInput('Hello') } },
        'mqtt_check_msg', 'mqtt_ping', 'mqtt_disconnect',
      ]),
      category(t('neopixelCategory'), '#864ba0', faLightbulb, [
        { type: 'neopixel_create', inputs: { PIN: numberInput(0), COUNT: numberInput(1) } },
        { type: 'neopixel_set', inputs: { INDEX: numberInput(0), RED: numberInput(32), GREEN: numberInput(0), BLUE: numberInput(0) } },
        { type: 'neopixel_fill', inputs: { RED: numberInput(0), GREEN: numberInput(0), BLUE: numberInput(0) } },
        'neopixel_write',
      ]),
      {
        kind: 'iconCategory',
        toolboxitemid: 'files',
        name: t('files'),
        icon: faFolderOpen,
        colour: '#65528e',
        contents: [],
      },
      // Keep the library panel unavailable until its workflow is ready.

      category('Pico', '#338060', faMicrochip, [
        { kind: 'label', text: 'LED' },
        'pico_led_power',
        { kind: 'label', text: t('pins') },
        'pico_pin_number',
        { kind: 'label', text: t('sensors') },
        'pico_temperature',
      ]),

      category(t('xiaomiaoBoard'), '#2f7f8f', faMicrochip, ['xiaomiao_display_config', 'xiaomiao_button_is_pressed']),
      category('Matrix:bit', '#745ba5', faMicrochip, [
        'matrixbit_display_config',
        'matrixbit_pin_number',
        'matrixbit_button_is_pressed',
        'matrixbit_neopixel',
      ]),
      {
        kind: 'iconCategoryGroup', name: 'M5Stack', icon: faMicrochip, colour: '#b83a36',
        contents: [
          category(t('m5Program'), '#b83a36', faCode, ['m5_begin', 'm5_update']),
          category(t('display'), '#b83a36', faDisplay, [
            { type: 'm5_fill', inputs: { COLOR: numberInput(0) } },
            { type: 'm5_text_color', inputs: { FOREGROUND: numberInput(16777215), BACKGROUND: numberInput(0) } },
            { type: 'm5_text_size', inputs: { SIZE: numberInput(2) } },
            { type: 'm5_text', inputs: { TEXT: textInput('Hello!'), X: numberInput(8), Y: numberInput(8) } },
            'm5_rotation', { type: 'm5_brightness', inputs: { VALUE: numberInput(128) } }, 'm5_dimension',
            { type: 'm5_pixel', inputs: { X: numberInput(10), Y: numberInput(10), COLOR: numberInput(16711680) } },
            { type: 'm5_line', inputs: { X1: numberInput(0), Y1: numberInput(0), X2: numberInput(40), Y2: numberInput(40), COLOR: numberInput(65280) } },
            { type: 'm5_rectangle', inputs: { X: numberInput(8), Y: numberInput(40), WIDTH: numberInput(30), HEIGHT: numberInput(20), COLOR: numberInput(255) } },
          ]),
          category(t('buttons'), '#b83a36', faHandPointer, ['m5_button']),
          category(t('sensors'), '#b83a36', faMicrochip, [
            'm5_stick_accel', 'm5_stick_gyro', 'm5_stick_battery',
          ]),
        ],
      },

      {
        kind: 'iconCategoryGroup',
        icon: faMicrochip,
        name: 'Micro:bit',
        colour: '#b05039',
        contents: [
          category(t('display'), '#b05039', faDisplay, [
            'microbit_show', 'microbit_scroll', 'microbit_display_power', 'microbit_display_is_on',
            { type: 'microbit_set_pixel', inputs: { X: numberInput(0), Y: numberInput(0), BRIGHTNESS: numberInput(9) } },
            { type: 'microbit_get_pixel', inputs: { X: numberInput(0), Y: numberInput(0) } },
            'microbit_clear_display',
            { kind: 'label', text: t('images') },
            'microbit_image_builtin', 'microbit_image_custom',
            { type: 'microbit_image_transform', inputs: { IMAGE: { shadow: { type: 'microbit_image_builtin' } } } },
            { type: 'microbit_image_shift', inputs: { IMAGE: { shadow: { type: 'microbit_image_builtin' } }, AMOUNT: numberInput(1) } },
          ]),
          category(t('pins'), '#b05039', faPlug, [
            'microbit_read_digital', 'microbit_write_digital', 'microbit_read_analog',
            'microbit_set_pull',
            { type: 'microbit_write_analog', inputs: { DUTY: numberInput(512) } },
            { type: 'microbit_set_analog_period', inputs: { PERIOD: numberInput(20) } },
          ]),
          category(t('buttons'), '#b05039', faHandPointer, [
            'microbit_button_is_pressed', 'microbit_button_was_pressed', 'microbit_button_press_count',
            'microbit_logo_is_touched',
          ]),
          category(t('microbitRadio'), '#b05039', faWifi, [
            'microbit_radio_power',
            { type: 'microbit_radio_config', inputs: { GROUP: numberInput(0), CHANNEL: numberInput(7), POWER: numberInput(6) } },
            { type: 'microbit_radio_send', inputs: { MESSAGE: textInput('Hello') } },
            'microbit_radio_receive',
            { kind: 'label', text: t('microbitRadioBytes') },
            'microbit_radio_send_bytes', 'microbit_radio_receive_bytes', 'microbit_radio_receive_full',
            { kind: 'label', text: t('settingsTitle') },
            { type: 'microbit_radio_buffers', inputs: { LENGTH: numberInput(32), QUEUE: numberInput(3) } },
            'microbit_radio_reset',
          ]),
          category(t('microbitMicrophone'), '#b05039', faMicrophone, [
            'microbit_microphone_level', 'microbit_microphone_is_event', 'microbit_microphone_was_event',
            { type: 'microbit_microphone_threshold', inputs: { VALUE: numberInput(128) } },
            'microbit_microphone_current_event', 'microbit_sound_event', 'microbit_microphone_events',
          ]),
          category(t('buzzer'), '#b05039', faVolumeHigh, [
            { type: 'microbit_music_pitch', inputs: { FREQ: numberInput(440), DURATION: numberInput(200) } },
            { type: 'microbit_music_play', inputs: { NOTES: { shadow: { type: 'microbit_music_melody' } } } },
            'microbit_music_melody', 'microbit_music_stop',
            { type: 'microbit_music_tempo', inputs: { BPM: numberInput(120), TICKS: numberInput(4) } },
            { type: 'microbit_music_volume', inputs: { VOLUME: numberInput(64) } },
            'microbit_speaker_power',
          ]),
          category(t('sensors'), '#b05039', faMicrochip, [
            'microbit_light_level', 'microbit_temperature', 'microbit_acceleration', 'microbit_running_time',
          ]),
        ],
      },

      {
        kind: 'iconCategoryGroup', name: 'SPIKE Prime', icon: faMicrochip, colour: '#b08a20',
        contents: [
          category(t('spikeProgram'), '#b08a20', faCode, [
            'spike_run',
            { type: 'spike_run_awaitables', inputs: { TASKS: { shadow: { type: 'lists_create_with', extraState: { itemCount: 0 } } } } },
            { type: 'spike_on_condition', inputs: { CONDITION: { shadow: { type: 'logic_boolean', fields: { BOOL: 'FALSE' } } } } },
            { type: 'spike_until', inputs: { CONDITION: { shadow: { type: 'logic_boolean', fields: { BOOL: 'TRUE' } } }, TIMEOUT: numberInput(0) } },
            { type: 'spike_sleep', inputs: { DURATION: numberInput(500) } },
          ]),
          category(t('display'), '#b08a20', faDisplay, [
            { type: 'spike_write', inputs: { TEXT: textInput('Hello!'), BRIGHTNESS: numberInput(100), DURATION: numberInput(500) } },
            { type: 'spike_pixel', inputs: { X: numberInput(2), Y: numberInput(2), BRIGHTNESS: numberInput(100) } },
            'spike_clear',
            { type: 'spike_get_pixel', inputs: { X: numberInput(0), Y: numberInput(0) } },
            { type: 'spike_image_constant' },
            { type: 'spike_show_image', inputs: { IMAGE: numberInput(1) } },
            { type: 'spike_matrix_show' },
            { type: 'spike_orientation_constant' },
            { type: 'spike_matrix_orientation' },
            { type: 'spike_matrix_set_orientation', inputs: { ORIENTATION: numberInput(0) } },
            { type: 'spike_light_color', inputs: { COLOR: numberInput(9) } },
            { type: 'spike_light_rgb', inputs: { R: numberInput(100), G: numberInput(0), B: numberInput(0) } },
            { type: 'spike_color_matrix_clear' },
            { type: 'spike_color_matrix_get_pixel', inputs: { X: numberInput(0), Y: numberInput(0) } },
            { type: 'spike_color_matrix_set_pixel', inputs: { X: numberInput(0), Y: numberInput(0), COLOR: numberInput(9), INTENSITY: numberInput(10) } },
            { type: 'spike_color_matrix_show' },
            { type: 'spike_color_pixel', inputs: { COLOR: numberInput(9), INTENSITY: numberInput(10) } },
          ]),
          category(t('buttons'), '#b08a20', faHandPointer, ['spike_button_pressed', 'spike_button']),
          category(t('spikeMotors'), '#b08a20', faRotateRight, [
            { type: 'spike_motor_run', inputs: { SPEED: numberInput(360) } },
            { type: 'spike_motor_degrees', inputs: { DEGREES: numberInput(360), SPEED: numberInput(360) } },
            { type: 'spike_motor_time', inputs: { DURATION: numberInput(1000), SPEED: numberInput(360) } },
            'spike_motor_stop', 'spike_motor_position',
            { type: 'spike_motor_reset', inputs: { ANGLE: numberInput(0) } },
            { type: 'spike_motor_absolute', inputs: { ANGLE: numberInput(90), SPEED: numberInput(360) } },
            { type: 'spike_motor_relative', inputs: { ANGLE: numberInput(90), SPEED: numberInput(360) } },
            { type: 'spike_motor_absolute_position' },
            { type: 'spike_motor_velocity' },
            { type: 'spike_motor_duty' },
            { type: 'spike_motor_set_duty', inputs: { PWM: numberInput(1000) } },
            { type: 'spike_motor_result' },
          ]),
          category(t('spikePairCategory'), '#b08a20', faRotateRight, [
            { type: 'spike_pair', fields: { LEFT: 'A', RIGHT: 'B' } },
            { type: 'spike_tank', inputs: { LEFT_SPEED: numberInput(360), RIGHT_SPEED: numberInput(360) } },
            { type: 'spike_pair_degrees', inputs: { DEGREES: numberInput(360), STEERING: numberInput(0), SPEED: numberInput(360) } },
            'spike_pair_stop',
            { type: 'spike_pair_move', inputs: { STEERING: numberInput(0), SPEED: numberInput(360) } },
            { type: 'spike_pair_time', inputs: { DURATION: numberInput(1000), STEERING: numberInput(0), SPEED: numberInput(360) } },
            { type: 'spike_tank_degrees', inputs: { DEGREES: numberInput(360), LEFT_SPEED: numberInput(360), RIGHT_SPEED: numberInput(360) } },
            { type: 'spike_tank_time', inputs: { DURATION: numberInput(1000), LEFT_SPEED: numberInput(360), RIGHT_SPEED: numberInput(360) } },
            { type: 'spike_unpair' },
          ]),
          category(t('buzzer'), '#b08a20', faVolumeHigh, [
            { type: 'spike_beep', inputs: { FREQ: numberInput(440), DURATION: numberInput(500), VOLUME: numberInput(100) } },
            { type: 'spike_sound_stop' },
            'spike_waveform', 'spike_sound_channel',
            { type: 'spike_sound_volume', inputs: { VOLUME: numberInput(100) } },
          ]),
          category(t('sensors'), '#b08a20', faMicrochip, [
            'spike_color', 'spike_color_constant', 'spike_reflection',
            'spike_distance', 'spike_force', 'spike_force_pressed',
            { type: 'spike_rgbi' },
            { type: 'spike_force_raw' },
            { type: 'spike_distance_clear' },
            { type: 'spike_distance_get_pixel', inputs: { X: numberInput(0), Y: numberInput(0) } },
            { type: 'spike_distance_set_pixel', inputs: { X: numberInput(0), Y: numberInput(0), BRIGHTNESS: numberInput(100) } },
            { type: 'spike_distance_show' },
          ]),
          category(t('spikeMotionCategory'), '#b08a20', faMicrochip, [
            'spike_tilt', { type: 'spike_reset_yaw', inputs: { ANGLE: numberInput(0) } },
            { type: 'spike_gesture' },
            { type: 'spike_yaw_face' },
            { type: 'spike_quaternion' },
            { type: 'spike_stable' },
            { type: 'spike_tap_count' },
            { type: 'spike_reset_tap_count' },
            { type: 'spike_up_face' },
            { type: 'spike_tilt_angles' },
            { type: 'spike_acceleration' },
            { type: 'spike_angular_velocity' },
            { type: 'spike_gesture_constant' },
            { type: 'spike_face_constant' },
            { type: 'spike_set_yaw_face', inputs: { FACE: numberInput(0) } },
          ]),
          category(t('spikeDeviceCategory'), '#b08a20', faPlug, [
            { type: 'spike_device_id' },
            { type: 'spike_device_ready' },
            { type: 'spike_device_data' },
            { type: 'spike_device_duty' },
            { type: 'spike_device_set_duty', inputs: { DUTY: numberInput(0) } },
            { type: 'spike_hub_temperature' },
            { type: 'spike_hub_uuid' },
            { type: 'spike_hub_hardware' },
            'spike_hub_power_off',
          ]),
        ],
      },

    ],
  };
}
