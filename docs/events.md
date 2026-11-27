# Condition events

The **Events** category provides two blocks with different execution models. Choose explicitly; there is no event runner container, board detection or project scheduling setting. SPIKE keeps its own runloop blocks.

| Block | Behavior | Use |
| --- | --- | --- |
| **when condition … is met, execute** | Checks once when reached, remembering previous state | Put inside your own loop; portable to standard micro:bit firmware |
| **when condition … is met, execute asynchronously** | Independent asyncio polling task | Standalone listener for firmware with asyncio, such as the project's ESP32/UIFlow2 builds |

The async block does not install asyncio or check the board model. Selecting compatible firmware is the user's responsibility.

## Synchronous: share your own loop

The synchronous block has normal previous/next connections. Each execution evaluates the condition exactly once, updates its own edge/debounce state, optionally executes the body, and returns control. It adds no loop, delay, scheduler or hardware update.

```text
M5Stack initialize
repeat forever
    M5Stack update
    read sensor data
    when condition [M5Stack button A isPressed] is met, execute
        print "A pressed"
    wait 50 ms
```

This lets sensor reads, display work, explicit updates and several conditions share one loop. You control how often checks run. Put one-time initialization before the loop. A check placed outside any loop runs only once; its first evaluation records the initial state and does not trigger.

Examples:

- [Micro:bit button in a polling loop](../examples/microbit-condition-events.blockly.json)
- [M5Stick-C sensor reads plus a synchronous button check](../examples/m5-sync-sensors.blockly.json)

Each block has separate state that persists for the lifetime of the program, including repeated calls to a procedure containing that block. The first sample occurs when execution first reaches the block, not before hardware initialization. Conditions and actions are generated inline, so procedure parameters and normal loop/control-flow scope remain available. The body is synchronous; awaited operations are rejected.

Checks are evaluated in normal program order. An earlier handler can therefore affect a later condition. Slow handlers delay the next check, just like any other synchronous statement.

## Asynchronous: independent listeners

Place the async block independently at the top level. Generated code defines handlers, runs ordinary setup, then automatically starts the asyncio listeners. No extra run block is required when listeners alone suffice.

For M5Stack, hardware updates still belong to the user's program. For example:

```text
M5Stack initialize
asyncio run
    repeat forever
        M5Stack update
        async wait 10 ms

when condition [M5Stack button A isPressed] is met, execute asynchronously
    print "A pressed"
```

The single explicit asyncio entry and async listeners share one asyncio loop. Put setup before that entry. Use at most one explicit entry with async condition events; additional tasks can be created inside it. Without async condition events, existing asyncio run blocks retain their behavior.

### Put your main loop inside the asyncio entry, and only await inside it

This is the most common reason an async event never fires. The listeners are only started by the automatically appended `asyncio run (…)`, which runs **after** all top-level code. Two rules:

1. **Your main loop must live inside `asyncio run`, not at the top level.** A top-level `repeat forever` never returns, so the appended entry is never reached and no listener is ever started. Place the loop (including `M5Stack update`) inside the `asyncio run` block so it becomes a concurrent task gathered alongside the listeners.
2. **Inside that loop, yield with `async wait`, never a blocking `wait`.** asyncio is cooperative: a task only yields at an `await`. A `repeat forever` that uses the ordinary **wait N ms** (`time.sleep_ms`) — or any other blocking call — holds the single loop forever, so the listener task never gets to poll, even though it was started. Use **async wait** so control returns to the scheduler between updates.

Wrong — the loop blocks and the button is never seen:

```text
M5Stack initialize
repeat forever            # top level: appended asyncio run is unreachable
    M5Stack update
    wait 100 ms           # blocking sleep: would also starve listeners

when condition [M5Stack button A isPressed] is met, execute asynchronously
    print "A pressed"
```

Right — the loop is a task and yields each iteration:

```text
M5Stack initialize
asyncio run
    repeat forever
        M5Stack update
        async wait 10 ms

when condition [M5Stack button A isPressed] is met, execute asynchronously
    print "A pressed"
```

Rule of thumb: **async events → main loop inside `asyncio run` with `async wait`; synchronous events → check inside your ordinary top-level loop with a normal `wait`.** The synchronous block exists precisely for the latter case and needs no asyncio at all.

- [Matrix:bit async button with 25 ms debounce](../examples/matrixbit-condition-events.blockly.json)
- [M5Stack async button with explicit updates](../examples/m5-condition-events.blockly.json)

Each listener polls every **10 ms while idle**. An awaited handler lets other tasks proceed. While its handler is active, that listener does not poll or invoke itself again; brief changes during it may be missed. Blocking code still blocks the entire asyncio loop.

Synchronous checks may also be used inside a user-controlled async task's loop; they do not create another scheduler. Only the async event block is restricted to the top level.

## Shared trigger and debounce rules

- Conditions are re-evaluated, not captured as Boolean snapshots.
- A false-to-true transition triggers once. Holding true does not repeat it.
- An initially true condition must become stably false before it can trigger.
- **Stable time** is explicit debounce in milliseconds, applied to both transitions. **0** adds none. **25 ms** retains the former Matrix:bit event debounce setting; it is not a native GPIO feature.
- State is independent for each block, even when blocks read the same input.
- There are no hardware interrupts or implicit hardware updates. Errors are not silently swallowed.
- Short changes between checks may be missed. For synchronous checks, your loop determines the sampling interval. In both modes, update and handler execution affect timing.

The edge detector uses `utime.ticks_ms()` and `ticks_diff()` for wrap-safe debounce. It does not read hardware before its first actual check.

Use current-state readers (`is_pressed()`, `isPressed()`, touch comparisons), not readers that consume event history, such as micro:bit `was_pressed()`, when independent checks must observe the same state.

The specialized Micro:bit/Matrix:bit button and touch events have been replaced; native state readers remain. Matrix:bit exposes an A/B button block in Pins, while its PYTHON touch keys use generic TouchPad blocks through the pin mapping. Older saved event and board-specific touch/button blocks are not automatically migrated.

## Validation

Automated checks cover bounce, held states, release/re-press, initial true state, tick wrap, independent states, sensor sampling and explicit updates in the same user loop, procedure parameters, first-sample timing, callback globals and both languages. Async simulations verify other listeners can progress during an awaited handler, with and without an explicit asyncio entry. The shared condition events have not yet been verified on physical boards.
