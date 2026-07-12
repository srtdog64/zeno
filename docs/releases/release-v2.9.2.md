# 2.9.2 Release Notes

Status: fixed-record table growth and benchmark coverage patch.

## What Changed

- Fixed-record table allocation now rejects unsafe `byteLength * capacity`
  products before constructing an `ArrayBuffer`.
- Capacity growth copies only the table's active rows. Bytes outside
  `activeByteLength` are inactive capacity and are not preserved by growth.
- `bench:buffers` now separates reset reuse, exact-fit incremental growth,
  geometric growth, and sparse regrowth.
- `bench:dynamic` now measures descriptor-level ASCII equality hit/miss,
  prefix, suffix, includes hit/miss, and byte hashing against equivalent raw
  `DataView` loops.

## Compatibility

There are no new public exports and no wire ABI changes. The only behavioral
clarification is that `reset(count)` defines the live row range; inactive bytes
outside that range are not guaranteed to survive a later capacity growth.

## Validation

- `npm run release:check`
- 26 test files / 174 tests
- packed consumer smoke
- fixed-record table reuse, growth, and sparse-regrowth benchmarks
- dynamic descriptor predicate benchmarks with operation-matched baselines
