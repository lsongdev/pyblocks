# SPIKE Prime

The **SPIKE Prime** toolbox group targets the six-port hub with a 5×5 light matrix, running **LEGO official SPIKE App 3 firmware**. It does not target SPIKE Legacy's `spike` API or Pybricks.

## Say hello

1. Open [PyBlocks](https://blocks.lsong.org/) and import [the SPIKE hello project](../examples/spike-hello.blockly.json).
2. In **SPIKE Prime → Program (runloop)**, **runloop run** automatically wraps its actions in an async function.
3. Put **scroll text** inside it and enter a short message.
4. Use **download** to export Python, then copy the code into a Python project in the SPIKE App and run it there.

PyBlocks does **not yet connect to or upload programs to SPIKE hubs**. Its existing **Upload and run**, serial connection and firmware installer are for the other supported boards. Keep the LEGO official firmware for this example.

The generated program calls the official API directly:

```python
from hub import light_matrix as _spike_light_matrix
import runloop as _spike_runloop

async def _spike_task():
    await _spike_light_matrix.write('Hello!', intensity=100, time_per_character=500)

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

**Wait until** takes a Boolean expression, such as “distance is valid and less than 100 mm” or “left button held time > 0”. It generates `await runloop.until(lambda: condition, timeout=...)`, so the expression is evaluated again on each check. Other tasks can progress while waiting. A timeout of **0** waits indefinitely; a positive timeout is milliseconds. On timeout execution continues even if the condition is still false, so check the condition again if that distinction matters. The predicate must be synchronous.

**Button events** use **when condition becomes true** with the **button pressed?** Boolean block (`button.pressed(...) > 0`). It waits for release at startup, then waits for a press, awaits its handler, waits for release, and repeats. A held button produces one invocation. Left/right listeners and multiple listeners for one button have independent tasks. There is no extra debounce or raw interrupt behavior. Quick presses during a handler can be missed, and blocking code delays every task. Awaiting inside a handler allows other tasks to progress; it does not allow that same handler to overlap with itself.

## Units and behavior

- Ports **A–F** are LEGO ports, not GPIO numbers. Connect the matching motor or sensor to the selected port.
- Motor speed is **degrees per second**, not power percent. Supported speed depends on the motor. Timed/degree moves wait for completion; continuous run returns immediately and continues until stopped or changed.
- Motor stopping modes are native **BRAKE**, **COAST**, and **HOLD**. These are different behaviors; choose deliberately. Degree-based paired movement uses the native default braking mode.
- Pair distinct left/right ports before using a motor pair. Pair IDs 1–3 correspond to native `PAIR_1`–`PAIR_3`. Steering is **-100–100**, with 0 straight. Movement degrees describe motor rotation, not distance traveled.
- Text brightness is **0–100%**; character time is milliseconds. Matrix pixel coordinates are **0–4**, brightness **0–100%**.
- Button readings are **held milliseconds**, with 0 when released. Compare with 0 for a condition. Reading is polling, not an event or debounced callback.
- Native orientation readings use **0.1°**: 900 means 90°. The axes are yaw, pitch and roll.
- Distance is in **millimeters**. **-1** indicates no valid measurement; check this before applying a distance threshold.
- Force uses **0.1 N**, ranging from 0–100: 25 means 2.5 N. Reflection is **0–100%**. Color readings remain native numeric codes; compare with the LEGO color constant block.
- Scroll text, timed/degree motor actions, paired degree movement, and runloop waits require an async function. Place them inside a **SPIKE runloop run** or event handler, inside the explicit runloop container (events directly inside it). Ordinary procedure blocks are synchronous; the editor rejects awaited actions inside them. The SPIKE runtime uses `runloop`; existing generic `asyncio` blocks should not be assumed available on this firmware.

Inputs are passed to the native APIs. Keep values within the documented ranges; firmware errors are not suppressed. Missing devices, canceled movement and stalled motors need application-specific handling. Awaited movement statement blocks wait for completion but do not expose the returned status code.

## API references and validation

API definitions and semantics were checked against the [LEGO SPIKE App Python help](https://spike.legoeducation.com/prime/help/lls-help-python) and its [English documentation data](https://spike.legoeducation.com/content/en-us/documents.json). The official [Python lessons](https://education.lego.com/en-us/lessons/spike-python-u3-sensor-control/spike-python-u3l1-start-sensing/) demonstrate these firmware APIs.

Automated checks cover both toolbox languages, Python compilation, async scope checks, and simulated call order, arguments and sensor values. These checks do not verify physical motors, sensors or hub firmware; physical-board validation is pending.
