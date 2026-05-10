# Zeno

TypeScript-only zero-copy binary projection compiler without IDL overhead.

Zeno turns schema-only TypeScript interfaces into generated `DataView` view
classes. It is for TS-only systems that want FlatBuffers-like binary projection
without maintaining a separate `.fbs`/IDL file or cross-language codegen flow.

```txt
.zeno.ts interfaces -> Layout IR -> generated DataView views
```

## Best Fit

Zeno is strongest when one TypeScript codebase owns both the writer and reader
and needs to scan many fixed-layout records without materializing objects.

Use it when:

- producer and consumer ship together
- records are scanned in large batches
- JSON object materialization is the bottleneck
- named `DataView` offsets are needed
- cross-language schema evolution is not required

Good fits:

- WebGL/WebGPU instance data and browser-side binary assets
- game/editor asset tables such as item stats, tiles, skills, nodes, and edges
- telemetry or analytics rows with a stable fixed schema
- worker/shared-memory pipelines where JSON serialization is the bottleneck

Poor fits:

- cross-language protocols
- public network contracts
- long-lived storage formats that require schema evolution
- arbitrary nested object serialization
- security-critical untrusted binary parsing

## Why

Use Zeno when:

- TypeScript is already your schema language.
- You want compact binary records in `ArrayBuffer`.
- You want named generated accessors instead of handwritten byte offsets.
- You need fast read-mostly indexes, graph metadata, telemetry rows, or browser
  side binary assets.
- You want browser workers to read `SharedArrayBuffer`-backed arena data without
  JSON serialization or object materialization.
- Cross-language codegen is not required.

Do not use Zeno when the schema is a cross-language contract. FlatBuffers,
Cap'n Proto, protobuf, or MessagePack are better fits there.

## Zeno vs Other Formats

| Need                                  | Zeno | Better fit                                                |
| ------------------------------------- | ---- | --------------------------------------------------------- |
| TS-only fixed-layout hot scans        | yes  | handwritten `DataView` when schema codegen is unnecessary |
| WebGL/game/worker binary projection   | yes  | custom typed arrays for very small schemas                |
| Cross-language protocol               | no   | FlatBuffers, Cap'n Proto, protobuf                        |
| Public API contract                   | no   | OpenAPI, protobuf, JSON Schema                            |
| Schema evolution-heavy storage        | no   | protobuf, FlatBuffers tables, custom versioned format     |
| Arbitrary nested object serialization | no   | MessagePack, CBOR, JSON                                   |

## Why Zeno Does Not Hide Schema Evolution

Zeno schemas are expected to change. Zeno does not pretend those changes are
automatically compatible.

In this project, "schema evolution" means more than editing a schema. It means
old readers and new writers, or new readers and old stored bytes, must coexist
without coordinated deployment. That requirement is real for public protocols,
customer-controlled clients, long-lived files, and cross-team storage contracts.
It is not free: it usually needs field ids, vtables, defaults, compatibility
matrices, and an extra indirection on reads.

Zeno chooses the opposite tradeoff for controlled TypeScript systems:

- producer and consumer usually ship together,
- binary data is often transient, cached, or regenerated,
- layout changes are explicit breaking wire-format changes,
- version routing belongs in the application envelope when old and new layouts
  must coexist.

That keeps the hot path simple: generated accessors project fixed offsets out of
a known layout. If your system cannot coordinate reader and writer upgrades, or
if old binary data must remain readable for years, use a format with native
schema evolution such as FlatBuffers tables or protobuf.

See [docs/schema-compatibility.md](docs/schema-compatibility.md) for the exact
v2 compatibility rule and the explicit `UserV1` / `UserV2` versioning pattern.

## Install

```sh
npm install @exornea/zeno-runtime @exornea/zeno-types
npm install -D @exornea/zeno-compiler
```

The compiler package provides the `zeno-codegen` CLI.

## Quick Example

Write a schema-only TypeScript file:

```ts
// src/model.zeno.ts
import type { z } from "@exornea/zeno-types";

export interface User {
  id: z.u64;
  age: z.i32;
  score: z.f64;
  ratio: z.f32;
  handle: z.fixedUtf8<32>;
  name: z.utf8;
  tags: z.vector<z.utf8>;
  avatar: z.bytes;
}
```

Generate a view:

```sh
zeno-codegen ./src/model.zeno.ts ./src/model.view.ts
```

Use `--source-map` when you want generated accessors to map back to the
originating `.zeno.ts` field during debugging.

