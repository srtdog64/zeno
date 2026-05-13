# 2.9.0 Release Notes

Status: Geukbit dogfood boundary and fixed-record table reuse release.

## What Changed

- Added `createFixedRecordTable(byteLength, initialCapacity?)` to
  `@exornea/zeno-buffers`.
- Added `bench:buffers` to measure repeated fixed-row table allocation versus
  reusable table capacity.
- Locked the Geukbit dogfood boundary in docs and tests: Zeno may absorb
  dependency-free buffer patterns, but not scene/entity/component/renderer
  domain APIs.

## Why

Geukbit showed a real adapter pattern: rebuilding same-shaped fixed-row
`ArrayBuffer`/`DataView` tables every frame or document revision. That pressure
belongs in Zeno only as a generic buffer primitive.

The new helper knows only byte length, count, capacity, `ArrayBuffer`, and
`DataView`. It does not own scene graphs, ECS behavior, editor state, renderer
uploads, Three.js, WebGPU, or Geukbit-specific concepts.

## Validation

- `npm run check`
- `npm run bench:buffers`
- `npm run bench:check`
- `npm run pack:check`
- `npm run consumer:smoke`
