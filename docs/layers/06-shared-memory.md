# Layer 6 — Shared Memory Writer / Publication

## Purpose

Allow worker pipelines to reserve dynamic payload regions in a
`SharedArrayBuffer` and publish descriptor readiness explicitly.

## Public API

```ts
SharedDynamicLayoutWriter.initializeShard(sharedBuffer, shardOptions);
const writer = SharedDynamicLayoutWriter.fromSharedShard(sharedBuffer, shardOptions);
```

## Guarantees

- cursor reservation uses atomic control cells
- descriptor readiness is published through explicit ready cells
- sharded arenas reduce high-contention append paths

## Non-Guarantees

- fixed-position writes are still caller-race responsibility
- no async backoff strategy in the synchronous writer API
- host-native control cells are not serialized Zeno ABI fields

## When To Use

Use this layer only after the dynamic descriptor model is understood and the
worker ownership protocol is explicit.

## Lower Layer Dependency

Layer 5 supplies dynamic writer semantics. Layer 0 supplies descriptor ABI.

## Tests / Witness

- `scripts/shared-writer-stress.mjs`
- `tests/runtime/dynamic-layout.test.ts`
