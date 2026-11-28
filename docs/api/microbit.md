# micro:bit

Reference: [micro:bit MicroPython documentation](https://microbit-micropython.readthedocs.io/en/latest/). Implementation: [microbit.js](../../src/blocks/boards/microbit.js).

| Capability | Wrapped | Candidate |
| --- | --- | --- |
| display and Image | Show/scroll, power, pixels, clear, built-in/custom images, transform/shift, light level | Additional image operations and display options |
| pins | Digital/analog read/write, pull, PWM period | Touch and V2 pin-specific modes |
| buttons | pressed, was_pressed, press count, V2 logo touch | Touch configuration where supported |
| accelerometer | Axis readings | XYZ tuple, gestures, gesture history |
| compass | No dedicated wrapper | Calibration, heading, field strength |
| radio | Power/config/reset, text/bytes send and receive, full receive, buffers | Further radio configuration with native limits |
| music and speaker | Pitch, play, built-in tunes, stop, tempo, volume, V2 speaker power | Additional music/audio capabilities |
| microphone | V2 sound level, current/event history, thresholds | V2-only; verify exact firmware |
| system | Temperature, running time | sleep/reset/panic and filesystem/runtime differences |

V1/V2 do not have identical peripherals or storage. Do not map native micro:bit pins to machine.Pin; the micro:bit APIs are distinct. See [firmware](../firmware.md) for installed versions.
