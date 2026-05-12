# 2.3.0 Release Notes

Status: layered projection model release.

## Load-Bearing Changes

| Property                 | Status       | Reason                                                                                   |
| ------------------------ | ------------ | ---------------------------------------------------------------------------------------- |
| Layered Projection Model | load-bearing | Zeno's public surface is intentionally layered instead of hiding lower byte APIs.        |
| Emitter layer split      | load-bearing | Writer, static accessor, and cursor/projection emitters now map to separate layers.      |
| Emitter growth boundary  | load-bearing | Future generated-code features must live in layer emitters; `emitter.ts` only assembles. |
| Layer consistency test   | load-bearing | Docs and public API surfaces are checked together so the layer model does not drift.     |
| Bench release gate       | load-bearing | Publish checks now execute fixed, dynamic, and FlatBuffers comparison benchmarks.        |
| README layer entrypoint  | diagnostic   | Users see three ideas quickly: lowest fitting layer, scan path, ops path.                |

## Layer Model

Zeno now documents eight projection layers:

```txt
Layer 0. Wire ABI / Layout IR
Layer 1. Raw DataView constants
Layer 2. Static scalar accessors
Layer 3. Generated scan kernels
Layer 4. Cursor projection views
Layer 5. Dynamic tail views/writers
Layer 6. SharedArrayBuffer writer/publication
Layer 7. Manifest / inspect / diff / release gate
```

The core rule is:

```txt
Zeno exposes lower layers instead of hiding them.
Use the lowest layer that fits the job.
```

## Compiler Structure

`emitter.ts` is now a file/class assembly layer. It delegates to:

- `emitter-static-accessors.ts`
- `emitter-scan-kernels.ts`
- `emitter-fields.ts`
- `emitter-writers.ts`

This keeps scan, cursor, dynamic, and writer concerns aligned with the docs.

The maintenance rule after 2.3 is strict: do not grow `emitter.ts` with new
feature emission. New generated-code behavior should extend a layer-specific
emitter module, and `emitter.ts` should remain the file/import/class assembly
boundary.

## Release Gate

`release:check` now runs `bench:check` after package and packed-consumer
verification. `bench:check` executes:

- `bench`
- `bench:dynamic`
- `bench:flatbuffers`

The benchmark gate verifies that all benchmark workloads still execute under
the packaged 2.3 surface. It does not assert exact timing thresholds because
CI hardware noise would make those thresholds unstable.

## Non-Goals

- No new ABI primitive.
- No optional/vtable schema evolution.
- No full `ts.factory` class emitter migration in this release.
