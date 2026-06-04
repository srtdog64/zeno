# 2.9.1 Release Notes

Status: post-2.9 stability and benchmark-boundary patch.

## What Changed

- Hardened `assertRowRange()` so row-range multiplication fails closed when it
  leaves JavaScript's safe integer range.
- Added `bench:graph-index` as a Diagram Studio / Obsidian-style workload
  witness. It compares source object graphs, numeric object graphs, typed-array
  indexes, and fixed-row binary indexes.
- Added a graph-index stress fixture that verifies object-graph and fixed-row
  semantics match while keeping graph code out of `@exornea/zeno-buffers`
  public exports.
- Added schema grammar doc-drift tests. Supported examples in
  `docs/human/schema-grammar.md` must analyze successfully; rejected examples
  must produce diagnostics.
- Expanded benchmark methodology notes for FlatBuffers, real-game metadata, and
  graph-index workloads.

## Boundary

This is not a graph feature release. Zeno still does not own graph
serialization, editor state, scene graphs, ECS behavior, or renderer APIs. The
graph benchmark is evidence for rebuildable numeric indexes only.

## Validation

- `npm run check`
- `npm run bench:graph-index`
- targeted graph/doc tests:
  `node --expose-gc ./node_modules/vitest/vitest.mjs run tests/docs-policy.test.ts tests/graph-index-stress.test.ts tests/buffers.test.ts tests/public-api.test.ts`