`SharedArrayBuffer` support is exposed through `SharedDynamicLayoutWriter`. Its
tail cursor is atomic, and descriptor publication uses explicit `Int32Array`
ready cells through the `*Published(...)` writer methods. Browser apps still
need cross-origin isolation headers before `SharedArrayBuffer` is available.
For higher-contention worker pipelines, use `fromSharedShard(...)` so each
worker owns a payload range and cursor cell instead of spinning on one shared
cursor.

Use the generated API:

```ts
import { UserView } from "./model.view.js";

const buffer = new ArrayBuffer(1024);
const view = new DataView(buffer);

UserView.write(view, {
  id: 7n,
  age: 41,
  score: 98.5,
  ratio: 0.75,
  handle: "makonea",
  name: "Zeno",
  tags: ["ts", "binary"],
  avatar: new Uint8Array([1, 2, 3]),
});

const user = new UserView(view);

console.log(user.id);
console.log(user.age);
console.log(user.nameView().text());
console.log(user.tagsView().textArray());
```

For hot loops, use generated static accessors or scan kernels:

```ts
let sum = 0;
for (let index = 0; index < count; index += 1) {
  sum += UserView.getAgeAt(view, index);
}

const totalAge = UserView.sumAge(view, count);
```

`sum<Field>()`, `min<Field>()`, and `max<Field>()` kernels are emitted for
`number` scalar fields. `count<Field>WhereEq(...)` and
`findFirst<Field>WhereEq(...)` are emitted for integer and boolean scalar
fields. These kernels validate the record count and buffer range once, then run
a generated stride loop without per-record view allocation or callbacks.

Use `--scan-kernels=none|sum|basic|full` when generated file size matters:

- `none`: scalar accessors only
- `sum`: add `sum<Field>()`
- `basic`: add `sum<Field>()`, `min<Field>()`, and `max<Field>()`
- `full`: add all scan kernels, including equality predicates

## Fast Path Mental Model

Use Zeno like a generated `DataView` table scanner.

Prefer static accessors or scan kernels in hot loops:

```ts
let sum = 0;

for (let offset = 0; offset < byteLength; offset += UserView.byteLength) {
  sum += UserView.getAge(view, offset);
}
```

Avoid per-record allocation in hot loops:

```ts
const users = Array.from({ length: count }, (_, index) => {
  return new UserView(view, index * UserView.byteLength);
});
```

Cursor views are ergonomic and reusable when one record needs several fields:

```ts
const user = UserView.at(view);

for (let index = 0; index < count; index += 1) {
  user.moveToUnchecked(index);
  sum += user.age;
}
```

Dynamic text is an explicit decode boundary:

```ts
const bytes = user.nameView().bytes();
const text = user.nameView().text();
```

## Layout Inspection

Generate a machine-readable layout manifest next to generated views:

```sh
zeno-codegen ./src/model.zeno.ts ./src/model.view.ts --manifest ./src/model.layout.json
```

Inspect a schema from the CLI:

```sh
zeno-inspect ./src/model.zeno.ts
```

Compare two manifests in CI or migration review:

```sh
zeno-diff-layout ./old.layout.json ./new.layout.json
```

Layout diffs do not make incompatible layouts magically compatible. They make
the breaking wire-format change explicit so the application can route by
version when old and new layouts must coexist.

`layoutHash` is a deterministic compatibility fingerprint, not a cryptographic
hash. Do not use it as an integrity check for untrusted payloads; use an
application-level digest or signature when integrity matters.

## WebGL Demo

The repository includes a browser demo that compares Zeno binary buffers,
FlatBuffers JS, and JSON objects for instance-data upload:

```sh
npm run example:webgl:build
npm run browser:smoke
```

The demo is intentionally narrow: it represents the kind of fixed-stride,
read-mostly browser workload where Zeno's projection-first model is meant to
earn its keep.

For the smallest hot-path example, see
[examples/scalar-only](examples/scalar-only). It contains only fixed scalar
fields and generated scan kernels.

## Supported Schema Surface

