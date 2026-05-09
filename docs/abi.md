# ABI Contract

This document describes the runtime ABI layer. It is not a helper collection:
it is the wire-format contract shared by Layout IR, generated views, runtime
views, and writers.

## Claim Status

| Property | Status | Reason |
| --- | --- | --- |
| Scalar width table | load-bearing | Generated offsets and runtime reads must agree on byte length. |
| Descriptor codecs | load-bearing | `Span32`, `Vector32`, and `pointer32` define how dynamic data is addressed. |
| Relative offsets | load-bearing | Buffers must remain relocatable inside a `DataView` without process-local pointers. |
| Runtime bounds checks | load-bearing | Malformed buffers must fail at the memory boundary instead of silently reading unrelated bytes. |
| Text encode/decode codecs | load-bearing | `z.utf8` and `z.ascii` are distinct ABI promises even though string allocation is not the scalar hot path. |

## Runtime Source Layers

```txt
packages/runtime/src/abi.ts
  public ABI barrel for generated code and root exports

packages/runtime/src/range.ts
  integer, buffer, DataView, and alignment boundary checks

packages/runtime/src/scalar.ts
  ScalarKind
  scalar byte lengths
  endian-aware scalar read/write

packages/runtime/src/descriptor32.ts
  Span32 / Vector32 descriptor constants and codecs

packages/runtime/src/fixed.ts
  fixed byte/string view and UTF-8/ASCII text codecs

packages/runtime/src/pointer32.ts
  pointer32 constants and relative offset encoding

packages/runtime/src/views.ts
  public view barrel for generated code and root exports

packages/runtime/src/view-base.ts
  ProjectionView cursor and range base class

packages/runtime/src/spans.ts
  BytesSpanView / Utf8SpanView

packages/runtime/src/vector-base.ts
  VectorView descriptor and index base class

packages/runtime/src/*-vector.ts, *-vectors.ts
  scalar, byte, struct, pointer, and dynamic vector projections

packages/runtime/src/traversal.ts
  pointer traversal budget function

packages/runtime/src/writer.ts
  public DynamicLayoutWriter class

packages/runtime/src/writer-arena.ts
  head/tail arena reservation

packages/runtime/src/writer-spans.ts
  span payload writing and descriptor patching

packages/runtime/src/writer-*-vectors.ts
  scalar, byte, struct, and pointer vector payload writers

packages/runtime/src/index.ts
  public root export surface
```

The package intentionally exports only the root `@zeno/runtime` entrypoint.
Internal files exist to keep responsibilities separate; they are not separate
public subpath APIs.

The file split is load-bearing: new runtime behavior should land in the
narrowest layer that owns its ABI responsibility. Internal implementation files
should import from those narrow layers directly; `abi.ts`, `views.ts`, and
`writer.ts` are public-facing barrels, not implementation hubs.

## Scalar ABI

| Kind | Byte Length | JS Value |
| --- | ---: | --- |
| `i8`, `u8`, `bool` | 1 | `number`, `boolean` |
| `i16`, `u16` | 2 | `number` |
| `i32`, `u32`, `f32` | 4 | `number` |
| `i64`, `u64` | 8 | `bigint` |
| `f64` | 8 | `number` |

Multi-byte reads and writes use the struct's emitted `littleEndian` default.
Generated code can emit big-endian defaults, but the ABI shape is otherwise the
same.

## Container Header Policy

Zeno v1 raw records do not include a mandatory magic number, version word,
endianness marker, or layout hash. Generated views project over a caller-owned
`DataView` plus `baseOffset`; adding a global header would change that ABI and
make embedded records harder to compose.

File and network formats that need self-identification should wrap Zeno payloads
in an application container header. A future optional Zeno frame can define a
magic/version/endian/layout-hash envelope, but that envelope is not part of the
v1 wire ABI.

## Descriptor ABI

### `Span32`

```txt
offset + 0: u32 relOffset
offset + 4: u32 byteLength
```

`relOffset` is relative to the current object base. It points to a byte payload
inside the same backing `DataView`.

### `Vector32`

```txt
offset + 0: u32 relOffset
offset + 4: u32 count
```

`relOffset` is relative to the current object base. The payload layout depends
on the element kind:

- scalar: contiguous scalar values
- fixed bytes/string: contiguous fixed-width elements
- dynamic bytes/string: contiguous `Span32` descriptor table
- fixed struct: contiguous fixed-width struct records
- pointer: contiguous `pointer32` elements

## Text Encoding ABI

`z.utf8`, `z.fixedUtf8<N>`, `z.ascii`, and `z.fixedAscii<N>` preserve their
encoding in Layout IR and generated views. Runtime text readers use the emitted
encoding:

- UTF-8 fields decode with `TextDecoder`.
- ASCII fields reject bytes above `0x7f` with `RangeError`.
- ASCII writers reject non-ASCII code points before writing bytes.

This makes ASCII a checked binary contract, not just a documentation label.

### `pointer32`

```txt
field offset: i32 relativeOffset
raw null:     0xffffffff
```

For a field pointer, `relativeOffset` is relative to the pointer field itself.
For a pointer vector element, it is relative to the element's own position.

The raw word `0xffffffff` is reserved as null, so the signed payload value `-1`
is not encodable as a non-null pointer.

## Bounds Policy

Runtime projection APIs throw `RangeError` when:

- descriptor storage itself is out of bounds,
- descriptor payload range is out of bounds,
- scalar access exceeds the `DataView`,
- checked pointer dereference target range is out of bounds,
- pointer vector writes omit or fail the target byte-length range proof,
- pointer traversal exceeds its explicit step budget.

This is a runtime memory-boundary policy. Compiler/schema failures use
structured diagnostics and `Result` internally; hot-path projection reads use
exceptions for malformed buffers.

Pointer range checks prove only that a target byte range is inside the backing
`DataView`. They do not prove graph acyclicity or semantic object ownership.
Generated pointer dereference moves one edge at a time; graph traversal must use
an explicit caller budget such as `traversePointerChain(...)`.

## Witness Cases

- ABI barrel: [abi.ts](../packages/runtime/src/abi.ts)
- Range checks: [range.ts](../packages/runtime/src/range.ts)
- Scalar ABI: [scalar.ts](../packages/runtime/src/scalar.ts)
- Descriptor ABI: [descriptor32.ts](../packages/runtime/src/descriptor32.ts)
- Pointer ABI: [pointer32.ts](../packages/runtime/src/pointer32.ts)
- Projection view barrel: [views.ts](../packages/runtime/src/views.ts)
- View base: [view-base.ts](../packages/runtime/src/view-base.ts)
- Tail writer barrel: [writer.ts](../packages/runtime/src/writer.ts)
- Tail arena: [writer-arena.ts](../packages/runtime/src/writer-arena.ts)
- Malformed descriptor tests: [dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)
- Allocation regression tests: [allocation.test.ts](../tests/runtime/allocation.test.ts)

## Promotion Criterion

Do not change ABI constants or descriptor shapes unless:

- Layout IR changes in [schema](../packages/schema/src/index.ts),
- compiler lowering and emitter snapshots are updated,
- runtime malformed-buffer tests cover the new shape,
- [performance-comparison.md](performance-comparison.md) is updated when hot
  path behavior changes.
