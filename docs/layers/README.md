# Layered Projection Model

Zeno exposes lower layers instead of hiding them. Use the lowest layer that fits
the job.

This is load-bearing architecture, not only documentation. New public features
must state which layer they belong to, which lower layer they depend on, and
which guarantees they do not provide.

```txt
Layer 0: Wire ABI / Layout IR
  -> Layer 1: Raw offsets
    -> Layer 2: Static scalar accessors
      -> Layer 3: Generated scan kernels
    -> Layer 4: Cursor projection views
      -> Layer 5: Dynamic tail views / writers
        -> Layer 6: Shared memory writer / publication

Layer 7: Layout ops / release gate
  -> observes Layer 0 facts
```

## Public Mental Model

The public README should show three groups, not every internal layer:

- scan layer: raw offsets, static accessors, generated scan kernels
- projection layer: cursor views, dynamic tail views, writers
- ops layer: manifest, inspect, diff, release gates

The detailed layer docs are for maintainers and advanced users who need exact
boundaries.

## Layer Table

| Layer | Name                                                      | Primary User                | Use When                                  |
| ----- | --------------------------------------------------------- | --------------------------- | ----------------------------------------- |
| 0     | [Wire ABI / Layout IR](00-wire-abi.md)                    | compiler, reviewers         | checking byte layout facts                |
| 1     | [Raw offsets](01-raw-offsets.md)                          | hot-loop authors            | writing direct `DataView` loops           |
| 2     | [Static scalar accessors](02-static-accessors.md)         | app code, generated bridges | named scalar reads/writes without cursors |
| 3     | [Generated scan kernels](03-scan-kernels.md)              | batch scan code             | aggregate scans over fixed scalar records |
| 4     | [Cursor projection views](04-cursor-views.md)             | ergonomic record code       | reading several fields from one record    |
| 5     | [Dynamic tail views / writers](05-dynamic-tail.md)        | payload code                | text, bytes, vectors, and dynamic writers |
| 6     | [Shared memory writer / publication](06-shared-memory.md) | worker pipelines            | explicit SAB publication protocols        |
| 7     | [Layout ops / release gate](07-layout-ops.md)             | CI, release review          | manifest, inspect, diff, migration review |

## Dependency Rule

Each layer may depend on lower layers. A lower layer must not import behavior
from a higher layer.

Examples:

- scan kernels may use static scalar access mechanics and raw offsets
- cursor views may expose dynamic tail views
- layout ops may inspect Layer 0 layout facts
- the shared-memory control block must not change the Zeno wire ABI

## Renderer Boundary

Renderer examples are witnesses that consume Zeno-friendly layouts. They are not
a hidden renderer layer inside Zeno core.

Zeno's target is renderer-facing memory, not a renderer framework. Core packages
must not import Three.js, Babylon.js, WebGL wrappers, WebGPU helper libraries, or
engine-specific APIs. The compiler may generate typed-array projection and pack
kernels; the renderer layer decides how those typed arrays are uploaded.

Current boundaries:

- `examples/webgl-instance-streamer` demonstrates Zeno vector projection with
  `ScalarVectorView.nativeArray()`
- `examples/webgl-raw-double-buffer` demonstrates a renderer-owned
  `SharedArrayBuffer -> worker -> Float32Array -> gl.bufferSubData` protocol

`gl.bufferSubData` still copies CPU memory into a GPU buffer. Zeno can reduce JS
object materialization and expose typed views, but it does not make renderer
upload itself zero-copy.

## Change Rule

Before adding public API:

1. pick the layer
2. update that layer document
3. update `tests/layer-model.test.ts` when the layer surface changes
4. keep benchmark claims scoped to the layer where they were measured

Do not grow `packages/compiler/src/emitter.ts` with new feature emission. Add or
extend a layer-specific emitter file and keep `emitter.ts` as assembly only.
