# Layer 6 - Shared Memory Writer / Publication

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
- shared control cells are conceptually separate from serialized payload bytes

## Non-Guarantees

- fixed-position writes are still caller-race responsibility
- no async backoff strategy in the synchronous writer API
- host-native control cells are not serialized Zeno ABI fields
- no guarantee that a single highly contended cursor cell scales across many
  workers

## When To Use

Use this layer only after the dynamic descriptor model is understood and the
worker ownership protocol is explicit.

## False Sharing Policy

Atomic cursor cells and descriptor ready cells are host-native control words,
not Zeno wire ABI fields. Treat them as a control block that sits outside the
serialized payload region.

High-contention worker pipelines should avoid one shared tail cursor. Prefer
worker-owned shards with separate cursor cells and payload ranges. If a future
workload proves that multiple hot cursor cells must live in one shared control
block, pad each cursor cell as if it occupies a cache line, for example by using
a 64-byte stride between `Int32Array` control words.

This is a policy boundary, not a current performance claim. JavaScript does not
expose cache-line size, and exact false-sharing behavior must be measured on the
target browser/runtime before adding adaptive backoff or padded control-block
APIs.

## Lower Layer Dependency

Layer 5 supplies dynamic writer semantics. Layer 0 supplies descriptor ABI.

## Tests / Witness

- `scripts/shared-writer-stress.mjs`
- `tests/runtime/dynamic-layout.test.ts`
