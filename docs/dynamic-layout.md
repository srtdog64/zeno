# Dynamic Layout

## Short answer

For variable-length strings and arrays, the safest design is a hybrid:

- fixed inline header for hot scalar fields
- relative offset plus length descriptors for dynamic fields
- a contiguous tail arena that stores variable payload bytes
- optional vtable only when schema evolution or sparse optional fields matter

That means the read model is closer to:

- "FlatBuffers table for dynamic fields"

than to:

- "C struct cast"

for anything containing open-ended strings or arrays.

## Recommendation

### 1. Do not use JS-style fat pointers

Do not materialize runtime objects like:

- `{ offset, length, buffer }`
- decoded `string`
- `T[]`

on every field access. That immediately reintroduces allocations and hands work back to V8 GC.

Instead, generated accessors should return lightweight views only when needed, and scalar access should stay fully inline.

### 2. Separate the wire layout into head and tail

Recommended binary shape:

1. fixed head
   Contains scalars and dynamic field descriptors
2. tail arena
   Contains UTF-8 bytes, vector payloads, and nested dynamic objects

Each dynamic field descriptor should be relative to the current object base:

```text
struct Span32 {
  u32 relOffset;
  u32 length;
}
```

This is better than absolute pointers because:

- buffers stay relocatable
- slices remain valid after transfer
- browser and Node semantics stay simple

Explicit `z.pointer<T>` fields are separate from dynamic payload descriptors.
A `pointer32` field stores a signed 32-bit offset relative to the pointer field
itself. The raw word `0xffffffff` is reserved as the null sentinel, so the
relative payload value `-1` is not encodable. This keeps pointer fields in the
same ABI family as `Span32` and `Vector32`: compact 32-bit relative descriptors,
not JavaScript object references and not process-local addresses.

Generated dereference helpers validate that the target struct's full byte range
fits inside the backing `DataView` before rebasing a cursor. Generated
`TargetOffset` accessors are checked. `UncheckedTargetOffset` accessors are
available only for low-level inspection or code that intentionally wants to
defer validation until dereference.

Generated pointer APIs separate wire inspection from semantic offsets:

- raw accessors expose the underlying unsigned 32-bit word
- relative accessors return signed relative offsets or `null`
- checked target accessors return validated absolute `DataView` byte offsets or
  `null`
- unchecked target accessors return encoded target offsets without proving the
  target record fits in the backing view

Why not index references as the default:

- indexes require a specific table or arena identity before a field can be
  interpreted
- mixed object arenas would need extra `(tableId, index)` metadata
- pointer chasing can address any object head in the same buffer without a side
  table
- index references remain useful for dense homogeneous arrays, but they are a
  different layout primitive from recursive object links

Traversal budget policy:

- generated `pointer<T>` dereference helpers move exactly one edge
- generated views must not recursively traverse or materialize pointer graphs
- `traversePointerChain(...)` rebases the supplied cursor in place; its
  `nextInto(current, out)` callback must be alias-safe because `current` and
  `out` may be the same object
- any helper that walks until null must accept an explicit step budget; runtime
  exposes `traversePointerChain(...)` for this pattern
- benchmark and fuzz workloads should include cyclic pointer data

## Why not pure VTable everywhere

VTable is useful, but it should be applied selectively.

Good use cases:

- optional fields
- sparse records
- backward and forward schema evolution
- large objects with many cold fields

Bad default for the hot path:

- every access requires more pointer chasing
- branchiness increases
- cache locality gets worse for dense fixed records

So the default should be:

- fixed head with explicit offsets for dense hot data

and only later add:

- vtable-backed objects for sparse or versioned layouts

## Why not arena alone

"Arena" is only half the answer. It explains where variable bytes live, but not how fields find them.

The real design is:

- descriptor in the head
- payload in the arena

Without descriptors, the reader cannot jump to dynamic fields in O(1).

## Suggested object layout

For a schema like:

```ts
import type { z } from "@exornea/zeno-types";

interface User {
  id: z.u64;
  age: z.i32;
  name: z.utf8;
  avatar: z.bytes;
  tags: z.vector<z.utf8>;
}
```

the buffer should look conceptually like:

```text
[User Head]
  id: u64
  age: i32
  name: Span32      -> relOffset + length
  avatar: Span32    -> relOffset + length
  tags: Vector32    -> relOffset + count

[Tail Arena]
  name bytes
  avatar bytes
  tags element region
```

Where:

```text
struct Span32 {
  u32 relOffset;
  u32 byteLength;
}

struct Vector32 {
  u32 relOffset;
  u32 count;
}
```

For vectors, element layout depends on element kind:

- fixed-size scalar vector: contiguous packed region
- fixed-size struct vector: contiguous packed region
- dynamic struct vector: contiguous table of relative offsets into the tail
- pointer vector: contiguous packed `pointer32` elements, each relative to its
  own element position
- string vector: contiguous table of `Span32` descriptors, followed by string bytes

## Read API design

If the goal is low GC pressure in V8, the public API matters as much as the buffer layout.

Good API:

- `user.id` returns scalar
- `user.nameBytes()` returns `Uint8Array` view
- `user.nameText()` decodes explicitly
- `user.avatarBytes()` returns `Uint8Array` view
- `user.tagsView()` returns a generated vector view
- `user.tagsView().at(i)` returns subviews or scalar values

Bad API:

- `user.name` always returns JS `string`
- `user.tags` always returns JS array

Those APIs force allocation on access, even if the underlying wire format is zero-copy.

