# Architecture

## Feasibility

This is feasible, but only if the project is precise about what "pure TypeScript types" means.

Possible:

- authoring with `interface` and `type` only
- compile-time analysis of a restricted schema grammar
- generated projection classes or factory functions
- zero-copy scalar reads from a backing `ArrayBuffer`
- zero object allocation for scalar access paths

Not possible from syntax alone:

- inferring whether `number` means `i32`, `u32`, `f32`, or `f64`
- inferring fixed-width string or bytes lengths from plain syntax
- inferring dynamic array boundaries from `T[]`
- inferring layout/alignment policy for unions and versioned schemas

So the real rule should be:

> No decorators and no runtime schema objects, but binary semantics still need to exist in the type system.

That can be encoded with type aliases such as `z.i32`, `z.u32`, `z.f64`, `z.bytes`, `z.fixedBytes<16>`, and `z.fixedUtf8<32>`. Bare `string` can map to the default UTF-8 dynamic text policy, but schema files should prefer `z.utf8` because it makes the ABI rule visible during review.

## Authoring model

```ts
import type { z } from "@exornea/zeno-types";

export interface User {
  id: z.u64;
  age: z.i32;
  handle: z.fixedUtf8<32>;
  name: z.utf8;
  avatar: z.bytes;
}
```

The standalone compiler should analyze this and emit something structurally similar to:

```ts
export class UserView {
  static readonly byteLength = 44;

  constructor(
    private readonly view: DataView,
    private readonly baseOffset = 0,
  ) {}

  get id(): bigint {
    return this.view.getBigUint64(this.baseOffset + 0, true);
  }

  get age(): number {
    return this.view.getInt32(this.baseOffset + 8, true);
  }

  handleText(): string {
    return decodeFixedUtf8(this.view, this.baseOffset + 12, 32);
  }

  nameView(): Utf8SpanView {
    return new Utf8SpanView(this.view, 44, this.baseOffset, true);
  }

  avatarBytes(): Uint8Array {
    return new BytesSpanView(this.view, 52, this.baseOffset, true).bytes();
  }
}
```

## Pipeline

1. Source scan
   Read source files that opt into projection generation.
2. Frontend analysis
   Read a restricted `.zeno.ts` schema grammar from TypeScript syntax.
3. Layout IR build
   Convert resolved fields into a compact internal representation.
4. Validation
   Reject unsupported constructs early with deterministic diagnostics.
5. Code emission
   Generate `.ts` view classes or transformed inline accessors.
6. Runtime binding
   Reuse shared ABI, projection view, and writer layers for scalar, slice,
   vector, pointer, and tail-arena access.

## Layout Ownership

Zeno exists because buffer-heavy TypeScript applications often have no single
owner for binary layout. WebGL, WebGPU, Three.js, Electron, worker, and local
cache pipelines commonly move through `ArrayBuffer`, `DataView`, `Float32Array`,
and `Uint32Array` values. The code stays fast, but field offsets, strides,
command words, descriptor positions, and typed-array packing rules tend to
spread across renderer, worker, cache, and tooling modules.

That is the failure mode Zeno targets. It is not trying to become a renderer,
scene graph, asset loader, or cross-language serialization format. It provides a
layout layer that keeps byte-level access visible while making the layout:

- named by TypeScript schema fields,
- generated instead of handwritten,
- inspectable through layout manifests and `zeno-inspect`,
- diffable through `zeno-diff-layout`,
- usable by both schema-aware generated scan kernels and generic typed-array
  packing helpers.

The lower layer remains available. Callers can still use raw `DataView` and
typed-array APIs when that is the right hot path. Zeno's job is to prevent those
raw offsets from becoming unowned application folklore.

## Package Architecture

The package layering is load-bearing. Each package owns one level of the binary
projection stack, and dependencies should move from schema facts toward emitted
runtime code rather than back upward.

```txt
schema (Layout IR + ABI constants)
   |
   v
types (schema-author marker types)
   |
   v
runtime (range -> scalar -> descriptor32 -> fixed -> pointer32 -> views -> writer)
   |
   v
buffers (fixed rows -> caller-owned typed arrays)
   |
   v
compiler (analyzer -> lowering -> validator -> emitter)
```

`@exornea/zeno-schema` defines the normalized Layout IR and ABI facts that all
other packages must agree on: scalar widths, descriptor shapes, pointer policy,
field offsets, byte lengths, alignment, source locations, and endianness. It is
the internal contract between analysis, validation, emitted code, and runtime
helpers.

`@exornea/zeno-types` is the schema-authoring surface. It provides type-only
brand aliases such as `z.i32`, `z.u64`, `z.fixedUtf8<32>`, `z.vector<T>`, and
`z.pointer<T>`. These marker types carry ABI intent in TypeScript without
introducing decorators, runtime schema objects, or application-level values.

`@exornea/zeno-runtime` owns memory projection. Its source files are split by ABI
responsibility:

- `range`: integer, `ArrayBuffer`, `DataView`, and alignment checks
- `scalar`: endian-aware scalar read/write primitives
- `descriptor32`: `Span32` and `Vector32` dynamic payload descriptors
- `fixed`: fixed byte/string views and text codecs
- `pointer32`: relative pointer encoding
- `views`: projection view barrels used by generated code
- `writer`: dynamic tail arenas, vectors, shared-memory publication, and frame
  helpers

