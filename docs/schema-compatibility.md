# Schema Compatibility

This document defines Zeno's v2 schema compatibility contract.

## Claim Status

| Property                       | Status       | Reason                                                                                                                               |
| ------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Layout signature compatibility | load-bearing | Readers and writers are binary-compatible only when offsets, byte lengths, alignments, descriptors, and endianness match.            |
| Schema source compatibility    | diagnostic   | TypeScript source diffs help review changes, but binary compatibility is decided by Layout IR.                                       |
| Append-only evolution          | candidate    | Appending fields can be compatible only when callers use an explicit envelope or version policy; Zeno v2 does not infer that policy. |
| Optional/vtable evolution      | future       | Sparse and versioned records need a vtable-style model that is intentionally outside v2.                                             |

## V2 Rule

Zeno v2 provides a stable ABI for a generated view and the exact Layout IR it was
generated from. It does not claim automatic compatibility between two different
schemas.

A schema change is binary-compatible only if the layout signature stays the same:

- struct name used by generated API remains the same,
- field names used by generated API remain the same,
- field order, offsets, byte lengths, and alignments remain the same,
- scalar kind and endianness remain the same,
- descriptor kind remains the same (`Span32`, `Vector32`, or `pointer32`),
- vector element kind and element byte length remain the same,
- pointer target layout byte length remains compatible with checked dereference.

If any of those change, treat the change as a breaking wire-format change.

## Breaking Changes

These are breaking in v2:

- changing `z.i32` to `z.u32`, `z.f32`, or another scalar kind,
- changing `z.fixedUtf8<32>` to another length,
- changing `z.utf8` to `z.fixedUtf8<N>` or the reverse,
- adding a field that changes struct `byteLength`,
- reordering fields,
- changing endianness,
- changing `z.vector<T>` element kind,
- changing a `z.pointer<T>` target to a struct with a different byte length,
- replacing `vector<struct>` with `vector<pointer<T>>` or the reverse.

## Non-Breaking Changes

These are source-level non-breaking only; they do not change the wire layout:

- comments,
- whitespace,
- TypeScript import formatting,
- renaming local type aliases that resolve to the same Zeno ABI marker,
- moving a schema file without changing generated output paths used by consumers.

## Versioning Pattern

For v2, version records explicitly at the application envelope level:

```ts
import type { z } from "@exornea/zeno-types";

export interface Envelope {
  schemaVersion: z.u16;
  payloadKind: z.u16;
  payload: z.bytes;
}
```

Then generate separate views for each payload version:

```ts
export interface UserV1 {
  id: z.u64;
  name: z.utf8;
}

export interface UserV2 {
  id: z.u64;
  name: z.utf8;
  email: z.utf8;
}
```

This keeps v2 honest: Zeno projects bytes quickly and predictably, while the
application owns migration routing.

## Promotion Criterion

Promote schema evolution from application policy to Zeno-native compatibility
when:

- Layout IR includes explicit field ids or vtable metadata,
- missing-field defaults are represented in IR,
- schema diff tooling can classify compatible and breaking changes,
- generated readers can handle older and newer layouts without caller-side
  routing.

Do not claim FlatBuffers-style evolution before those witnesses exist.

## Witness Case

- Layout IR shape: [schema package](../packages/schema/src/index.ts)
- Validator invariants: [validator.ts](../packages/compiler/src/validator.ts)
- Compatibility positioning: [ts-only-positioning.md](ts-only-positioning.md)
- Dynamic/vtable boundary: [dynamic-layout.md](dynamic-layout.md)
