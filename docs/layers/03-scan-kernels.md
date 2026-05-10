# Layer 3 — Generated Scan Kernels

## Purpose

Turn repeated scalar scans into generated monomorphic loops.

## Public API

```ts
UserView.sumAge(view, count);
UserView.minAge(view, count);
UserView.maxAge(view, count);
UserView.countAgeWhereEq(view, count, 37);
UserView.findFirstAgeWhereEq(view, count, 37);
```

`zeno-codegen` controls this layer with:

```sh
--scan-kernels=none|sum|basic|full
```

## Guarantees

- validates scan count and scan range once before looping
- avoids per-record cursor allocation
- avoids callback dispatch in the hot loop

## Non-Guarantees

- no floating-point equality predicates
- no bigint aggregate semantics
- no dynamic string/vector scan promotion without separate witness data

## When To Use

Use this layer for aggregate scans over fixed-layout scalar records.

## Lower Layer Dependency

Layer 2 supplies field reads. Layer 1 supplies field offsets and record stride.

## Tests / Witness

- `tests/compiler/generated-e2e.test.ts`
- `packages/bench/index.mjs`
