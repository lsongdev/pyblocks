# API coverage

This index describes **dedicated blocks currently available**, not all functions implemented by the firmware. Generic Python import/name/member/call blocks can access additional native APIs without a dedicated wrapper. Entries are a source-code inventory, not a claim of physical verification. References point to the corresponding upstream API; check the version installed on the device before adding or using a wrapper.

| API family | Coverage and next work |
| --- | --- |
| [Python](python.md) | Language, data, expressions, files, async composition |
| [MicroPython](micropython.md) | Shared hardware, network, timing |
| [micro:bit](microbit.md) | Native micro:bit APIs, V1/V2 distinctions |
| [SPIKE Prime](spike.md) | App 3 native APIs and awaitables |
| [M5Stack](m5stack.md) | UIFlow2, model-specific peripherals |
| [Matrix:bit, XiaoMiao, Pico](boards.md) | Board pin mappings, built-in peripherals |

## Validation labels

- **Wrapped**: dedicated block and generator exist in the source. Tests may cover some or all operations.
- **Candidate**: a useful API not yet exposed; confirm its exact signature, firmware availability, and semantics before implementation.
- **Hardware verified**: record board model, firmware version, test program and observed result. Do not infer hardware verification from generated code or CI success.

Keep the toolbox open to exploration. A missing dedicated block does not mean an unsupported runtime. Conversely, a visible block does not guarantee that every connected board implements that API. Avoid duplicate board-specific wrappers for shared MicroPython functionality.
