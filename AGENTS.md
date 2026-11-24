# Development preferences

When redesigning a shared library, prefer the clearest context-aware public API over compatibility wrappers for old call shapes. Update dependent projects together when needed, and keep vendor-specific protocol details outside reusable transport/parsing packages. The user explicitly approved breaking old APIs in this situation.

# Block architecture

## API fidelity and UI organization are separate

- Verify the target firmware's real MicroPython modules, classes, methods, units, value ranges, and execution semantics before implementing a block. Prefer direct generated calls to those APIs.
- Organize the toolbox around coherent hardware capabilities and ease of use. Do not mechanically create one category per Python module, or infer implementation boundaries from category names.
- Pins includes digital I/O, pulls, edge detection, and ADC analog input. ADC belongs naturally with pins even though its implementation uses `machine.ADC`; keep its implementation separate from `machine.Pin` code.
- PWM is also a pin capability, but its richer controls warrant a separate PWM category. The existing explicitly requested buzzer and servo controls belong with PWM.
- Do not invent a native-looking API to hide composition. In particular, `machine.Pin` has no analog-write method: PWM output belongs to the PWM API, not a fabricated GPIO analog write. ADC in Pins is valid functional grouping; relabeling PWM as a native Pin write is not.

## Generic capabilities and board-specific APIs

- Generic blocks expose portable capabilities of the supported MicroPython APIs. Board groups expose board-specific peripherals, board pin mappings, and native board firmware APIs; do not duplicate generic capabilities solely because a board can use them.
- Microbit's `microbit.pinN.write_analog()` is a real native firmware API and may be exposed in its board group. It does not imply support for `machine.Pin`, `machine.Pin.irq`, or `machine.PWM`.
- Distinguish board labels such as P0 from chip GPIO numbers. A pin-number conversion does not make incompatible firmware APIs interchangeable. State the intended firmware and board mapping clearly.

## Native primitives and composed components

- Preserve native primitives with their actual semantics. For example, a raw GPIO edge interrupt has no implicit debounce; label and document it accordingly.
- Add higher-level components for common workflows when explicitly requested or agreed with the user. Give them explicit semantic names, such as GPIO Button, rather than making them appear to be native methods of `machine.Pin`.
- Keep reusable component logic, such as debounce state handling, separate from board pin mappings and hardware adapters. Reuse it across board-specific and generic components where appropriate.
- A component must make its meaningful configuration and behavior clear: for a button, this includes the pin, active level, pull configuration, debounce interval, and whether it emits a press event or reports a stable state.
- Make the event execution model explicit: raw IRQ, polling, or scheduled callbacks have different timing and callback restrictions. Do not promise raw-interrupt semantics for a polled component, or add blocking delays to an IRQ handler as a debounce shortcut.
- Do not add wrappers merely because a feature can be implemented. Runtime helpers should serve an agreed component or necessary behavior, with a clear responsibility and API. Do not silently expand scope while answering a design question.

## Validation

- Test generated API calls and meaningful behavior, not just toolbox presence. For debounce, cover bouncing transitions, one event per press, release and re-press, startup state, and independent button instances.
- Distinguish build/code-generation checks, simulated runtime checks, and physical-board verification when reporting results. Do not claim a hardware behavior was tested unless it was observed.

# Source organization

- Keep `src/main.js` as the editor entry point. Register blocks in `src/blocks/index.js`; keep DOM behavior and toolbox presentation in `src/editor/`.
- Keep block definitions and their corresponding Python generators together by capability in `src/blocks/hardware/`, board APIs in `src/blocks/boards/`, and reusable block definitions in `src/blocks/shared/`.
- Put shared Python generation infrastructure (identifier allocation, validation errors, callback generation) in `src/python/`. Hardware blocks must not import other block modules just to access shared helpers.
- Keep device communication in `src/device/`, firmware installation in `src/firmware/`, project serialization/storage in `src/project/`, translations in `src/i18n/`, and styles in `src/styles/`.
- Preserve legal Unicode variable/function names across scripts and their original spelling. Repair invalid characters and invalid starts only as needed; use a readable fallback last. Protect keywords, generated/internal names, imports, and normalized-name collisions, keeping declarations and references consistent without changing saved names or IDs.

- When renaming or reorganizing APIs and blocks, update current call sites directly. Do not add compatibility wrappers or migrations for older projects unless explicitly requested.
