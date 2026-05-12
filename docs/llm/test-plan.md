# Test Plan

The project needs correctness tests, allocation tests, and performance tests. Performance-only validation is not enough because layout bugs will silently corrupt data.

## 1. Compiler analysis tests

Goal: prove that TypeScript source is lowered into the expected layout IR.

Cases:

- scalar field ordering
- nested fixed struct flattening
- explicit fixed-size string and byte types
- bare `string` defaults to dynamic UTF-8 string descriptors
- `bytes` lowers to raw span descriptors
- alignment and padding rules
- unsupported `number` without binary alias
- unsupported `T[]`
- duplicate field names and cyclic types

Method:

- snapshot the emitted layout IR as JSON
- snapshot diagnostics for invalid inputs

Current witness:

- [snapshot.test.ts](../tests/compiler/snapshot.test.ts) snapshots a representative Layout IR.
- [snapshot.test.ts](../tests/compiler/snapshot.test.ts) snapshots representative rejected-source diagnostics.
- [validator.test.ts](../tests/compiler/validator.test.ts) rejects
  `vector<struct>` elements that are not fixed-stride.
- [analyzer.test.ts](../tests/compiler/analyzer.test.ts) verifies the same
  rejection through TypeScript source analysis.

## 2. Code generation tests

Goal: verify that the emitter generates stable accessor code.

Cases:

- getter offsets for every scalar type
- setter offsets for every scalar type
- nested accessors use base offset composition
- generated static `byteLength`
- import emission and helper reuse

Method:

- golden file tests for emitted TypeScript
- compile emitted output with `tsc`

Current witness:

- [snapshot.test.ts](../tests/compiler/snapshot.test.ts) snapshots emitted TypeScript for a representative schema.
- The generated example views are compiled by `npm run build`.

## 3. Runtime correctness tests

Goal: prove that generated accessors read and write the backing buffer correctly.

Cases:

- signed and unsigned integer boundaries
- `f32`/`f64` rounding behavior
- `bigint` scalar access
- fixed string truncation and null padding policy
- fixed byte slices expose shared memory rather than copied buffers
- nested struct projection
- dynamic string span reads
- dynamic vector descriptor reads
- out-of-bounds access handling

Method:

- allocate deterministic `ArrayBuffer`
- write raw bytes
- read through generated accessors
- compare against expected values

## 3A. Dynamic layout tests

Goal: validate the head plus tail arena design before broad optimization work.

Cases:

- `Span32` descriptor points at correct byte region
- zero-length string uses stable empty semantics
- `Vector32` count and element stride are correct
- vector of fixed scalars is contiguous and indexable
- vector of fixed structs composes base offsets correctly
- `vector<struct>` rejects element structs with dynamic tail fields; use
  `vector<pointer<T>>` for dynamic or graph-shaped elements
- vector of dynamic strings resolves descriptor table plus payload correctly
- nested dynamic object offsets remain relative to parent object base
- malformed relative offsets fail cleanly
- `pointer32` vectors support forward and backward references
- checked pointer writers reject target ranges outside the backing `DataView`
- pointer traversal helpers require an explicit budget and fail on cycles
- deterministic malformed descriptor corpus covers span, scalar vector, dynamic
  vector, and pointer vector bounds failures
- deterministic pseudo-fuzz corpus mutates span, scalar vector, and pointer
  vector descriptors around out-of-range payloads

Method:

- hand-build deterministic buffers
- run seed-fixed malformed descriptor generation for boundary regression
- read through generated dynamic views
- assert both values and raw offset math

## 4. Allocation tests

Goal: prove the core hot path avoids heap churn.

Current witness:

- [allocation.test.ts](../tests/runtime/allocation.test.ts) runs with
  `--expose-gc` through `npm test`.
- scalar helper scans and cursor rebase scans must stay under a conservative
  retained-heap noise budget after warmup and forced GC.

Cases:

- repeated scalar reads from a projected record
- repeated nested scalar reads
- fixed byte slice reads
- dynamic string byte-slice reads without decode
- vector indexing without array materialization
- explicit string decode cost measured separately
- compare against object decode baseline

Method:

- Node benchmark with `--expose-gc`
- inspect `process.memoryUsage()`
- sample allocation flamegraphs when needed

Success signal:

- scalar-only hot path should show near-zero steady-state allocations after setup
- slice/view access for dynamic fields should remain near-zero allocation until explicit decode or materialization

## 5. Benchmark tests

Goal: validate the performance thesis against realistic alternatives.

Baselines:

- plain object decode
- JSON parse plus object access
- typia or equivalent fast decoder
- hand-written `DataView` access

Metrics:

- messages per second
- p50 and p99 latency
- bytes allocated per message
- full GC frequency and pause time

Workloads:

- 32-byte fixed record
- 128-byte nested fixed record
- mixed fixed record with string access
- dynamic string workload with lazy byte-slice access
- dynamic string workload with explicit UTF-8 decode
- fixed-scalar vector workload
- dynamic string vector workload

## 6. Compatibility tests

Goal: prevent hidden ABI drift.

Cases:

- workspace package versions and internal workspace dependencies remain aligned
- package manifests keep root-only exports, intended files, and dependency policy
- package root runtime export surfaces stay stable
- Node LTS versions
- browser runtime with `ArrayBuffer` and `DataView`
- little-endian default and big-endian codegen option documented and tested
- emitted code works under bundlers without runtime reflection
- packed tarballs install into a clean consumer project
- package root imports work and deep subpath imports fail

Current witness:

- [version-check.mjs](../scripts/version-check.mjs) verifies root, workspace,
  lockfile, and internal dependency versions match.
- [package-policy-check.mjs](../scripts/package-policy-check.mjs) verifies
  root-only package exports, files allowlists, bins, and dependency policy.
- [public-api.test.ts](../tests/public-api.test.ts) snapshots runtime exports
  from the public package roots.
- [consumer-smoke.mjs](../scripts/consumer-smoke.mjs) packs all packages,
  installs them into a fresh consumer project, runs codegen, compiles generated
  code, executes a runtime read/write fixture, and verifies closed subpaths.

## 7. Fuzz and robustness tests

Goal: ensure malformed or truncated buffers fail safely.

Cases:

- truncated input
- oversized offsets
- invalid UTF-8 bytes
- overlapping spans
- descriptor count overflows
- tail arena pointing back into header illegally
- recursive or malicious schema shapes
- emitter collisions from reserved names

## Test order

Build in this order:

1. layout IR snapshots
2. generated code golden files
3. runtime correctness
4. dynamic layout correctness
5. allocation benchmarks
6. throughput benchmarks
