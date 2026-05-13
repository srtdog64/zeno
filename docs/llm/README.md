# Zeno For LLMs

This is a compact orientation file for AI-assisted work on Zeno. It is not
marketing copy.

## Do Not Misclassify Zeno

Zeno is not:

- a general serializer
- a renderer
- a FlatBuffers replacement for cross-language systems
- a schema-evolution framework
- a security boundary for hostile binary input

Zeno is:

- a TypeScript-only binary projection compiler
- a fixed-layout `DataView` code generator
- a layout ownership tool for buffer-heavy TypeScript apps
- a scan/pack helper system for renderer-facing data

## Load-Bearing Rules

- Keep hot-path reads close to raw `DataView`.
- Do not add `Result` branches inside scalar hot loops.
- Prefer `assertRecordRange(view, count)` once before unchecked cursor loops.
- Runtime boundary failures use `RangeError`.
- Do not collapse architecture layers into generic helpers.
- `@exornea/zeno-buffers` is a pack/histogram layer, not a replacement for
  generated scan kernels.
- Zeno exposes lower layers instead of hiding them.

## Package Roles

- `@exornea/zeno-types`: type-only schema marker namespace.
- `@exornea/zeno-schema`: Layout IR, scalar metadata, ABI constants.
- `@exornea/zeno-runtime`: projection views, descriptors, writers, frame helpers.
- `@exornea/zeno-buffers`: dependency-free fixed-row typed-array pack helpers.
- `@exornea/zeno-compiler`: analyzer, lowering, validator, emitter, CLI tools.

## Compiler Pipeline

```txt
.zeno.ts source
-> analyzer
-> lowering
-> validator
-> emitter
-> generated .view.ts
```

Keep `packages/compiler/src/emitter.ts` as assembly. New generated behavior
should usually go into a layer-specific emitter file.

Important files:

- `packages/compiler/src/analyzer.ts`
- `packages/compiler/src/lowering.ts`
- `packages/compiler/src/validator.ts`
- `packages/compiler/src/emitter.ts`
- `packages/compiler/src/emitter-class.ts`
- `packages/compiler/src/emitter-fields.ts`
- `packages/compiler/src/emitter-static-accessors.ts`
- `packages/compiler/src/emitter-scan-kernels.ts`
- `packages/compiler/src/emitter-writers.ts`
- `packages/compiler/src/source-map.ts`

## Buffers Pattern

For repeated renderer loops, prefer validated plans:

```ts
const plan = createF32PackPlan(byteLength, fieldOffsets);
packF32PlanWhereU8Eq(view, count, visibleOffset, 1, plan, out);
```

Plans validate stride and field shape once, then let the frame loop reuse them.
Use `pack*Fields...` helpers only as convenience wrappers. For dynamic text
predicates, prefer descriptor-level `span*Ascii` helpers when generated offsets
are already available in the loop.

For repeated compile-frame allocation of same-shaped fixed rows, use
`createFixedRecordTable(byteLength, initialCapacity?)`. It belongs in
`@exornea/zeno-buffers` because it only knows byte length, count, capacity,
`ArrayBuffer`, and `DataView`. Do not turn it into a scene/entity/component or
renderer upload abstraction.

## Before Suggesting A Change

Check whether the suggestion:

- adds allocation or unpredictable branching inside scalar hot paths
- turns a layer boundary into a vague helper
- implies cross-language compatibility or schema evolution Zeno does not provide
- makes `@exornea/zeno-buffers` compete with generated scan kernels
- promotes dynamic string/vector/pointer-heavy workloads as the main performance
  claim
- caches `text()` on a live view instead of explicit materialization

If yes, frame it as a tradeoff or future experiment, not as an obvious fix.

## Related Orientation

- [Human docs](../human/README.md)
- [Expanded README archive](expanded-readme.md)
- [Repository LLM map](../../llms.txt)
- [Layered model](../reference/layers/README.md)
