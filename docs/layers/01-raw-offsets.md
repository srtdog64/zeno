# Layer 1 — Raw Offsets

## Purpose

Expose generated constants so callers can write direct `DataView` loops without
handwritten offsets.

## Public API

```ts
UserView.byteLength;
UserView.ageOffset;
UserViewByteLength;
UserViewAgeOffset;
```

## Guarantees

- no object allocation
- no generated helper call required
- offsets remain visible instead of hidden behind a serializer abstraction

## Non-Guarantees

- no range checks beyond what the caller writes
- no typed field API
- no dynamic descriptor decoding

## When To Use

Use this layer for the absolute lowest-level hot loops or for comparing Zeno
against handwritten `DataView`.

## Lower Layer Dependency

Layer 0 supplies byte length, alignment, and offset values.

## Tests / Witness

- `tests/compiler/snapshot.test.ts`
- `packages/bench/index.mjs`
