# Schema Evolution Notes

This document records the v1 policy for optional fields and discriminated
unions. It is a design boundary, not an implementation plan for the current
ABI.

## Claim Status

| Property | Status | Reason |
| --- | --- | --- |
| Fixed field order is the v1 ABI | load-bearing | Current generated views rely on compile-time offsets. |
| Optional fields require metadata | load-bearing | Absence cannot be represented by a fixed inline field without a presence model. |
| Discriminated unions require a tag ABI | load-bearing | Variant interpretation must be explicit and stable. |
| TypeScript optional syntax is documentation only | diagnostic | It is familiar syntax, but accepting it without ABI meaning would be unsafe. |

## Optional Fields

Do not accept this as v1 layout syntax:

```ts
export interface User {
  id: z.u64;
  nickname?: z.utf8;
}
```

Reason: `?` says a property may be absent in TypeScript object space. It does
not define:

- field id
- presence bit
- default value
- vtable slot
- compatibility behavior when the field is added or removed

Promote optional fields only when:

- Layout IR has stable field ids,
- the wire format includes presence metadata or vtable entries,
- missing fields have documented default behavior,
- generated readers can distinguish absent from empty dynamic payloads,
- schema compatibility tests cover old-reader/new-writer and new-reader/old-writer cases.

## Discriminated Unions

Do not accept this as v1 layout syntax:

```ts
export interface Event {
  payload: z.i32 | z.utf8;
}
```

Reason: a union needs an explicit discriminator and variant table. Otherwise the
same bytes can be interpreted as multiple layouts.

Candidate shape:

```ts
export interface Event {
  tag: z.u8;
  payload: z.union<{
    1: z.i32;
    2: z.utf8;
  }>;
}
```

This is illustrative only. Do not implement it until the compiler can validate:

- tag scalar width,
- unique variant ids,
- variant payload descriptor shape,
- unknown variant behavior,
- compatibility when variants are added.

## Pattern Note

Optional fields and unions rhyme structurally: both require a level of metadata
above fixed offsets. That metadata is a schema-evolution layer, not a small
extension to the current packed fixed-layout ABI.

