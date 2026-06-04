# 2.9.0 Release Notes

Status: Geukbit dogfood boundary and fixed-record table reuse release.

> Geukbit is an external 3D editor / engine product that uses Zeno as a binary
> projection layer. It is the dogfood source of pressure for this release, not
> a Zeno subsystem. References to "Geukbit" in this changelog identify the
> caller whose real-world buffer patterns motivated the new helper; the helper
> itself contains no Geukbit-specific code.

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