| Type                                                                    | ABI shape                   | Status                                                                |
| ----------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| `z.i8`, `z.u8`, `z.i16`, `z.u16`, `z.i32`, `z.u32`                      | scalar                      | stable                                                                |
| `z.i64`, `z.u64`                                                        | bigint scalar               | stable                                                                |
| `z.f32`, `z.f64`, `z.bool`                                              | scalar                      | stable                                                                |
| `z.enumU8<T>`, `z.enumU16<T>`, `z.flags8`, `z.flags32`, `z.timestampMs` | semantic scalar aliases     | stable                                                                |
| `z.fixedUtf8<N>`, `z.fixedAscii<N>`, `z.fixedBytes<N>`                  | inline fixed region         | stable                                                                |
| `z.fixedArray<T, N>`                                                    | inline fixed array          | stable for scalar, fixed bytes/string, and fixed-size struct elements |
| `z.utf8`, `z.ascii`, `z.bytes`                                          | `Span32` descriptor         | stable                                                                |
| `z.vector<T>`                                                           | `Vector32` descriptor       | stable for supported elements                                         |
| `z.dynamicVector<T>`                                                    | `Vector32` offset table     | stable read/write codegen for dynamic struct elements                 |
| `z.pointer<T>`                                                          | signed relative `pointer32` | stable                                                                |
| bare `string`                                                           | UTF-8 `Span32` shorthand    | supported, but `z.utf8` is clearer                                    |

Unsupported by design in v2:

- bare `number`
- bare `T[]` / `any[]`
- direct recursive structs without `z.pointer<T>`
- unions without a discriminator policy
- optional/vtable-style schema evolution
- varint / LEB128 compressed integers

## Binary Frame

Raw Zeno records do not include a mandatory header. Generated views project over
a caller-owned `DataView` plus `baseOffset`.

Zeno 1.1 adds optional file/network boundary helpers:

- `writeZenoFrameHeader(...)`
- `readZenoFrameHeader(...)`
- `assertZenoFrameHeader(...)`
- `assertZenoFramePayload(...)`
- `zenoFramePayloadView(...)`
- `checkedZenoFramePayloadView(...)`

The optional frame carries magic bytes, version, payload endianness, layout hash,
payload offset, and payload byte length. It does not change the raw record ABI.

## Performance Witness

Current local Node benchmark:

```text
direct DataView age loop   5.63 ns/record
UserView.sumAge            6.06 ns/record
pooled noise floor         2.48 ns/record
```

This is an engineering witness, not a universal performance guarantee. See
[docs/performance-comparison.md](docs/performance-comparison.md) for the full
methodology, p95/p99/std reporting, retained-memory notes, and promotion
criteria.

## Packages

- `@exornea/zeno-types`: type-only ABI marker namespace for schema authors.
- `@exornea/zeno-schema`: Layout IR and ABI constants.
- `@exornea/zeno-runtime`: runtime views, descriptors, frame helpers, and writers.
- `@exornea/zeno-compiler`: analyzer, validator, emitter, and `zeno-codegen`.

## Repository Commands

```sh
npm run build
npm test
npm run bench
npm run release:check
```

`npm run release:check` is the release gate. It runs version/package policy
checks, cleans and builds the workspaces, runs tests, regenerates examples,
dry-runs package packing, and installs the packed tarballs into a fresh consumer
project.

The release gate also includes generated-code compile/run fuzzing, hostile
malformed-descriptor property tests, a frozen layout compatibility fixture,
SharedArrayBuffer worker stress, and packed consumer import-resolution checks.
CI adds a Playwright browser smoke matrix for the WebGL demo.

## Documentation

- [docs/getting-started.md](docs/getting-started.md): detailed walkthrough.
- [docs/schema-grammar.md](docs/schema-grammar.md) /
  [docs/schema-grammar.ko.md](docs/schema-grammar.ko.md): supported `.zeno.ts`
  grammar, examples, and rejected forms.
- [docs/abi.md](docs/abi.md): scalar, `Span32`, `Vector32`, `pointer32`, and
  optional frame ABI.
- [docs/api-design.md](docs/api-design.md): generated accessors, cursors,
  pointers, and scan kernels.
- [docs/schema-compatibility.md](docs/schema-compatibility.md): breaking-change
  policy for layout edits.
- [docs/release-v1.md](docs/release-v1.md): stable v1 surface.
- [docs/release-v1.1.md](docs/release-v1.1.md): optional frame and source-file
  analyzer additions.
- [docs/release-v1.8.md](docs/release-v1.8.md): shared-memory arena, source
  map, and WebGL demo additions.
- [docs/release-v2.0.md](docs/release-v2.0.md): projection-first string vector
  cleanup and retired optimizer removal.
- [docs/release-v2.2.md](docs/release-v2.2.md): scan kernel modes and layout
  tooling.
- [CHANGELOG.md](CHANGELOG.md): release history.
