<div align="center">
  <img src="public/icons/logo.png" width="72" height="72" alt="PyBlocks logo">
  <h1>PyBlocks</h1>
  <p><strong>Build with blocks. Run real MicroPython.</strong></p>
  <p>A browser-based programming workspace for ESP32, Matrix:bit, micro:bit, and Raspberry Pi Pico.</p>
  <p>
    <a href="https://blocks.lsong.org/"><strong>Open the editor →</strong></a>
    &nbsp;·&nbsp;
    <a href="#quick-start">Quick start</a>
    &nbsp;·&nbsp;
    <a href="docs/user-guide.md">Beginner’s guide</a>
    &nbsp;·&nbsp;
    <a href="#examples">Examples</a>
    &nbsp;·&nbsp;
    <a href="#development">Development</a>
  </p>
  <a href="https://github.com/lsongdev/pyblocks/actions/workflows/pages.yml">
    <img src="https://github.com/lsongdev/pyblocks/actions/workflows/pages.yml/badge.svg" alt="GitHub Pages deployment status">
  </a>
</div>

---

PyBlocks brings visual programming, readable Python, firmware installation, and a serial console into one workspace. Assemble blocks, inspect the generated code, and upload `main.py` directly to a connected board.

[![PyBlocks showing a beginner hello program](docs/images/01-hello.webp)](docs/user-guide.md)

## What you can build

| Capability | Included tools |
| --- | --- |
| **Hardware control** | Digital I/O, pull configuration, raw edge interrupts, ADC, PWM, buzzers, servos, I²C, UART, and NeoPixel LEDs |
| **Board peripherals** | Matrix:bit display, RGB LED, buttons, and touch pads; micro:bit display, images, music, radio, and V2 microphone; Pico LED, pin mapping, and chip temperature |
| **Networking** | Wi-Fi station and AP modes, scanning, interface configuration, HTTP requests, and MQTT publish/subscribe |
| **Program flow** | Variables, functions, loops, exception handling, asynchronous tasks, and NTP clock synchronization |
| **Device tools** | Firmware installation, Python library uploads, device file management, and an interactive serial console |
| **Everyday editing** | English and Simplified Chinese, local autosave, project import/export, editable Python, resizable panels, and offline installation as a PWA |

Blocks generate calls to the target firmware's APIs. Capabilities are grouped by what they do; a board must still provide the corresponding modules and hardware.

## Quick start

New to programming? Start with the illustrated **[Beginner’s Guide](docs/user-guide.md)**: say hello, blink a light, and ask a question.

