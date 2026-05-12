# Layer 2 - Static Scalar Accessors

## Purpose

Provide named scalar reads and writes without constructing a cursor view.

## Public API

```ts
UserView.getAge(view, byteOffset);
UserView.setAge(view, value, byteOffset);
UserView.getAgeAt(view, index);
UserView.setAgeAt(view, value, index);
```

## Guarantees

- scalar field names replace manual offset arithmetic
- no per-record view allocation
- byte-offset and index APIs stay separate

## Non-Guarantees

- no dynamic text or vector materialization
- no callback scan abstraction
- no automatic schema compatibility

## When To Use

Use this layer for scalar scans, filters, and bridge code that already owns a
`DataView`.

## Lower Layer Dependency

Layer 1 supplies offset constants.

## Tests / Witness

- `tests/compiler/generated-e2e.test.ts`
- `packages/bench/index.mjs`
