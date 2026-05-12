# Zeno For Humans

Zeno is a TypeScript-first binary buffer layout compiler.

Use it when a TypeScript app owns a lot of binary data and manual offsets are
starting to spread across files.

## The Problem

JSON is easy, but large fixed-record datasets pay parse and object allocation
costs.

Manual typed arrays are fast, but this kind of code gets fragile:

```ts
const stride = 20;
const x = data[index * stride + 0];
const y = data[index * stride + 1];
const color = data[index * stride + 16];
```

Field offsets, stride, shader attributes, and packing code can drift.

## What Zeno Does

You write a schema-only TypeScript interface:

```ts
export interface Instance {
  x: z.f32;
  y: z.f32;
  z: z.f32;
  visible: z.bool;
}
```

Zeno generates named `DataView` accessors, scan kernels, and layout tools.

```ts
InstanceView.getXAt(view, index);
InstanceView.countVisibleWhereEq(view, count, true);
```

## Best Fit

Good fits:

- WebGL, Three.js, WebGPU, or Electron apps
- instance metadata, sprite rows, draw batches, grid cells
- worker pipelines where both sides are TypeScript
- fixed-layout scan and pack workloads

Poor fits:

- cross-language protocols
- public API contracts
- long-lived storage with automatic schema evolution
- arbitrary nested object serialization
- security-critical parsing of hostile binary input

## Mental Model

Zeno is not a renderer.

It owns CPU-side binary layout before a renderer, worker, or typed-array packer
uses the data.

```txt
schema -> layout -> generated view -> scan/pack/use
```

Use the lowest layer that fits:

- generated constants for direct `DataView` loops
- static accessors for named scalar reads
- scan kernels for aggregate hot loops
- cursor views for ergonomic per-record access
- `@exornea/zeno-buffers` for typed-array packing

## Start Here

- [Getting Started](getting-started.md)
- [Schema Grammar](schema-grammar.md)
- [Layered Model](../reference/layers/README.md)
- [Renderer Buffer Case Studies](renderer-buffer-case-studies.md)
- [Performance Witness](performance-comparison.md)
