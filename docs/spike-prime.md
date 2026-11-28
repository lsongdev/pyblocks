# SPIKE Prime

The **SPIKE Prime** toolbox group targets the six-port hub with a 5×5 light matrix, running **LEGO official SPIKE App 3 firmware**. It does not target SPIKE Legacy's `spike` API or Pybricks.

## Say hello

1. Open [PyBlocks](https://blocks.lsong.org/) and import [the SPIKE hello project](../examples/spike-hello.blockly.json).
2. In **SPIKE Prime → Program (runloop)**, **runloop run** automatically wraps its actions in an async function.
3. Put a generic **wait for … to finish** block inside it, connect the **scroll text** expression and enter a short message.
4. Click **Upload and run**.

Choose the SPIKE Prime in the USB serial dialog. PyBlocks reads the hub's protocol and firmware versions, shows its capabilities and asks which program slot (0–19) to use before writing anything. Confirm to upload and start the program and stream `print()` output over the same port. Uploading overwrites the selected slot. Subsequent uploads reuse the connected hub and slot; **Change slot** or **Change device** is available near the upload controls. After disconnection, choose and confirm the hub again; the last slot is a local preference, not proof of device identity. See [LEGO Education support](https://education.lego.com/en-us/product-resources/spike-prime/teacher-resources/tips-tricks/) for storage positions.

Use desktop Chrome or Edge and disconnect the LEGO SPIKE App before uploading. Use **Disconnect** to release the USB port after reading the console.

On Linux, export the Python file and run the command below from the repository to upload directly over USB.

```sh
node tools/upload-spike.js --slot 0 program.py
```

The command overwrites the specified slot, starts the program, and streams its console output. It detects a single SPIKE Prime under `/dev/serial/by-id`. Use `--port /dev/ttyACM1` to select a device explicitly. Your account needs read and write access to that serial port. USB upload and execution were verified on a SPIKE Prime reporting firmware 1.8.149 and RPC 1.0.47.

The generated program calls the official API directly:

```python
from hub import light_matrix as _spike_light_matrix
import runloop as _spike_runloop

async def _spike_task():
    await _spike_light_matrix.write('Hello!', 100, 500)

_spike_runloop.run(
    _spike_task(),
)
```

## Included blocks

| Group | Operations |
| --- | --- |
| Program | Automatically run concurrent task bodies; condition events; wait for a condition (with optional timeout); wait in milliseconds |
| Display | Scroll text, set a pixel, clear the matrix |
| Buttons | Read left/right button pressed state or held duration |
| Motors | Continuous run, turn by degrees, run for a duration, stop, relative position/reset; pair two motors, tank drive, move by degrees, stop pair |
| Sensors | Yaw/pitch/roll, reset yaw, color and reflected light, distance, force and force-button state |

## Concurrent tasks, conditions and button events

Each **SPIKE runloop run** block is an explicit scheduler container. Put ordinary actions and event blocks directly inside it. PyBlocks automatically wraps ordinary actions in an async function and passes that function plus this container's event listeners to one native `runloop.run(...)`. There is no extra task layer.

```text
SPIKE runloop run
    print "Listening..."
    when left button pressed? becomes true
        set light matrix x 0 y 0 brightness 100
    when force sensor C pressed? becomes true
        clear light matrix
```

[Download the button example](../examples/spike-buttons.blockly.json) or [the force sensor example](../examples/spike-force-event.blockly.json). Events must be directly inside their runloop container, not outside it or inside a loop, branch, function or another event. Their placement declares listeners for the whole container; it is not a sequential action that starts listening only when execution reaches that line. Ordinary actions in the container retain their order.

Each run block generates its own call at its place in the program. Multiple run blocks execute sequentially, waiting for each group to finish; they are not merged globally. A persistent listener keeps its run block active, so later run blocks will not start until it ends. Tasks within one container cooperate by yielding at `await`; blocking code delays all tasks in that container.

**When condition becomes true** accepts any synchronous Boolean expression: a force sensor pressed state, a color comparison, or a compound condition. It waits for false at startup, fires once when true is observed, and waits for false before re-arming. An initially true condition must first become false; it does not immediately fire. The condition is re-evaluated, not saved as a Boolean snapshot.

**Wait until** is an awaitable expression. Connect it to the generic await block. It takes a Boolean expression, such as “distance is valid and less than 100 mm” or “left button held time > 0”. With await, it generates `await runloop.until(lambda: condition, timeout=...)`, so the expression is evaluated again on each check. Other tasks can progress while waiting. A timeout of **0** waits indefinitely; a positive timeout is milliseconds. On timeout execution continues even if the condition is still false, so check the condition again if that distinction matters. The predicate must be synchronous.

**Button events** use **when condition becomes true** with the **button pressed?** Boolean block (`button.pressed(...) > 0`). It waits for release at startup, then waits for a press, awaits its handler, waits for release, and repeats. A held button produces one invocation. Left/right listeners and multiple listeners for one button have independent tasks. There is no extra debounce or raw interrupt behavior. Quick presses during a handler can be missed, and blocking code delays every task. Awaiting inside a handler allows other tasks to progress; it does not allow that same handler to overlap with itself.

## Units and behavior

- Ports **A–F** are LEGO ports, not GPIO numbers. Connect the matching motor or sensor to the selected port.
- Motor speed is **degrees per second**, not power percent. Supported speed depends on the motor. Timed/degree moves return an awaitable; explicitly await it to wait for completion. Continuous run returns immediately and continues until stopped or changed.
- Motor stopping modes include BRAKE, COAST, HOLD, CONTINUE, SMART_COAST and SMART_BRAKE. Choose deliberately. Degree-based paired movement exposes the same stopping mode. Optional acceleration/deceleration inputs are in degrees/s²; disconnected inputs omit the keyword.
- Pair distinct left/right ports before using a motor pair. Pair IDs 1–3 correspond to native `PAIR_1`–`PAIR_3`. Steering is **-100–100**, with 0 straight. Movement degrees describe motor rotation, not distance traveled.
- Text brightness is **0–100%**; character time is milliseconds. Matrix pixel coordinates are **0–4**, brightness **0–100%**.
- Button readings are **held milliseconds**, with 0 when released. Compare with 0 for a condition. Reading is polling, not an event or debounced callback.
- Native orientation readings use **0.1°**: 900 means 90°. The axes are yaw, pitch and roll.
- Distance is in **millimeters**. **-1** indicates no valid measurement; check this before applying a distance threshold.
- Force uses **0.1 N**, ranging from 0–100: 25 means 2.5 N. Reflection is **0–100%**. Color readings remain native numeric codes; compare with the LEGO color constant block.
- Scroll text, timed/degree motor actions, paired degree movement and runloop waits are native awaitable expressions. Use the generic await statement or value block inside a SPIKE runloop task or async function. Ordinary functions may return an awaitable without awaiting it. Calls never insert await automatically. The SPIKE runtime uses runloop; asyncio APIs should not be assumed available.

Inputs are passed to the native APIs. Keep values within the documented ranges; firmware errors are not suppressed. Missing devices, canceled movement and stalled motors need application-specific handling. The generic await value block exposes the movement status code; the await statement discards it.

## API references and validation

API definitions and semantics were checked against the [LEGO SPIKE App Python help](https://spike.legoeducation.com/prime/help/lls-help-python) and its [English documentation data](https://spike.legoeducation.com/content/en-us/documents.json). The official [Python lessons](https://education.lego.com/en-us/lessons/spike-python-u3-sensor-control/spike-python-u3l1-start-sensing/) demonstrate these firmware APIs.

Automated checks cover both toolbox languages, Python compilation, async scope checks, and simulated call order, arguments and sensor values. The upload path also has simulated tests for COBS framing, CRC-32, message layouts and the clear/upload/start sequence, matching the [LEGO protocol documentation](https://github.com/LEGO/spike-prime-docs). Physical motor, sensor and Bluetooth upload validation is pending.

## Explicit await and motion composition

[Red tape avoidance example](../examples/spike-red-tape-avoidance.blockly.json) defines ordinary forward, reverse, left and right functions. Reverse and turns return the native motor awaitable. The async avoidance function explicitly awaits reverse and left turn before calling forward. Use **evaluate expression** to discard a call result without waiting; calling a Python async function does not schedule its coroutine. Do not assume that discarding every native awaitable starts its operation; verify the specific firmware API. Regression tests cover code generation and simulated ordering; physical SPIKE verification is still required.

## Expanded native API coverage

Cross-checked against the [SPIKE 3.4.3 help mirror](https://tuftsceeo.github.io/SPIKEPythonDocs/SPIKE3.html) and [v3 reference](https://jvolkening.github.io/lego-spike-python-v3-docs/api.html). The toolbox now includes all nine documented motor_pair operations, the twelve documented motor operations, Hub matrix images/pixels/orientation, indicator lights, speaker beep/volume/stop, motion queries and yaw reference, device readiness/ID/data/duty, RGBI, raw force, distance sensor LEDs and external color matrix. Awaitable motion and beep expressions require the shared explicit await block only when waiting is intended. Optional motor ramps use the firmware defaults when blank. The tank time signature is pair, left_velocity, right_velocity, duration; the tank degree signature is pair, degrees, left_velocity, right_velocity. Raw tuple and list values are passed through without conversion.

Not dedicated blocks: app-side display/sound (requires SPIKE app integration), undocumented methods, a few runtime-specific return/constant details. Generic Python call/member blocks remain available. New wrappers have regression tests but need physical firmware testing.
