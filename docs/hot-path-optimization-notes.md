# Hot-Path Optimization Notes

This file tracks optimization proposals before they are promoted into generated
code. Do not move an optimization into `emitter.ts` just because it is plausible;
it needs a witness case and a failure mode.

## Claim Status

| Proposal | Status | Reason |
| --- | --- | --- |
| Static byte-offset accessors | load-bearing | They avoid per-record views and remain the main scan API. |
| Reusing one cursor view | load-bearing | It avoids one view object per record, though it is not the scalar hot path. |
| Hoisted offset constants | candidate | Latest scalar-mix witness is favorable, but prior runs were not stable. |
| Precomputed cursor field offsets | candidate | Helps single-field cursor reads; scalar mix does not yet justify extra generated state. |
| Bound `DataView` methods | retired | Latest witness shows worse age-scan timing and bound functions add per-view state. |
| TypedArray reinterpretation | candidate | Potentially useful for native-endian homogeneous vectors, not general mixed structs. |
| Generic indexed `getField(index)` | diagnostic | Useful for tooling, but not a hot-path API because it becomes polymorphic. |
| `TextDecoder` singleton and explicit bytes/text split | load-bearing | Already implemented in runtime; text decode remains explicit allocation work. |

## Latest Witness

Command:

```powershell
npm run codegen:basic
npm run codegen:basic:optimized
npm run build
npm run bench
```

Parameters:

- Date: 2026-05-08
- Records: 200,000
- Warmup runs: 3
- Measured runs: 30
- Record stride: 88 bytes

Single-field `age` scan:

| Candidate | Median ns/record | Delta vs direct | Status |
| --- | ---: | ---: | --- |
| Direct `DataView.getInt32` | 3.80 | baseline | baseline |
| Direct offset-increment loop | 2.10 | -1.70 | favorable in this run |
| Bound `DataView.getInt32` | 1.23 | -2.57 | median favorable, but cursor binding remains poor |
| Zeno static offset accessor | 3.26 | -0.54 | within noise |
| Current Zeno cursor `rebase` | 8.70 | +4.90 | not hot path |
| Current Zeno cursor `moveTo` | 8.96 | +5.16 | not hot path |
| Optimized generated cursor `rebase` | 9.15 | +5.35 | no win vs current |
| Optimized generated cursor `moveTo` | 8.93 | +5.13 | no win vs current |
| Bound-method cursor | 10.33 | +6.54 | worse |
| Manual precomputed-offset cursor | 1.51 | -2.28 | useful micro witness, not generated shape |
| Per-record view | 22.66 | +18.86 | avoid |

Scalar mix (`u64`, `i32`, `f64`, `f32`):

| Candidate | Median ns/record | Delta vs direct | Status |
| --- | ---: | ---: | --- |
| Direct `DataView` scalar mix | 23.66 | baseline | baseline |
| Direct offset-increment loop | 23.77 | +0.11 | within noise |
| Hoisted offset constants | 22.70 | -0.96 | within noise |
| Zeno static offset accessor | 28.60 | +4.95 | within noise |
| Zeno static offset loop | 27.13 | +3.47 | within noise |
| Current Zeno cursor `rebase` | 34.04 | +10.38 | worse |
| Optimized generated cursor `rebase` | 32.67 | +9.02 | slight improvement vs current, within noise |
| Optimized generated cursor `moveTo` | 34.10 | +10.44 | worse vs direct |
| Manual precomputed-offset cursor | 22.56 | -1.10 | within noise |
| Zeno cursor `moveTo` | 48.23 | +24.57 | worse |

Retained view memory:

| Scenario | Heap delta over buffer-only | Status |
| --- | ---: | --- |
| Current generated `UserView` objects | 10.93 MiB | baseline |
| Optimized generated `UserView` objects | 17.04 MiB | higher heap |
| Materialized JS objects | 23.14 MiB | highest heap |

Methodological note: these are V8/Node local measurements. They supply
promotion evidence only for this runtime and this schema shape.

## Decisions

