# 2.1.0 Release Notes

Status: browser/runtime/compiler observability minor release.

## Load-Bearing Changes

| Property                              | Status       | Reason                                                                                           |
| ------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| Statement-level source maps           | load-bearing | Source maps now map generated class, interface, const, and member declarations through TS AST.   |
| Browser benchmark smoke metrics       | load-bearing | Browser smoke now records per-mode payload/build/parse/pack/upload numbers, not just UI status.  |
| WebGL visual regression state         | load-bearing | The demo exposes frame, canvas, mesh, and pixel-sample state so CI can reject blank renders.     |
| Text byte predicate helpers           | load-bearing | `bytesEqual`, `equalsAscii`, and `startsWithAscii` keep text predicates decode-free.             |
| Scalar vector native array projection | candidate    | `ScalarVectorView.nativeArray()` is a zero-copy fast path when endian and alignment are native.  |
| Synthetic AST emitter utility         | diagnostic   | `emitSyntheticSource(...)` exists for emitter migration experiments, but default output is kept. |

## API Additions

Runtime root exports now include:

```ts
bytesEqual(bytes, expected);
equalsAscii(bytes, "OK");
startsWithAscii(bytes, "ERR:");
```

Scalar vectors now expose a native typed-array projection when the backing ABI
matches the host:

```ts
const scores = view.scoresView();
const array = scores.nativeArray(); // Float32Array for z.vector<z.f32>
```

`nativeArray()` rejects `bool`, host-endian mismatches, and misaligned payloads
with `RangeError`. It is a fast-path projection, not a schema evolution or
serialization feature.

## Compiler

Generated source maps now derive mapping points from the generated TypeScript
AST instead of substring matching lines. The current emitter still keeps the
tagged-template output formatting because it is stable and readable. A full
factory-built class emitter remains future work; activating the TypeScript
printer for the whole generated file changed formatting too aggressively for a
minor release.

## Browser Witness

The WebGL smoke script now emits a structured `browser_benchmark` event with
per-mode metrics for Zeno, FlatBuffers, and JSON. It also checks a 4x4 WebGL
pixel sample exposed by the demo so a blank canvas is no longer accepted as a
passing smoke run.

## Non-Goals

- No sparse optional fields or vtable-style schema evolution.
- No full `ts.factory` class emitter activation yet.
- No `SharedArrayBuffer` high-contention backoff path; sharded arenas remain
  the supported contention strategy.
