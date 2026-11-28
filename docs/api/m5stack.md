# M5Stack UIFlow2

Reference: [UIFlow2 documentation](https://uiflow-micropython.readthedocs.io/en/latest/). Implementation: [m5stack.js](../../src/blocks/boards/m5stack.js). Existing targets: [M5Stack guide](../m5stack.md).

| Capability | Wrapped | Candidate |
| --- | --- | --- |
| M5 lifecycle | begin/update | Model-specific initialization |
| M5.Lcd | Fill, text, text color/size, brightness, rotation, dimensions, pixel, line, filled rectangle | Circle/outline/image/font/sprite and other display methods |
| M5.BtnA/B/C | Press state and pressed/released/clicked events | Button availability per model |
| IMU | Stick acceleration and gyro | Tuple values, availability/calibration |
| Power | Battery level | Charging/voltage/current and power management per model |
| Other | Shared ESP32 APIs where supported | Speaker, microphone, RTC, touch and external units per board |

M5Stack is a family, not a single hardware model. UIFlow2 APIs, onboard sensors and flash images differ. Do not assume Core Basic and Stick-C provide identical hardware. Verify APIs against the matching UIFlow2 release and board.
