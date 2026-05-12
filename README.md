# Zeno

[![npm compiler](https://img.shields.io/npm/v/@exornea/zeno-compiler?label=compiler)](https://www.npmjs.com/package/@exornea/zeno-compiler)
[![npm runtime](https://img.shields.io/npm/v/@exornea/zeno-runtime?label=runtime)](https://www.npmjs.com/package/@exornea/zeno-runtime)
[![license](https://img.shields.io/npm/l/@exornea/zeno-runtime)](LICENSE)

TypeScript-first binary buffer layout compiler for fixed-layout, buffer-heavy
apps.

Zeno is not a renderer and not a universal serialization format. It helps a
TypeScript app own the CPU-side binary layout before that data is scanned,
shared with workers, or packed into renderer-facing typed arrays.

```txt
.zeno.ts interface -> Layout IR -> generated DataView views -> scan/pack/use
```

## The Problem

Buffer-heavy TypeScript apps often fall between two bad choices.

JSON is easy to work with, but large datasets pay parse, allocation, and object
materialization costs before the app can scan or upload anything.

Manual typed-array code is fast, but layout knowledge fragments across files:

```ts
const stride = 20;
const x = data[index * stride + 0];
const y = data[index * stride + 1];
const color = data[index * stride + 16];
```

Once the layout grows, `stride`, offsets, shader attributes, packing loops, and
TypeScript types can drift.

## The Solution: Zeno

Zeno keeps the bytes visible while making the layout named, generated,
inspectable, and testable.

Key features:

- schema-only TypeScript interfaces, no `.proto` or `.fbs`
- generated `DataView` accessors and reusable cursor views
- fixed-layout scan kernels such as `sumAge`, `minAge`, and `countKindWhereEq`
- layout manifest, `zeno-inspect`, and `zeno-diff-layout`
- dynamic bytes/text/vector descriptors when needed
- dependency-free `@exornea/zeno-buffers` helpers for renderer-facing pack and
  histogram workloads
- optional `SharedArrayBuffer` writer/publication primitives for advanced worker
  pipelines

The important boundary:

> Zeno owns CPU-side binary layout. Renderers still own rendering.

## Quick Start

Install:

```sh
npm install @exornea/zeno-runtime @exornea/zeno-types
npm install -D @exornea/zeno-compiler
```

Write a schema:

```ts
// src/model.zeno.ts
import type { z } from "@exornea/zeno-types";

export interface Instance {
  id: z.u32;
  kind: z.u16;
  x: z.f32;
  y: z.f32;
  z: z.f32;
  scale: z.f32;
  visible: z.bool;
}
```

Generate a view:

```sh
zeno-codegen ./src/model.zeno.ts ./src/model.view.ts
```

Use the generated API:

```ts
import { InstanceView } from "./model.view.js";

const count = 100_000;
const buffer = new ArrayBuffer(InstanceView.byteLength * count);
const view = new DataView(buffer);

InstanceView.setXAt(view, 12.5, 0);
InstanceView.setVisibleAt(view, true, 0);

const x = InstanceView.getXAt(view, 0);
const visibleCount = InstanceView.countVisibleWhereEq(view, count, true);
```

For manual hot loops, validate the table once and then use the unchecked path:

```ts
InstanceView.assertRecordRange(view, count);

const cursor = InstanceView.at(view);
for (let index = 0; index < count; index += 1) {
  cursor.moveToUnchecked(index);
  // read cursor fields without per-record range checks
}
```

For larger schemas, split generated output by struct:

```sh
zeno-codegen ./src/model.zeno.ts ./src/model.view.ts --output=split
```

For layout review:

```sh
zeno-codegen ./src/model.zeno.ts ./src/model.view.ts --manifest ./src/model.layout.json
zeno-inspect ./src/model.zeno.ts
zeno-diff-layout ./old.layout.json ./new.layout.json
```

## Performance Witness

Current local Node witness:

```txt
direct DataView age loop   5.63 ns/record
UserView.sumAge            6.06 ns/record
pooled noise floor         2.48 ns/record
```

This is an engineering witness, not a universal performance guarantee. The
strong path is fixed-layout scalar scanning and renderer-facing buffer packing,
not arbitrary object serialization.

See [docs/human/performance-comparison.md](docs/human/performance-comparison.md) for the
full benchmark methodology, p95/p99/std reporting, retained-memory notes, and
FlatBuffers/JSON comparison witnesses.

## Core Architecture

Zeno is a layered projection system. Lower layers stay exposed instead of being
hidden behind one high-level serializer.

| Layer | Responsibility                                                                |
| ----- | ----------------------------------------------------------------------------- |
| 0     | [Wire ABI / Layout IR](docs/reference/layers/00-wire-abi.md)                  |
| 1     | [Raw offsets and constants](docs/reference/layers/01-raw-offsets.md)          |
| 2     | [Static scalar accessors](docs/reference/layers/02-static-accessors.md)       |
| 3     | [Generated scan kernels](docs/reference/layers/03-scan-kernels.md)            |
| 4     | [Cursor projection views](docs/reference/layers/04-cursor-views.md)           |
| 5     | [Dynamic text/bytes/vector tail](docs/reference/layers/05-dynamic-tail.md)    |
| 6     | [Shared-memory writer/publication](docs/reference/layers/06-shared-memory.md) |
| 7     | [Manifest / inspect / diff tooling](docs/reference/layers/07-layout-ops.md)   |

Use the lowest layer that fits the job:

- raw offsets for hand-written `DataView` loops
- static accessors and scan kernels for hot scalar scans
- cursor views for ergonomic per-record access
- `@exornea/zeno-buffers` when the next layer needs caller-owned typed-array
  outputs

For dynamic text, prefer explicit byte predicates before decoding:

```ts
import { includesAscii, spanStartsWithAscii, startsWithAscii } from "@exornea/zeno-runtime";

const bytes = asset.nameView().bytes();
const isDebug = startsWithAscii(bytes, "debug_") || includesAscii(bytes, "_test");

// Lower-level descriptor path: avoids constructing a span view and Uint8Array.
const isDebugSpan = spanStartsWithAscii(view, AssetView.nameOffset, "debug_");
```

The buffers package is a pack/histogram layer, not a second generated scan API.
For repeated frame loops, the plan API is the primary generic buffer hot path:
create a validated plan once, allocate enough output capacity up front, then
reuse it. The `pack*Fields...` helpers are convenience wrappers that recreate
plans. A renderer-specific fused loop can still beat the generic plan when it
combines several predicates in one pass; use the plan API when you want a
reusable, checked buffer boundary instead of handwritten offset code.

```ts
import { createF32PackPlan, packF32PlanWhereU8Eq } from "@exornea/zeno-buffers";

const plan = createF32PackPlan(InstanceView.byteLength, [
  InstanceView.xOffset,
  InstanceView.yOffset,
  InstanceView.zOffset,
  InstanceView.scaleOffset,
]);

const packed = packF32PlanWhereU8Eq(view, count, InstanceView.visibleOffset, 1, plan, out);
```

## Decision Guide

Use Zeno when:

- one TypeScript codebase owns both writer and reader
- binary data is fixed-layout, read-mostly, or regenerated
- many records are scanned, filtered, packed, or uploaded
- manual offset/stride management is becoming fragile
- cross-language schema evolution is not required

Good fits:

- WebGL / Three.js / WebGPU instance metadata
- renderer queues, draw batches, sprite atlas rows, grid cells
- worker pipelines with caller-owned `ArrayBuffer` or `SharedArrayBuffer`
- telemetry-style fixed rows
- game/editor asset tables inside one TS-controlled app

Use something else when:

- the schema is a public or cross-language protocol
- old clients and new writers must coexist without coordinated deployment
- long-lived storage needs native schema evolution
- the data is arbitrary nested objects
- the binary input is security-critical and untrusted

FlatBuffers, protobuf, Cap'n Proto, MessagePack, JSON, or a database-native
schema may be better choices there.

## Documentation Map

Start here:

- [llms.txt](llms.txt): compact repository map for LLM-assisted reading
- [docs/human/README.md](docs/human/README.md): short human-facing product and
  fit guide
- [docs/llm/README.md](docs/llm/README.md): compact guardrails for AI-assisted
  repository work
- [docs/human/getting-started.md](docs/human/getting-started.md): longer walkthrough
- [docs/human/schema-grammar.md](docs/human/schema-grammar.md) /
  [docs/human/schema-grammar.ko.md](docs/human/schema-grammar.ko.md): supported schema
  syntax
- [docs/reference/layers/README.md](docs/reference/layers/README.md): full layered projection model
- [docs/reference/abi.md](docs/reference/abi.md): scalar, `Span32`, `Vector32`, `pointer32`, and
  optional frame ABI
- [docs/reference/api-design.md](docs/reference/api-design.md): generated API and scan kernels
- [docs/reference/runtime-boundary.md](docs/reference/runtime-boundary.md): hot-path error policy
- [docs/human/schema-compatibility.md](docs/human/schema-compatibility.md): explicit
  versioning instead of automatic schema evolution
- [docs/human/renderer-buffer-case-studies.md](docs/human/renderer-buffer-case-studies.md):
  public WebGL/renderer repository evidence
- [docs/reference/release-checklist.md](docs/reference/release-checklist.md): release gate

Examples:

- [examples/scalar-only](examples/scalar-only): smallest fixed-layout scan model
- [examples/webgl-instance-streamer](examples/webgl-instance-streamer): Three.js
  instance upload witness
- [examples/webgl-raw-double-buffer](examples/webgl-raw-double-buffer):
  raw WebGL2 `SharedArrayBuffer` double-buffering witness
- [examples/renderer-grid-buffer](examples/renderer-grid-buffer): dependency-free
  grid/entity buffer shape
- [examples/renderer-draw-batch-buffer](examples/renderer-draw-batch-buffer):
  draw command packing

Repository commands:

```sh
npm run build
npm test
npm run bench
npm run release:check
```
