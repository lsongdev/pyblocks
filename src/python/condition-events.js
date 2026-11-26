// Shared edge state; no board adapters or implicit hardware updates.
export const conditionEventRuntime = `def _condition_sample(state, current, stable_ms):
    current = bool(current)
    now = _condition_time.ticks_ms()
    if not state:
        state.extend((current, current, now))
        return False
    if current != state[1]:
        state[1] = current
        state[2] = now
    if state[1] != state[0] and _condition_time.ticks_diff(now, state[2]) >= stable_ms:
        state[0] = state[1]
        return state[0]
    return False
`;

export const asyncConditionRuntime = `async def _watch_condition(read, delay, handler, interval_ms):
    state = []
    while True:
        if _condition_sample(state, read(), delay):
            await handler()
        await _asyncio.sleep_ms(interval_ms)

async def _condition_main(main=None):
    tasks = [_watch_condition(read, delay, handler, _condition_interval) for read, delay, handler in _condition_specs]
    if main is not None:
        tasks.insert(0, main)
    await _asyncio.gather(*tasks)
`;
