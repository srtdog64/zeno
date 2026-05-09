# Zeno

Zeno is a TypeScript-only binary projection compiler.

It takes `.zeno.ts` TypeScript interfaces plus `@zeno/types` ABI markers,
lowers them into Layout IR, and emits zero-copy `ArrayBuffer` / `DataView`
view classes with hot-path scalar accessors and generated numeric scan kernels.

The v1 niche is deliberately narrow:

> Keep TypeScript as the schema source of truth, skip a separate IDL, and get
> FlatBuffers-like binary projection for TS-only systems.

Zeno is not trying to replace FlatBuffers for cross-language systems. It is for
small TS-first codebases that want binary layout, generated views, and fast
aggregate scans without maintaining `.fbs` files beside TypeScript models.

## What It Generates

Given a schema-only TypeScript file:

```ts
// model.zeno.ts
import type { z } from "@zeno/types";

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

Run codegen:

```sh
zeno-codegen ./src/model.zeno.ts ./src/model.view.ts
```

Use the generated view:

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

console.log(user.id);          // bigint
console.log(user.age);         // number
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

## Why Not Just FlatBuffers?

FlatBuffers is the better fit when the schema is a cross-language contract.
Zeno optimizes for a different constraint:

- TypeScript is already the model language.
- Cross-language codegen is not needed.
- A separate IDL adds cognitive overhead.
- Runtime code wants direct `DataView` projection, not object materialization.
- Aggregate scans should be generated from the TS schema instead of handwritten
  offset loops.

The tradeoff is explicit: Zeno v1 is TS-only.

## Stable V1 Surface

Zeno `1.0.0` treats the following as stable:

- `.zeno.ts` schema-only convention using TypeScript interfaces.
- `import type { z } from "@zeno/types"` ABI markers.
- fixed scalar, fixed bytes, fixed string, and nested fixed struct layouts.
- `z.utf8`, `z.ascii`, and `z.bytes` as `Span32` dynamic descriptors.
- UTF-8 and ASCII preservation in emitted readers and writers.
- `z.vector<T>` as `Vector32` for supported scalar, fixed byte/string, dynamic
  byte/string, fixed struct, and pointer elements.
- `z.pointer<T>` as signed relative `pointer32` with raw `0xffffffff` null.
- generated getters, setters, static accessors, view methods, and object
  writers for supported fields.
- generated `sum<Field>()` scan kernels for `number` scalar fields.
- unchecked cursor movement for caller-proven hot loops.
- package-root runtime imports through `@zeno/runtime`.
- `zeno-codegen`, including `--diagnostics=json` and `--endian=little|big`.

Zeno `1.1.0` adds optional container-boundary helpers without changing the raw
record ABI:

- `writeZenoFrameHeader(...)`, `readZenoFrameHeader(...)`,
  `assertZenoFrameHeader(...)`, and `zenoFramePayloadView(...)` in
  `@zeno/runtime`.
- `analyzeProjectionSourceFile(sourceFile, options)` in `@zeno/compiler`.

## Non-Goals In V1

Zeno v1 does not provide:

- cross-language codegen,
- FlatBuffers-style schema evolution or vtables,
- optional-field encoding,
- unions without an explicit discriminator policy,
- open-ended plain TypeScript arrays,
- implicit object graph materialization,
- pointer graph serialization,
- mandatory file/network magic headers,
- generated scan kernels for `i64`, `u64`, or `bool`,
- callback-based scan kernels.

Those features need separate ABI and compatibility decisions.

## Packages

- `@zeno/types`: type-only ABI marker namespace for schema authors.
- `@zeno/schema`: Layout IR and ABI layout constants.
- `@zeno/runtime`: runtime views, descriptors, pointer/vector helpers, and
  writers used by generated code.
- `@zeno/compiler`: analyzer, validator, emitter, and `zeno-codegen` CLI.

Repository layout:

- `packages/`: workspace packages.
- `examples/basic/`: v1 schema and generated view example.
- `tests/`: compiler, runtime, ABI, public API, and snapshot tests.
- `docs/`: architecture, ABI, API stability, performance, and release notes.

## Commands

```sh
npm run build
npm test
npm run bench
npm run release:check
```

`npm run release:check` is the v1 gate. It runs version/package policy checks,
cleans and builds the workspaces, runs tests, regenerates basic views, dry-runs
package packing, and installs the packed tarballs into a fresh consumer project.

`npm run bench` runs local Node microbenchmarks with `--expose-gc` and reports
median, p95, p99, standard deviation, retained memory, and ns/record numbers.

## Current Performance Witness

The current local benchmark keeps generated scan kernels within the direct
`DataView` noise floor for the first v1 aggregate:

```text
direct DataView age loop   2.29 ns/record
UserView.sumAge            1.26 ns/record
pooled noise floor         0.92 ns/record
```

This is a local witness, not a universal runtime guarantee. See
[docs/performance-comparison.md](docs/performance-comparison.md) for the full
benchmark methodology and promotion criteria.

## Design Notes

- [docs/release-v1.md](docs/release-v1.md): stable v1 surface and non-goals.
- [docs/release-v1.1.md](docs/release-v1.1.md): optional frame header and
  source-file analyzer additions.
- [docs/api-design.md](docs/api-design.md): static accessors, cursors, pointers,
  and scan kernel API rules.
- [docs/abi.md](docs/abi.md): scalar, `Span32`, `Vector32`, and `pointer32` ABI.
- [docs/schema-compatibility.md](docs/schema-compatibility.md): compatibility
  policy for schema changes.
- [docs/hot-path-optimization-notes.md](docs/hot-path-optimization-notes.md):
  measured optimization candidates and rejected ideas.