1. Open **[blocks.lsong.org](https://blocks.lsong.org/)** in a desktop browser with Web Serial support, such as Chrome or Edge.
2. Connect your board over USB. If it needs MicroPython, choose **Device → Install MicroPython firmware**, select the matching board, and follow the installer.
3. Build a program, or download an [example project](#examples) and load it with **Open Project**.
4. Click **Upload and run**, select the board's serial port, and watch the output in the serial console.

**Upload and run** writes `main.py` through MicroPython's serial raw REPL, then restarts the board. **Download** exports the current Python code; **Save Project** exports the blocks, manual code edits, and attached libraries.

> Firmware installation replaces the board's existing program and files. Back up anything you want to keep before installing.

Device connections require **HTTPS or localhost** and the relevant browser APIs. Pico firmware installation additionally requires WebUSB. Close other applications using the serial port before connecting.

## Supported boards

| Board | Installer target | Board-specific support |
| --- | --- | --- |
| **Matrix:bit** | Classic ESP32, 8 MB flash · `ESP32_GENERIC` v1.29.0 | Display, RGB LED, buttons, touch pads, and board-to-GPIO mapping |
| **BBC micro:bit V1** | Foundation MicroPython v1.1.1 | Display, images, pins, buttons, music, sensors, and radio |
| **BBC micro:bit V2** | Foundation MicroPython v2.1.2 | V1 capabilities plus logo touch, onboard speaker, and microphone |
| **Raspberry Pi Pico** | Original RP2040 Pico · MicroPython v1.29.0 | Onboard LED, GP pin mapping, ADC, and internal temperature |

The Pico installer targets the **original Pico**, excluding Pico W, Pico 2, and other variants. NTP, HTTP, MQTT, and Wi-Fi features currently target the project's ESP32 firmware; micro:bit uses its own Foundation APIs. Module availability depends on the firmware build, even when the board name is the same.

<details>
<summary><strong>Board installation notes and alternative tools</strong></summary>

### Matrix:bit

The tested model is the classic ESP32 board with 8 MB flash. As an alternative to the built-in installer, download the full `ESP32_GENERIC` binary from [MicroPython](https://micropython.org/download/ESP32_GENERIC/) and flash it at `0x1000` using [Espressif ESP Tool](https://espressif.github.io/esptool-js/). Erasing flash removes existing files.

### micro:bit V1 / V2

The built-in serial upload workflow supports both versions. The flat filesystem stores attached Python libraries alongside `main.py`. Uploads stage a complete temporary file first; because this filesystem lacks rename support, the final copy can be interrupted by power loss. Upload again if that happens.

The official [micro:bit Python Editor](https://python.microbit.org/) is another way to install firmware or send an exported `main.py`. You can also use it to create a `.hex` file for the `MICROBIT` drive. See the [official Python Editor guide](https://microbit.org/get-started/user-guide/python-editor/).

### Raspberry Pi Pico

Hold **BOOTSEL** while connecting USB, release it, and select **RP2 Boot** in the installer. PyBlocks writes the official UF2 through WebUSB PICOBOOT, reads back the written data for verification, and reboots the board. From running MicroPython, `machine.bootloader()` can also enter the bootloader.

Firmware sources and licenses are documented in [the firmware notice](public/firmware/NOTICE.txt).

</details>

## Examples

Download a `.blockly.json` file, then choose **Open Project** in the editor. Replace placeholder Wi-Fi credentials and network addresses before running network examples.

| Project | What it demonstrates |
| --- | --- |
| [First hello](examples/beginner-hello.blockly.json) | Print your first message; works with any supported board |
| [Pico blink](examples/beginner-pico-blink.blockly.json) | Repeat an onboard LED pattern five times on the original Pico |
| [Ask a name](examples/beginner-name.blockly.json) | Read an answer, keep it in a variable, and print a greeting |
| [Wi-Fi scan](examples/wifi-scan.blockly.json) | Enable STA, scan once, and read SSID bytes and signal strength from each result |
| [Wi-Fi access point](examples/wifi-ap.blockly.json) | Configure a WPA2 hotspot, enable AP, and inspect its address and clients |
| [HTTP GET](examples/http-get.blockly.json) | Wait for Wi-Fi, fetch a page, read the response, and close it automatically |
| [MQTT publish / subscribe](examples/mqtt-publish-subscribe.blockly.json) | Subscribe to `test`, receive messages, and publish ADC readings with periodic keepalive |
| [NTP + async tasks](examples/ntp-asyncio.blockly.json) | Synchronize UTC, then run clock and heartbeat tasks concurrently |
| [Serial input + exceptions](examples/serial-input-exceptions.blockly.json) | Read an integer, handle invalid input, and run cleanup code |
| [GPIO button debounce](examples/gpio-button-debounce.blockly.json) | Combine raw GPIO edges with explicit debounce logic |

The AP example uses `change-me-123` as its sample password. The MQTT example defaults to the public broker `broker.emqx.io:1883`; use your own broker and unique client ID for your application. Projects and generated code contain any credentials you enter, so remove them before sharing.

## Serial console

Connect to the board, enter a line, and press **Enter** or **Send**. Select **CR** (default), **LF**, **CRLF**, or no line ending. The **↑ / ↓** keys recall up to 50 recent entries; history stays in page memory and is not saved with projects.

| Control | Behavior |
| --- | --- |
| **Interrupt** | Sends Ctrl+C to interrupt a running program |
| **Soft reset** | Sends Ctrl+D; at the REPL prompt, this restarts MicroPython and runs `main.py` |
| **Clear** | Clears the visible output |

Interrupt a running program before requesting a soft reset. Input and control buttons are disabled during uploads, file operations, firmware installation, disconnection, and active sends. The console sends lines rather than emulating a complete terminal, and does not automatically distinguish the REPL from a program waiting for input.

The **Text** category's input block calls `input()`, which blocks the program and other asyncio tasks. The current ESP32 firmware's native REPL/input line editor filters non-ASCII characters, although the browser sends UTF-8 and the board can print Unicode text.

## Install and work offline

Use your browser's **Install app** or **Add to Home Screen** action on the HTTPS site. After the initial online load and successful caching, the editor, Blockly media, and bundled firmware are available offline. Browser support for device connections is still required.

Projects autosave in the current browser's local storage. Export project files for backups or transfer to another browser. Updates take effect after all editor windows close, so an update does not reload an active editing or device session.

Drag the panel dividers to resize the workspace, code, and console. Dividers support keyboard arrows, Shift for larger steps, Home/End, and double-click to restore defaults. Layout proportions are saved locally.

## Runtime notes

<details>
<summary><strong>Wi-Fi, AP mode, and scanning</strong></summary>

Enable STA before scanning. `WLAN.scan()` is synchronous and returns tuples of `(ssid, bssid, channel, rssi, security, hidden)`. SSID and BSSID are bytes; only decode SSIDs as UTF-8 when valid. Save a scan result before reading multiple fields to avoid rescanning. The current ESP32 driver reports the hidden flag as `False`, so it cannot reliably identify hidden networks; a failed scan can also return an empty list.

Configure AP before enabling it. SSIDs must contain 1–32 UTF-8 bytes, and WPA2 passwords must contain 8–63 printable ASCII characters. Open mode is an explicit selection. AP client limits, channels, and available configuration parameters depend on the firmware and local rules. Literal values are checked during generation; expressions must supply valid values at runtime.

STA and AP share the radio, and a STA connection can determine the AP channel. Enabling AP does not create Internet sharing, NAT, or a captive portal. AP `isconnected()` means at least one client is connected; use `active()` to check whether the interface is enabled. On the classic ESP32, client entries contain MAC bytes and an IPv4 address or `None`.

Static addressing calls `ifconfig((IP, subnet, gateway, DNS))`; DNS may be shared across interfaces. Disconnecting STA leaves the interface enabled. Configure reconnect attempts before connecting: `-1` means unlimited retries, `0` disables retries, and this wrapper accepts `-1` through `254`. Status codes retain the firmware's native values. Read RSSI after connecting.

</details>

<details>
<summary><strong>HTTP and MQTT</strong></summary>

**HTTP** uses the ESP32 firmware's built-in `requests.request()`. Supported methods are GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS. Store each response or use the response context block to read it without repeating the request. Close it after use; the context block also closes on exceptions.

Text/bytes request bodies use `data=`. JSON mode uses `json=` and serializes the supplied Python value: a text input becomes a JSON string, not a parsed JSON object. To send existing JSON text, use text mode with a `Content-Type` header. Response header lookup is case-sensitive. Body reads cache the entire response in RAM, so keep responses small; for HEAD, read status and headers only.

Requests block execution. HTTP error statuses such as 404 return a response rather than raising automatically. Socket timeout is not an overall deadline covering DNS and redirects, and this library's redirects do not preserve the original timeout. **Its HTTPS implementation uses `CERT_NONE` and does not validate server certificates.**

**MQTT** uses the firmware's built-in `umqtt.simple.MQTTClient`, with TCP, QoS 0/1, retained messages, and explicit polling. Register a callback before subscribing, then call the message-check block regularly. Each client keeps its latest registered callback. The callback receives a text topic and a bytes payload as local parameters; copy values to another variable to keep them outside the handler.

Text payloads are UTF-8 encoded on publish. Keep binary payloads as bytes. QoS 1 may deliver duplicates; topic filters support `+` and `#`, while publish topics must not contain wildcards. An empty retained payload clears a retained message. Connections use a clean session, so subscribe again after reconnecting.

Keepalive is measured in seconds (`0` disables it). Schedule ping calls and keep processing replies yourself. There is no automatic Wi-Fi recovery, MQTT reconnection, or heartbeat scheduling. Callbacks run synchronously during MQTT processing, including subscription and QoS 1 acknowledgement waits. Keep them short and avoid reentrant MQTT calls. Checking for a message can wait for the rest of a partially received packet.

</details>

<details>
<summary><strong>NTP, async tasks, and exceptions</strong></summary>

NTP uses `ntptime`, defaults to `pool.ntp.org`, and requires network access to UDP port 123. Querying server time does not change the RTC; synchronization sets the RTC to **UTC**. Calls are synchronous, errors propagate, and there is no automatic retry, periodic resynchronization, or timezone offset.

System epoch seconds are firmware-dependent: ESP32 uses an epoch of 2000, while RP2 uses 1970. Do not assume every timestamp is Unix time. The UTC date block calls `time.gmtime()` and returns `(year, month, day, hour, minute, second, weekday, yearday)`, with Monday as weekday 0. Use `ticks_ms()` and `ticks_diff()` for elapsed time.

Async blocks generate `async def`, `asyncio.run()`, task creation, `await`, cooperative sleeps, returns, and cancellation requests. Wait for tasks that must finish before the main coroutine returns. Tasks use shared program variables rather than capturing surrounding local values. Cancelling a task requests cancellation; awaiting it can raise `CancelledError`.

The generator rejects async-only operations inside synchronous functions or callbacks and rejects nested event loops. Tasks must yield with `await`: ordinary delays, HTTP, MQTT, and NTP calls remain blocking. Board button events have a separate polling loop that is not automatically integrated with asyncio or an explicit infinite main loop.

Exception blocks generate native `try/except/else/finally`. Place specific handlers before general ones. Use the exception variable inside its handler. A try block needs a handler or a finally body; else requires a handler. Re-raise belongs inside a handler in the same function. Finally runs on normal exits, returns, and exceptions, but cannot guarantee cleanup after power loss or a hardware reset.

</details>

<details>
<summary><strong>Board APIs and hardware semantics</strong></summary>

Generic pins use chip GPIO numbers. Board pin blocks translate labels such as Matrix:bit P0 to the corresponding GPIO; Pico GP numbers are not physical header positions. Micro:bit pin objects are Foundation firmware APIs and are not interchangeable with `machine.Pin`.

ADC inputs belong with pins, while analog output is exposed through PWM. Raw GPIO edge interrupts have no implicit debounce. The GPIO button example implements debounce explicitly. Pico's internal temperature estimates die temperature, not ambient temperature; ADC readings are not automatically calibrated voltages or sensor units.

Micro:bit radio is packet communication rather than Wi-Fi or BLE. Receiving removes a message from the queue; no message returns `None`, and invalid text packets can raise a decoding error. The V2 microphone reports relative sound intensity, not calibrated decibels or recordings. Its history queries clear event history. Foundation firmware does not expose the general-purpose BLE communication API needed for generic BLE blocks.

</details>

## Development

Use **Node.js 24** to match the deployment workflow.

```sh
git clone https://github.com/lsongdev/pyblocks.git
cd pyblocks
npm ci
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Prepare firmware and start the Vite development server |
| `npm test` | Run block generation, runtime, transport, and device-protocol tests |
| `npm run build` | Prepare firmware and create the production app in `dist/` |
| `npm run preview` | Preview the production build locally, including PWA installation |

Some runtime tests execute generated Python with **`python3`**. PWA support is enabled for production builds, not the development server.

### Project structure

| Location | Responsibility |
| --- | --- |
| `src/main.js` | Editor entry point |
| `src/blocks/` | Block definitions and Python generators, grouped by hardware capability, board, or shared language features |
| `src/python/` | Identifier allocation, validation, callbacks, and generation contexts |
| `src/editor/` | Workspace, toolbox, dialogs, library management, and serial input UI |
| `src/device/` | Serial sessions, uploads, and device file operations |
| `src/firmware/` | Firmware installers and pinned image metadata |
| `src/project/` | Project serialization, validation, and local storage |
| `src/i18n/`, `src/styles/` | Translations and presentation |
| `test/`, `examples/` | Automated checks and importable projects |
| `public/` | Static assets, icons, CNAME, and downloaded firmware |

Generated names preserve legal Unicode spelling. Invalid characters and starts are repaired, and keywords, imports, internal names, and normalized-name collisions are protected. Saved variable names and IDs stay unchanged.

### Firmware and deployment

Development and production builds download the images pinned in [`src/firmware/images.json`](src/firmware/images.json), verify SHA-256 checksums, and cache them under `public/firmware/`. Verified files are reused; failed downloads or checksum mismatches stop the build. Firmware binaries are not committed. Production output includes the firmware for same-origin downloads and offline caching.

To update firmware, change its version, URL, and checksum, then verify the board APIs. micro:bit images are pinned to a specific Foundation editor commit. See [firmware sources and licenses](public/firmware/NOTICE.txt).

GitHub Actions builds and publishes `dist/` to GitHub Pages at **[blocks.lsong.org](https://blocks.lsong.org/)**. The relative asset base supports root and subdirectory hosting. The shared panel-resizing module is bundled from `../scripts` when available, otherwise fetched from its published source during the build. Generate the PWA block icons with `python3 tools/generate-pwa-icons.py`; the header logo is stored separately in `public/icons/logo.png`.

### Validation status

Automated coverage includes Python generation, Unicode names, exception flow, cooperative scheduling, serial write ordering and shutdown, firmware decoding, and protocol simulations. Hardware checks are tracked separately:

| Feature | Matrix:bit verification |
| --- | --- |
| MQTT | Publish/subscribe, receipt of a uniquely marked public-broker message |
| HTTP | Seven request methods, headers, Unicode/JSON bodies, response reads, 404, and response cleanup |
| NTP / asyncio | UTC synchronization, interleaved tasks, task results, and cancellation request behavior |
| Serial / exceptions | Line input, history, interrupt, soft reset, ValueError handling, and finally execution |
| New Wi-Fi AP / scan blocks | Code generation and simulated-driver checks; physical-board verification pending |

Passing a build or simulation does not establish physical-board behavior. HTTPS certificate validation, network-failure recovery, and all board/firmware combinations have not been verified.

## API references

- [MicroPython libraries](https://docs.micropython.org/en/v1.29.0/library/index.html) and [ESP32 reference](https://docs.micropython.org/en/v1.29.0/esp32/quickref.html)
- [WLAN](https://docs.micropython.org/en/v1.29.0/library/network.WLAN.html), [asyncio](https://docs.micropython.org/en/v1.29.0/library/asyncio.html), and [time](https://docs.micropython.org/en/v1.29.0/library/time.html)
- Firmware-pinned [MQTT](https://github.com/micropython/micropython-lib/blob/ee4bb8ff139e24c42b739935fbd8ec7c4d061e02/micropython/umqtt.simple/umqtt/simple.py), [HTTP](https://github.com/micropython/micropython-lib/blob/ee4bb8ff139e24c42b739935fbd8ec7c4d061e02/python-ecosys/requests/requests/__init__.py), and [NTP](https://github.com/micropython/micropython-lib/blob/ee4bb8ff139e24c42b739935fbd8ec7c4d061e02/micropython/net/ntptime/ntptime.py) implementations
- [micro:bit radio](https://microbit-micropython.readthedocs.io/en/v2-docs/radio.html), [microphone](https://microbit-micropython.readthedocs.io/en/v2-docs/microphone.html), and [BLE](https://microbit-micropython.readthedocs.io/en/v2-docs/ble.html)
