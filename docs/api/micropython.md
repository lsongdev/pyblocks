# Shared MicroPython APIs

References: [MicroPython library](https://docs.micropython.org/en/latest/library/index.html), [ESP32 quick reference](https://docs.micropython.org/en/latest/esp32/quickref.html), [RP2 quick reference](https://docs.micropython.org/en/latest/rp2/quickref.html). Latest documentation may describe features absent from older installed firmware.

| Module/capability | Wrapped today | Candidate / boundary |
| --- | --- | --- |
| machine.Pin | Digital read/write, pulls, edge IRQ | Drive/open drain, IRQ trigger variants, pin objects |
| machine.ADC | Pin analog read | Resolution/attenuation/read_uv per port; verify units |
| machine.PWM | Create, frequency, duty, stop; buzzer/servo compositions | duty_ns, port-specific PWM limits |
| machine.I2C | Create, scan, read/write, register read/write | Hardware vs soft I2C, address/timeout options |
| machine.UART | Create, any, read/readline/write/close | Framing parameters, readinto, flow control |
| machine.SPI | Display configuration uses SPI | General SPI bus blocks and SoftSPI |
| machine.TouchPad | Read, threshold comparison | ESP32-only availability |
| neopixel | Create/set/fill/write | Read, timing and RGBW differences |
| display | SSD1306/ST7735 configs, setup, text/pixel/clear/refresh | Hardware-specific capabilities, drawing primitives |
| network.WLAN | Station/AP, active, connect/disconnect, status, IP, MAC, RSSI, scans, reconnects, station list | Firmware-specific options and IPv6 |
| MQTT | Client setup/connect, subscribe/publish, callback, check/ping/disconnect | Reconnect policy remains explicit; QoS/TLS support depends on client |
| HTTP | Request, headers, response status/text/content/JSON, close/context | Streaming, firmware/client-specific TLS |
| time | Sleep, ticks, elapsed, epoch, datetime | RTC setters, monotonic variants |
| ntptime | Configuration, query, synchronization | Network/timezone behavior; UTC is not local timezone |
| asyncio | Explicit scheduling, create task, sleep, cancel, generic await | Event/Lock/Queue where supported |
| os, sys, machine, gc | Generic Python access, native file I/O | Directory operations, memory info, reset, RTC, WDT, timers; verify side effects |

Source: [shared hardware blocks](../../src/blocks/hardware/). The table is an inventory and candidate list, not a version-specific conformance audit. Shared blocks target compatible firmware; standard micro:bit and SPIKE have separate APIs. Some display, event and servo/buzzer operations are explicit composed components rather than one-to-one native functions.