`@exornea/zeno-buffers` owns dependency-free fixed-row packing helpers. It takes
`DataView` rows plus generated byte lengths and offsets, and writes into
caller-owned `TypedArray` outputs. It must not import renderer libraries or own
GPU upload behavior. It is not a second schema-aware scan-kernel surface:
generated `*View.sum*`, `count*WhereEq`, and `findFirst*WhereEq` methods answer
scalar table-scan questions, while `@exornea/zeno-buffers` owns generic
pack/histogram helpers for typed-array outputs.

`@exornea/zeno-compiler` turns schema-only TypeScript into generated view code.
It reads a restricted `.zeno.ts` schema grammar in `analyzer`, lowers it to
Layout IR in `lowering`, enforces ABI invariants in `validator`, and emits
`.view.ts` code in `emitter`. The compiler uses `Result<T, E>` and structured
diagnostics because schema failures are recoverable authoring errors; runtime
projection failures remain `RangeError` at the memory boundary.

## Core packages

### `packages/schema`

The schema package defines the internal representation shared by the compiler and runtime-adjacent tooling.

The compiler should not directly emit from AST nodes. It should emit from a normalized layout IR:

- stable
- snapshot-testable
- independent from TS AST shapes
- reusable by benchmarks and future binary format backends

### `packages/compiler`

Recommended split:

- `analyzer.ts`: restricted schema grammar frontend
- `lowering.ts`: TypeScript types to layout IR
- `validator.ts`: unsupported construct checks
- `emitter.ts`: generate view code

The first supported integration point is the standalone `zeno-codegen` CLI.
A `tsc` transformer/plugin entrypoint is future work and is not exported as a
public API until it does real work.

### `packages/runtime`

Contains the runtime ABI and projection layers:

- `range.ts`: integer, `DataView`, buffer, and alignment checks
- `scalar.ts`: scalar reads/writes
- `descriptor32.ts`: `Span32` and `Vector32`
- `pointer32.ts`: relative pointer encoding
- `view-base.ts`, `spans.ts`, `*-vector.ts`: projection views
- `writer-*.ts`: tail arena and descriptor writers

The public package still exposes only the root entrypoint. Generated code should
inline offsets and avoid reflective lookup tables on the hot path.

#### Runtime Failure Policy

The compiler uses `Result<T, E>` and structured diagnostics for recoverable
schema and IR failures. The runtime is different: it sits on the memory access
boundary and uses `RangeError` for invalid offsets, truncated descriptors, and
out-of-bounds payloads.

This is intentional. Runtime projection helpers are hot-path APIs over caller
provided `ArrayBuffer`/`DataView` values, and returning `Result` from every
scalar or span read would change the API shape and steady-state cost. Callers
that accept untrusted buffers should validate or catch at the boundary before
entering tight projection loops.

Zeno explicitly rejects `Result<T, E>` on runtime hot projection paths:
generated scalar getters, scan kernels, cursor movement, and tight vector access
loops must not return `Result<T, E>`. They must stay value-returning APIs.
`Result` belongs in compiler analysis and optional boundary validation wrappers,
not in the inner projection loop.

Promotion criterion: add a separate safe wrapper API only when there is a
witness workload that needs recoverable malformed-buffer handling without
throwing.

## Practical boundaries

### True zero-allocation reads

These are realistic for:

- integer and float scalars
- booleans
- fixed sub-views
- byte slices returned as `Uint8Array` views

These are not zero-allocation unless carefully constrained:

- decoded JavaScript `string`
- converted JS arrays
- arbitrary nested object materialization

If the API returns a JS `string`, there is still a decode cost and likely allocation. That is acceptable, but it is not the same as scalar zero-copy projection.

### Variable-length data

A fixed-layout struct model is insufficient for general dynamic fields.

Once the schema contains:

- vectors
- strings with runtime length
- optional blobs
- unions

you need either:

- inline header fields with offsets and lengths
- a separate table/vtable model
- or an external framing rule

That is effectively the point where the system stops being "C struct projection" and becomes "FlatBuffers-like table projection".

### Endianness

The Layout IR carries `endianness: "little" | "big"`. Codegen defaults to
little-endian but accepts `--endian=big`; emitted constructors and static scalar
accessors use that layout default for their `littleEndian` parameter. Callers can
still override the generated default per call when needed.

## Suggested phases

### Phase 0

- fixed scalars only
- generated getters only
- layout IR snapshot tests

### Phase 1

- setters
- nested fixed structs
- fixed bytes and fixed strings

### Phase 2

- arrays with compile-time length
- zero-copy subview APIs
- better diagnostics

### Phase 3

- offset-table encoding for dynamic fields
- vector/string table accessors
- explicit schema compatibility policy and layout diff tooling

Current v2.8 status: dynamic descriptors exist for the supported `Span32`,
`Vector32`, `dynamicVector`, and `pointer32` ABI families. Native schema
evolution remains an explicit non-goal for the current projection ABI; Zeno
instead exposes layout manifests and `zeno-diff-layout` so applications can use
explicit version routing when they need compatibility review. See
[schema-compatibility.md](../human/schema-compatibility.md).