### Bound `DataView` methods

Do not emit per-instance bound methods.

Reason:

- `view.getInt32.bind(view)` creates function objects.
- The latest age witness is slower than direct `DataView`.
- Even when median looks good in short runs, p95/p99 variance is poor.

### Precomputed cursor offsets

Keep as candidate, but do not promote. The compiler has an experimental emit
switch for this:

```powershell
node .\packages\compiler\bin\zeno-codegen.mjs .\examples\basic\src\model.zeno.ts .\examples\basic\src\model.optimized.view.ts --optimize-cursor-offsets
```

The default emitter does not enable it.

Latest generated-view witness:

- optimized `rebase` scalar mix is only `1.36 ns/record` faster than the current
  cursor and within pooled noise
- optimized retained view heap is about `6.11 MiB` higher for 200,000 retained
  views
- single-field `age` does not improve versus current cursor in the default run

Promote only if:

- scalar mix improves across at least three default benchmark runs
- retained `UserView` heap does not meaningfully regress
- generated code size remains acceptable
- `rebase()` and `moveTo()` update cached offsets correctly

Do not promote for static accessors. Static accessors already receive a
byte offset and should keep using inline constants.

### Narrow scalar cursors

Do not add generated per-field scalar cursor classes for `1.0.0`.

Witness run:

- generated `UserViewAgeCursor` shape: `view + offset`
- generated `UserViewScalarCursor` shape: `view + scalar offsets`
- age cursor `nextUnchecked`: `4.87 ns/record`
- static `ageAt`: `4.69 ns/record`
- scalar cursor `nextUnchecked` mix: `39.37 ns/record`
- static scalar mix: `33.74 ns/record`

This is a structural rhyme with the manual `PrecomputedAgeOffsetView` benchmark,
but not a stable win as generated API. The narrower hidden class helps in some
single-field witnesses, yet getter calls and cursor state still do not beat the
static accessor path. Keep this as a diagnostic experiment, not a public v1 API.

### Offset-increment loops

Document as a call-site pattern, not a generated view change.

For tight scans, callers should prefer:

```ts
for (let offset = 0, end = count * UserView.byteLength; offset < end; offset += UserView.byteLength) {
  sum += UserView.getAge(view, offset);
}
```

### Generated sum kernels

Promote generated `sum<Field>()` kernels for `number` scalar fields.

Reason:

- they keep the direct stride loop inside generated code
- they avoid callback overhead
- they avoid per-record cursor/view state
- they remove handwritten offset math from TS callers

First witness:

- direct `DataView` age loop: `5.63 ns/record`
- `UserView.sumAge(view, count)`: `6.06 ns/record`
- result: within pooled noise, with a cleaner API boundary

Do not generate v1 sum kernels for `i64`, `u64`, or `bool`. BigInt
accumulation and boolean counting need separate naming and overflow semantics.

over index APIs when they already own byte offsets.

### TypedArray reinterpretation

Do not use for general structs yet.

Reasons:

- endianness follows the host
- mixed struct layouts require several views anyway
- alignment constraints are stricter than `DataView`

Possible future witness:

- homogeneous scalar vectors
- native-endian opt-in mode
- browser and Node agreement checks

### Allocation testing

Do not rely on monkey-patching `Array` as an allocation counter. It misses
engine-internal allocations and typed array/string allocation paths.

Use:

- retained heap deltas with `--expose-gc`
- explicit materialization benchmarks
- browser allocation instrumentation later

## Cross-References

- Benchmark implementation: [packages/bench/index.mjs](../packages/bench/index.mjs)
- API design: [api-design.md](api-design.md)
- Performance comparison: [performance-comparison.md](performance-comparison.md)
- Runtime helpers: [packages/runtime/src/index.ts](../packages/runtime/src/index.ts)
- Emitter option: [packages/compiler/src/emitter.ts](../packages/compiler/src/emitter.ts)
- Codegen CLI: [packages/compiler/bin/zeno-codegen.mjs](../packages/compiler/bin/zeno-codegen.mjs)
