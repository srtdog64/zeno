# Layer 3 - Generated Scan Kernels

## Purpose

Turn repeated scalar scans into generated monomorphic loops.

## Public API

```ts
UserView.sumAge(view, count);
UserView.minAge(view, count);
UserView.maxAge(view, count);
UserView.countAgeWhereEq(view, count, 37);
UserView.findFirstAgeWhereEq(view, count, 37);
```

`zeno-codegen` controls this layer with:

```sh
--scan-kernels=none|sum|basic|full
```

## Guarantees

- validates scan count and scan range once before looping
- avoids per-record cursor allocation
- avoids callback dispatch in the hot loop

## Non-Guarantees

- no floating-point equality predicates
- no bigint aggregate semantics
- no dynamic string/vector scan promotion without separate witness data
- no zero-copy WebGL upload from array-of-struct records

## When To Use

Use this layer for aggregate scans over fixed-layout scalar records.

## Routing To `@exornea/zeno-buffers`

Layer 3 is the schema-aware scalar table-scan layer. Generated methods such as
`sum<Field>()`, `count<Field>WhereEq(...)`, and
`findFirst<Field>WhereEq(...)` answer scalar questions and return numbers or
indexes.

`@exornea/zeno-buffers` is the generic pack/histogram layer. Use it when the
consumer needs a caller-owned typed-array output:

- renderer queues
- draw command words
- interleaved or grouped attribute arrays
- small field histograms

Do not grow these as two independent scan-kernel APIs. Generated scan kernels
stay schema-aware and return scalar results; buffers helpers stay generic and
write typed arrays.

## Renderer-Facing Buffer Boundary

Generated scan kernels read array-of-struct records. Renderer-facing 3D/GPU
paths often want typed contiguous vectors such as `Float32Array` positions or
`Uint32Array` colors.

Prefer schema-level struct-of-arrays when GPU upload is the primary path:

```ts
interface GraphBuffers {
  positions: z.vector<z.f32>;
  colors: z.vector<z.u32>;
  sizes: z.vector<z.f32>;
}
```

Then project the vector with `ScalarVectorView.nativeArray()` when scalar kind,
alignment, and host endian make a native typed-array view safe, and pass that
typed array to the renderer layer.

The WebGL example includes this as the `Zeno vectors` mode:

```ts
interface GpuBuffers {
  positions: z.vector<z.f32>;
  colors: z.vector<z.f32>;
}

GpuBuffersView.write(view, { positions: Float32Array, colors: Float32Array });
new GpuBuffersView(view).positionsView().nativeArray();
```

This does not claim that arbitrary array-of-struct records are zero-copy GPU
uploads. It claims that Zeno can preserve a typed struct-of-arrays binary
payload and expose the native `Float32Array` view that renderer upload APIs
expect.

The raw renderer experiment lives in
`examples/webgl-raw-double-buffer`. It intentionally does not use Zeno-generated
views; it demonstrates the next layer down:

```txt
SharedArrayBuffer
-> worker writes GPU-ready interleaved Float32Array frames
-> atomic frame publication
-> gl.bufferSubData
-> raw WebGL2 instanced draw
```

Keep this separate from Zeno's core claim. It is a renderer/concurrency witness,
not a binary projection API.

For array-of-struct schemas, future generated pack kernels may copy selected
fields into renderer-friendly typed arrays, for example `packPositions3f(...)`
or `packFieldToTypedArray(...)`. That is batching, not zero-copy upload.

## Lower Layer Dependency

Layer 2 supplies field reads. Layer 1 supplies field offsets and record stride.

## Tests / Witness

- `tests/compiler/generated-e2e.test.ts`
- `packages/bench/index.mjs`
