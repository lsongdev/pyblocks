# M5Stack Core/Basic and M5Stick-C

These targets use **official UIFlow2 2.5.3** MicroPython firmware. Generic `ESP32_GENERIC` firmware does not include the `M5` module used by these blocks. UIFlow1 programs use a different API.

## Install

Click **Install MicroPython firmware**, select the **M5Stack** family and your exact product, then **Connect and detect**. Review the detected chip, capacity and matching image before clicking **Install firmware**. Other targets are selected in their own families:

| Target | Chip / flash | Firmware |
| --- | --- | --- |
| ESP32 (Matrix:bit) | Classic ESP32 / 8 MB | Official MicroPython `ESP32_GENERIC` v1.29.0 |
| M5Stack Core/Basic | Classic ESP32 / 4 or 16 MB | Matching UIFlow2 Basic image selected by detected flash size |
| M5Stick-C | Classic ESP32 / 4 MB | UIFlow2 original StickC image |

The **M5Stick-C** choice is for the original model, not Plus, Plus2 or StickS3. Basic/Core does not mean Core2, Fire or CoreS3. The installer checks chip and flash capacity but cannot distinguish every product that shares them; select the correct model yourself.

Installation erases existing programs, files and device configuration. Firmware comes from the [official UIFlow2 release](https://github.com/m5stack/uiflow-micropython/releases/tag/2.5.3), pinned by filename and SHA-256. M5 images contain the complete flash layout and are written at **0x0**; the generic ESP32 image starts at **0x1000**.

After writing an M5 image, the installer reconnects through the MicroPython REPL and sets UIFlow's native `uiflow` NVS `boot_option` to **0**, committing it so `main.py` runs directly instead of opening the UIFlow menu. This changes the startup mode, not the firmware API. Normal **Upload and run** then writes `main.py` via the existing serial transport.

If flashing succeeds but startup configuration fails, do not assume the image is absent. Connect to the serial REPL, interrupt the startup program, and enter:

```python
import esp32
nvs = esp32.NVS('uiflow')
nvs.set_u8('boot_option', 0)
nvs.commit()
```

Then soft-reset. Setting the option back to **1** restores the UIFlow startup menu. See the pinned firmware's [boot.py](https://github.com/m5stack/uiflow-micropython/blob/2.5.3/m5stack/fs/user/boot.py).

The 16 MB Basic image is fetched on demand and is not included in the PWA offline cache; install it while online.

## First program

Open either [Basic hello](../examples/m5-basic-hello.blockly.json) or [Stick-C hello](../examples/m5-stickc-hello.blockly.json), then upload to the board.

```python
import M5
M5.begin()
M5.Lcd.fillScreen(0x000000)
M5.Lcd.setTextColor(0xFFFFFF, 0x000000)
M5.Lcd.setTextSize(1)
M5.Lcd.drawString('Hello!', 8, 8)
```

Basic's screen is 320×240; original Stick-C's is 80×160. Rotation changes reported width/height. Text scale 1 is a useful starting point on the smaller display. Default fonts do not guarantee Chinese glyph coverage.

## Buttons and sensors

Call **M5Stack initialize** once. In your loop, call **M5Stack update**, then read the desired input:

```python
while True:
    M5.update()
    if M5.BtnA.wasPressed():
        M5.Lcd.fillScreen(0x000000)
```

- Both boards have A/B; **C is Core/Basic only**. The dropdown marks this restriction.
- `isPressed()` reads the current state. `wasPressed()` / `wasReleased()` report transitions; `wasClicked()` reports a short press/release. These are native M5 methods, not added IRQ handlers or custom debounce logic.
- IMU blocks sit under the **M5Stick-C only** heading in **Sensors**. Core/Basic has no built-in IMU. Acceleration is in **g**, angular velocity in **degrees/second**. Values are not converted.
- Battery level is the native power driver's **0–100% estimate**; it is not a precision measurement.
- Colors are **24-bit RGB integers**, for example 16711680 (`0xFF0000`) for red. Brightness takes **0–255**, not percent; effective brightness steps depend on the backlight driver. Rotation is 0–3. Coordinates and dimensions use pixels.
- Blocks generate native calls; they do not silently initialize hardware, update inputs or suppress firmware errors. Keep input values within the API's documented ranges.

For reusable button events, connect `isPressed()` to the shared [async condition event](events.md). Place **M5Stack update** explicitly in an asyncio loop with an async wait; the event system does not add it.

References: [M5 display API](https://uiflow-micropython.readthedocs.io/en/latest/hardware/display.html), [button API](https://uiflow-micropython.readthedocs.io/en/latest/hardware/button.html), [IMU API](https://uiflow-micropython.readthedocs.io/en/latest/hardware/imu.html), and [pinned native bindings](https://github.com/m5stack/uiflow-micropython/tree/2.5.3/m5stack/cmodules/m5unified).

## Validation

Automated checks cover model/chip/capacity selection, binary offsets, bilingual Python generation, simulated native call order/readings, NVS boot configuration and the raw-REPL setup flow. Downloaded images are verified against pinned hashes before caching and before flashing.

### Original M5Stick-C hardware check — 2026-11-26

The browser installer was exercised on a classic ESP32 / 4 MB M5Stick-C. The complete UIFlow2 2.5.3 image was written and its MD5 verified, then the installer configured startup successfully. The board reported MicroPython v1.27.0-dirty and `M5STACK StickC with ESP32`.

A hardware test exposed that esptool-js 0.7.1's reset only released RTS, leaving the flasher stub running and causing the subsequent REPL setup to time out. The installer now explicitly releases GPIO0 and pulses EN using DTR/RTS. The full browser installation was repeated successfully after this fix; signal sequencing has an automated regression check.

The browser's **Upload and run** wrote the generated Stick-C hello program. After soft reset, the board confirmed the saved `main.py` had executed, returned screen dimensions **80×160**, and retained `boot_option = 0`. Drawing calls completed without an exception. IMU readings and battery estimation were read successfully (78% during this check), and A/B both reported unpressed.

The physical screen image was not visually inspected, and actual button press/release transitions have not been tested. Core/Basic flashing and hardware behavior remain unverified on a physical board.
