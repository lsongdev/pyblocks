# SPIKE Prime (App 3)

References: [LEGO Python help](https://spike.legoeducation.com/prime/help/lls-help-python), [SPIKE v3 reference](https://jvolkening.github.io/lego-spike-python-v3-docs/api.html). Implementation: [spike.js](../../src/blocks/boards/spike.js). See [SPIKE guide](../spike-prime.md) for units and runloop behavior.

| Module | Wrapped | Candidate / boundary |
| --- | --- | --- |
| motor | run, run_for_degrees/time, run_to_absolute/relative_position, stop, absolute/relative_position, reset_relative_position, velocity, PWM duty; direction, stopping and result constants | Verify each constant and ramp on actual HubOS |
| motor_pair | pair/unpair, move, move_for_degrees/time, move_tank, move_tank_for_degrees/time, stop | Verify tank argument order, signs, stop modes |
| runloop | run task container, run awaitable list, until, sleep_ms, composed condition listeners | Explicit native scheduling; no implicit await |
| hub.light_matrix, light | Text, pixels, clear, display/image/orientation, indicator light color/RGB | Validate image constants and intensity |
| hub.sound | Beep, stop, volume, envelope/waveform/channel | Verify optional arguments and cancellation |
| hub.button, motion_sensor | Button duration/state, tilt, yaw reference, acceleration/angular velocity, quaternion, face/gesture/tap/stability | Verify native tuple ordering, units, constants |
| color_sensor, distance_sensor, force_sensor | Color/RGBI/reflection, distance and LEDs, force/raw/pressed | Verify sentinel values and external device models |
| color_matrix | Clear/get/set/show pixel, color-intensity tuple | Verify native tuple layout and brightness |
| device, hub, color, orientation | IDs/readiness/data/duty, UUID/hardware/temperature/power off, constants | Exact version-specific behavior |
| app | No dedicated wrappers | Requires app-side integration; not assumed available |

Awaitable-returning blocks generate calls, not await statements. Use shared Python await where appropriate. SPIKE Legacy and Pybricks are distinct runtimes. USB upload was previously observed on HubOS 1.8.149/RPC 1.0.47; this does not verify all expanded API wrappers.
