# Python language and built-ins

References: [Language reference](https://docs.python.org/3/reference/), [built-in functions](https://docs.python.org/3/library/functions.html), [standard types](https://docs.python.org/3/library/stdtypes.html), [MicroPython language differences](https://docs.micropython.org/en/latest/genrst/index.html).

| Area | Wrapped | Candidate / boundary |
| --- | --- | --- |
| Logic and control flow | Blockly if/else, comparisons, Boolean logic, conditional expression, while/repeat/for/for-each, break/continue; native in/not in/is/is not | Comprehensions, match/case (runtime-dependent) |
| Numbers | Arithmetic, modulo, floor division, shifts, bitwise &, pipe, XOR, complement; common built-ins | Complex numbers, multi-argument forms via generic calls |
| Text | Literals, join, length, case, trim, print, input, UTF-8 encode/decode | split/join/format and other methods via generic calls |
| Lists | Blockly list creation; native index/slice, append, extend, insert, remove, pop, clear, sort, reverse | count/index/copy through generic calls |
| Tuples and sets | tuple()/set() conversion; set add/discard/remove/pop/clear, union/intersection/difference/symmetric_difference | Native tuple/set literal syntax, unpacking |
| Dictionaries | Native literal with key/value entries; get, keys/values/items, update, index assignment/deletion, membership | setdefault/popitem via generic calls |
| Built-ins | list/tuple/dict/set/bytes/bytearray/int/float/str/bool, len, range, sum/min/max/abs/round, hex/bin/oct/ord/chr, all/any, sorted/reversed/enumerate | Variadic and keyword forms via generic calls |
| Objects and modules | import/from import, name/member access, member assignment/deletion, positional/keyword calls, evaluate expression | Class definitions, inheritance, decorators, lambda, starred arguments |
| Functions | Blockly parameters and return values, conditional return, explicit sync/async definitions and calls | Defaults, keyword-only/variadic parameters, closures, general early return |
| Exceptions | try/except/finally, raise, re-raise, exception text | Additional native exception types via generic Python |
| Files and contexts | open, read/readline, write, seek/tell, flush/close, generic with-as | Filesystem directory operations, context managers without as, async with |
| Async | Generic await statement/value, asyncio scheduling/task/cancel/sleep/return, SPIKE runloop | Runtime-specific task availability; no implicit await |

## Semantics

Native sequence indexing is zero-based; negative indices count from the end. Slice stop is exclusive, and omitted bounds are preserved. Dictionary keys are used unchanged. Python errors are not hidden. Tuple/set construction uses the native constructors, optionally from a list; empty input produces a zero-argument constructor call. The collection methods are ordinary native method calls; not every method exists on every type. A dictionary pop needs a key, while list pop can omit its index. Python values are not converted to JavaScript objects.

File methods use the Python API on the device, not the browser's device-file transfer panel. The file read/write/seek blocks are expressions; use the generic evaluate block to discard their returned value. The with-as block generates a native context manager and lets the runtime close resources on exit. The bound variable uses Blockly's normal variable identity. File modes, filesystem availability, context managers and built-in functions vary by firmware; w truncates existing files. Do not assume CPython compatibility on SPIKE or micro:bit.

The new data/file regression tests execute generated code with CPython, checking dictionary and sequence semantics, bitwise grouping, conversion, attribute access and file closure. This is not a hardware runtime test. Class definitions and advanced function signatures are deferred until their scope/name semantics are designed.