## V8-specific implication

Zero-copy in V8 realistically means:

- no per-message object materialization
- no per-field wrapper allocation on the hot path
- no eager string or array conversion

It does not mean:

- JavaScript strings can be read without allocation

UTF-8 bytes can be zero-copy exposed as slices. Converting them into JS strings is a separate opt-in cost.

## Write-side model

For serialization, a bump arena is the right default.

Recommended writer flow:

1. reserve fixed head size
2. append variable payloads into tail arena
3. patch relative offsets and lengths into the head

This gives:

- linear writes
- no pointer fixups after finalization except descriptor patching
- no per-field object churn during encode

## Default choice for Zeno

If I had to pick one first design for Zeno, it would be:

- fixed-layout struct projection for fixed schemas
- head plus tail arena for dynamic fields
- `Span32` and `Vector32` descriptors with relative offsets
- generated lazy view APIs for strings and arrays
- no universal vtable in v1

Then add:

- optional vtable objects in v2 for sparse/versioned records

That keeps the hot path simple and still leaves room for FlatBuffers-like evolution later.

## Current Implementation Status

| Capability                                                                  | Status    | Witness                                                                               |
| --------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------- |
| `Span32` descriptor read/write helpers                                      | supported | [runtime index](../packages/runtime/src/index.ts)                                     |
| `Vector32` descriptor read/write helpers                                    | supported | [dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)                     |
| Generated `z.utf8`, `z.bytes`, `z.vector<T>` view accessors                 | supported | [model.view.ts](../examples/basic/src/model.view.ts)                                  |
| Fixed-size byte/string vector views                                         | supported | [dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)                     |
| Pointer vector views and writers                                            | supported | [dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)                     |
| Malformed descriptor and payload bounds checks                              | supported | [dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)                     |
| Bump-arena writer that reserves head, appends tail, and patches descriptors | supported | [DynamicLayoutWriter](../packages/runtime/src/index.ts)                               |
| Generated field-level dynamic writer helpers                                | supported | [model.view.ts](../examples/basic/src/model.view.ts)                                  |
| Generated object-level writer for fixed fields plus dynamic tail fields     | supported | [model.view.ts](../examples/basic/src/model.view.ts)                                  |
| Fixed-size `vector<struct>` writer                                          | supported | [dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)                     |
| `pointer32` relative pointer fields                                         | supported | [recursive-pointer-schema.ts](../tests/compiler/fixtures/recursive-pointer-schema.ts) |
| `SharedArrayBuffer`-backed arena initialization                             | supported | [dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)                     |
| Shared tail cursor with atomic reservation                                  | supported | [writer.ts](../packages/runtime/src/writer.ts)                                        |
| Shared arena sharding for low-contention worker append paths                | supported | [dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)                     |
| Shared descriptor ready cells for SWMR publication                          | supported | [dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)                     |
| Schema versioning through optional vtables                                  | future    | not implemented                                                                       |

The read-side model exists now. The write-side model has a low-level runtime
writer, generated field-level helpers, and a first object-level serializer path.
Vectors of structs with nested dynamic tail fields are still rejected in the
stable ABI surface; use `vector<pointer<T>>` for dynamic or graph-shaped
elements.

`VectorView` instances cache their `vector32` descriptor after the first
`length`, `payloadOffset`, or indexed access. This is load-bearing for hot loops:

```ts
for (let index = 0; index < vector.length; index += 1) {
  consume(vector.at(index));
}
```

The loop does not reread the same descriptor on every `length` and `at(...)`
call. This means vector views are live over payload bytes, but not continuously
live over descriptor rewrites. If a writer patches the descriptor after a view
has observed it, call `refreshDescriptor()` or rebase the view before reading
the new logical vector. Shared-memory readers must still wait for the descriptor
ready cell before the first descriptor read.

`SharedDynamicLayoutWriter` is the boundary helper for browser pipelines where a
WebGL/main-thread producer and an AI/worker consumer share the same backing
memory. Its tail cursor lives in the `SharedArrayBuffer` and is claimed with
`Atomics.compareExchange`, so multiple writers do not reserve the same payload
range.

Descriptor publication is an explicit synchronization boundary. Zeno writes
`span32` and `vector32` descriptors as two 32-bit ABI fields, so
`SharedDynamicLayoutWriter` does not expose the plain descriptor-writing
methods. Use the `*Published(...)` variants with an `Int32Array` state cell.
Payload bytes and descriptor fields are written first; the ready cell is then
published with `Atomics.store(...)`. Readers must wait until
`isSharedDescriptorPublished(...)` observes that ready value before reading the
descriptor.

The shared writer only coordinates tail reservation and descriptor publication.
Two writers that publish to the same descriptor offset still race at the schema
level, and fixed-position writes performed outside this helper remain the
caller's responsibility.

For high-contention append pipelines, prefer sharding over adding backoff to the
single shared cursor. `SharedDynamicLayoutWriter.fromSharedShard(...)` computes
a per-worker payload range and cursor cell from one `SharedArrayBuffer`; each
worker writes mostly inside its own shard, so normal appends do not spin on the
same `Atomics.compareExchange` loop.

The atomic cursor and ready cells are host-native `Int32Array` control words,
not serialized Zeno ABI fields. The payload descriptors remain `DataView`
fields using the schema endianness. Do not persist or transmit the control
cells as part of a portable Zeno frame. Browsers also require cross-origin
isolation headers before `SharedArrayBuffer` is available to application code.
