# Matrix:bit, XiaoMiao and Raspberry Pi Pico

These board-specific groups add real board mappings or peripherals. They reuse the shared MicroPython blocks rather than duplicate them.

| Board | Wrapped today | Candidate / boundary |
| --- | --- | --- |
| Matrix:bit | [Pin mapping, buttons, NeoPixel, OLED configuration](../../src/blocks/boards/matrixbit.js) | Verify actual board wiring, button polarity and revisions before adding peripherals |
| XiaoMiao | [Buttons, ST7735 display config](../../src/blocks/boards/xiaomiao.js) | Verify board revisions and other onboard peripherals |
| Original Raspberry Pi Pico (RP2040) | [Onboard LED, GPIO mapping and internal temperature](../../src/blocks/boards/pico.js) | PIO (rp2.StateMachine/asm_pio), timers and other RP2040-specific features; Pico W/Pico 2 are not assumed equivalent |

References: [RP2 API](https://docs.micropython.org/en/latest/library/rp2.html), [Pico documentation](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html), [firmware guide](../firmware.md). For Matrix:bit and XiaoMiao, repository board mappings are the current implementation record; complete vendor schematics and API references have not been established in this inventory. Verify with physical boards.
