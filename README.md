# Zeno

TypeScript-only zero-copy binary projection compiler.

Zeno turns schema-only TypeScript interfaces into generated `DataView` view
classes. It is for TS-only systems that want FlatBuffers-like binary projection
without maintaining a separate `.fbs`/IDL file.

```txt
.zeno.ts interfaces -> Layout IR -> generated DataView views
```

## Why

Use Zeno when:

- TypeScript is already your schema language.
- You want compact binary records in `ArrayBuffer`.
- You want named generated accessors instead of handwritten byte offsets.
- You need fast read-mostly indexes, graph metadata, telemetry rows, or browser
  side binary assets.
- Cross-language codegen is not required.

Do not use Zeno when the schema is a cross-language contract. FlatBuffers,
Cap'n Proto, protobuf, or MessagePack are better fits there.

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
console.log(user.tagsView().toArray());
```

For hot loops, use generated static accessors or scan kernels:

```ts
let sum = 0;
for (let index = 0; index < count; index += 1) {
  sum += UserView.getAgeAt(view, index);
}

const totalAge = UserView.sumAge(view, count);
```

`sum<Field>()` kernels are emitted for `number` scalar fields. They validate the
record count and buffer range once, then run a generated stride loop without
per-record view allocation.

## Supported Schema Surface

| Type | ABI shape | Status |
| --- | --- | --- |
| `z.i8`, `z.u8`, `z.i16`, `z.u16`, `z.i32`, `z.u32` | scalar | stable |
| `z.i64`, `z.u64` | bigint scalar | stable |
| `z.f32`, `z.f64`, `z.bool` | scalar | stable |
| `z.enumU8<T>`, `z.enumU16<T>`, `z.flags8`, `z.flags32`, `z.timestampMs` | semantic scalar aliases | stable |
| `z.fixedUtf8<N>`, `z.fixedAscii<N>`, `z.fixedBytes<N>` | inline fixed region | stable |
| `z.fixedArray<T, N>` | inline fixed array | stable for scalar, fixed bytes/string, and fixed-size struct elements |
| `z.utf8`, `z.ascii`, `z.bytes` | `Span32` descriptor | stable |
| `z.vector<T>` | `Vector32` descriptor | stable for supported elements |
| `z.pointer<T>` | signed relative `pointer32` | stable |
| bare `string` | UTF-8 `Span32` shorthand | supported, but `z.utf8` is clearer |

Unsupported by design in v1:

- bare `number`
- bare `T[]` / `any[]`
- direct recursive structs without `z.pointer<T>`
- unions without a discriminator policy
- optional/vtable-style schema evolution

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
- [CHANGELOG.md](CHANGELOG.md): release history.
