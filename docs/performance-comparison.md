# Performance Comparison

This document records the current Zeno scalar hot-path comparison against plain
baselines.

## Claim Status

| Property | Status | Reason |
| --- | --- | --- |
| Buffer-backed storage avoids per-record JS object materialization | load-bearing | This is the core Zeno runtime thesis. |
| Static generated scalar access can approach direct `DataView` cost | candidate | Current witness supports it, but more workloads and repeated runs are needed. |
| Cursor reuse is preferable to per-record view allocation | load-bearing | The benchmark shows a large timing difference and avoids retained view arrays. |
| Per-record retained `UserView` objects still allocate heap | diagnostic | It is useful for API design, but not the intended hot path. |
| Materialized JS objects retain more heap than view objects | diagnostic | True for this witness, but schema shape can change the exact ratio. |
| Pointer dereference has a separate cost model | candidate | `pointer32` chasing is benchmarked separately from fixed-stride scalar scans. |

## Witness Case

- Witness: 1,000,000 `UserView` records, fixed stride of 88 bytes.
- Asymptotic form: `N` fixed-layout records stored in one contiguous
  `ArrayBuffer`, read by generated scalar accessors.
- PowerShell command:
  `$env:ZENO_BENCH_RECORDS='1000000'; $env:ZENO_BENCH_WARMUP='3'; $env:ZENO_BENCH_RUNS='30'; npm run bench`
- Date: 2026-05-09

Methodological note: this is a local Node benchmark using
`process.memoryUsage()` and `--expose-gc`. It supplies an engineering witness,
not a universal performance proof.

## Latest Verification Run

After adding literal-stride `getXAt(...)` accessors and unchecked cursor
movement, the local smoke witness was rerun with the default benchmark settings:

```powershell
npm run bench
```

Run parameters:

- Date: 2026-05-09
- Records: 200,000
- Warmup runs: 3
- Measured runs: 30
- Record stride: 88 bytes
- Raw buffer size: 16.78 MiB

Summary:

| Comparison | Median delta | Pooled std | Status |
| --- | ---: | ---: | --- |
| age: static offset vs direct | +2.00 ns/record | 2.58 ns/record | within noise |
| age: static index vs direct | +0.18 ns/record | 1.69 ns/record | within noise |
| age: cursor `rebase` vs direct | +5.03 ns/record | 2.21 ns/record | above noise |
| age: cursor `rebaseUnchecked` vs direct | -1.05 ns/record | 1.73 ns/record | within noise |
| age: cursor `moveToUnchecked` vs direct | -1.32 ns/record | 1.48 ns/record | within noise |
| age: per-record view vs direct | +21.16 ns/record | 4.05 ns/record | above noise |
| scalar mix: static offset vs direct | +3.52 ns/record | 5.98 ns/record | within noise |
| scalar mix: static index vs direct | +3.70 ns/record | 7.57 ns/record | within noise |
| scalar mix: cursor `rebase` vs direct | +27.85 ns/record | 11.16 ns/record | above noise |
| scalar mix: cursor `rebaseUnchecked` vs direct | +13.30 ns/record | 6.75 ns/record | above noise |

Retained memory:

| Scenario | Heap delta over buffer-only | Meaning |
| --- | ---: | --- |
| Scalar passes after GC | +286.52 KiB | Hot scalar reads leave little retained heap. |
| Retained `UserView` objects | +10.97 MiB | Per-record views are still an avoid path. |
| Retained materialized JS objects | +23.18 MiB | Plain object materialization is heavier in this witness. |

Current conclusion: static offset and static index access are both within the
measured noise floor for the single-field witness after emitting literal record
strides. Checked cursor movement remains slower. Unchecked cursor movement is
competitive for single-field scans when the caller already proves bounds.
Per-record view allocation is clearly slower and retains avoidable heap.

Pointer dereference witness from the same local run:

| Pointer workload | Median | p95 | p99 | Std | Median ns/record |
| --- | ---: | ---: | ---: | ---: | ---: |
| Direct `DataView` signed `pointer32` deref | 0.53 ms | 1.72 ms | 1.80 ms | 0.32 ms | 2.67 ns |
| Cursor `pointer32` `nextInto` | 2.02 ms | 2.18 ms | 2.18 ms | 0.12 ms | 10.11 ns |

Pointer delta: cursor `nextInto` was +7.43 ns/record over direct `DataView`,
above the pooled noise floor in this run. This is a separate workload from
fixed-stride scalar projection because it measures pointer chasing and cursor
rebasing rather than contiguous record scanning.

## Scalar Read Timing

| Access mode | Median | p95 | p99 | Std | Median ns/record | Relative median | Allocation shape |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Direct `DataView.getInt32` | 4.78 ms | 5.69 ms | 5.73 ms | 0.53 ms | 4.78 ns | 1.00x | no per-record object |
| `UserView.getAge(view, offset)` static accessor | 5.31 ms | 7.17 ms | 7.41 ms | 0.82 ms | 5.31 ns | 1.11x | no per-record object |
| `UserView.getAgeAt(view, index)` index accessor | 6.34 ms | 7.35 ms | 7.70 ms | 0.62 ms | 6.34 ns | 1.33x | no per-record object |
| One `UserView` cursor with `rebase(offset)` | 6.38 ms | 7.77 ms | 8.14 ms | 0.75 ms | 6.38 ns | 1.33x | one reusable view object |
| One `UserView` cursor with `moveTo(index)` | 5.61 ms | 7.78 ms | 7.98 ms | 0.79 ms | 5.61 ns | 1.17x | one reusable view object |
| `new UserView(view, offset).age` per record | 24.57 ms | 31.48 ms | 33.06 ms | 3.41 ms | 24.57 ns | 5.14x | transient object per record |

## Scalar Mix Timing

The scalar mix reads `u64`, `i32`, `f64`, and `f32` from each record.

| Access mode | Median | p95 | p99 | Std | Median ns/record | Relative median | Allocation shape |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Direct `DataView` scalar mix | 26.65 ms | 31.93 ms | 32.73 ms | 2.53 ms | 26.65 ns | 1.00x | no per-record object |
| Direct `DataView` with `UserView.*Offset` constants | 35.92 ms | 40.59 ms | 42.29 ms | 3.31 ms | 35.92 ns | 1.35x | no per-record object |
| Direct `DataView` with top-level generated offset constants | 36.78 ms | 44.83 ms | 44.91 ms | 3.51 ms | 36.78 ns | 1.38x | no per-record object |
| Direct `DataView` with hoisted offset constants | 35.57 ms | 47.07 ms | 56.24 ms | 6.54 ms | 35.57 ns | 1.33x | no per-record object |
| Zeno static scalar mix | 33.85 ms | 44.30 ms | 46.03 ms | 5.86 ms | 33.85 ns | 1.27x | no per-record object |
| Zeno static scalar mix with `At` accessors | 43.10 ms | 52.08 ms | 54.06 ms | 4.47 ms | 43.10 ns | 1.62x | no per-record object |
| Zeno cursor scalar mix with `rebase(offset)` | 45.35 ms | 49.05 ms | 50.55 ms | 3.31 ms | 45.35 ns | 1.70x | one reusable view object |
| Zeno cursor scalar mix with `moveTo(index)` | 47.71 ms | 50.97 ms | 51.46 ms | 2.90 ms | 47.71 ns | 1.79x | one reusable view object |

## Noise Floor

The benchmark reports sample standard deviation across repeated runs and compares
median deltas against pooled standard deviation.

| Comparison | Median delta | Pooled std | Ratio | Status |
| --- | ---: | ---: | ---: | --- |
| age: static offset vs direct | +0.54 ns/record | 0.97 ns/record | 0.55x | within noise |
| age: static index vs direct | +1.56 ns/record | 0.81 ns/record | 1.92x | above noise |
| age: cursor `moveTo` vs direct | +0.83 ns/record | 0.95 ns/record | 0.88x | within noise |
| age: per-record view vs direct | +19.79 ns/record | 3.45 ns/record | 5.74x | above noise |
| scalar mix: offset constants vs direct | +9.27 ns/record | 4.17 ns/record | 2.22x | above noise |
| scalar mix: top-level offset constants vs direct | +10.12 ns/record | 4.32 ns/record | 2.34x | above noise |
| scalar mix: hoisted offset constants vs direct | +8.91 ns/record | 7.02 ns/record | 1.27x | above noise |
| scalar mix: static offset vs direct | +7.20 ns/record | 6.38 ns/record | 1.13x | above noise |
| scalar mix: static index vs direct | +16.45 ns/record | 5.14 ns/record | 3.20x | above noise |
| scalar mix: cursor `rebase` vs direct | +18.70 ns/record | 4.16 ns/record | 4.49x | above noise |

## Retained Memory

| Scenario | Heap delta over buffer-only | External memory delta | ArrayBuffer delta | Meaning |
| --- | ---: | ---: | ---: | --- |
| Raw buffer retained | +7.61 KiB over baseline | +83.92 MiB | +83.92 MiB | Record bytes live outside JS object heap. |
| Scalar passes after GC | +146.82 KiB | 0 B | 0 B | Hot scalar reads leave little retained heap. |
| Retained `UserView` objects | +53.56 MiB | 0 B | 0 B | Keeping one view per record is not zero-allocation. |
| Retained materialized objects | +114.59 MiB | 0 B | 0 B | Plain object materialization is heavier in this witness. |

## Plain Baseline Interpretation

Plain object materialization is the baseline Zeno is trying to avoid. Direct
`DataView` is the lower-level baseline Zeno tries to approach while preserving
TypeScript-native schema authoring.

| Question | Plain JS object | Direct `DataView` | Zeno static accessor | Zeno cursor view |
| --- | --- | --- | --- | --- |
| TypeScript schema authoring | no | no | yes | yes |
| Per-record object required | yes | no | no | no |
| Named field API | yes | no | yes | yes |
| Near-direct scalar timing in witness | no | yes | yes | mostly |
| Nested/dynamic view API | manual | manual | generated | generated |

## API Interpretation

Use byte-offset static accessors for the hottest loops. Index accessors such as
`getAgeAt(view, index)` are safer at call sites because they own the stride
calculation; after emitting literal record strides, the latest single-field
witness puts `getAgeAt` within the measured noise floor. Checked cursor
movement is ergonomic but slower. Unchecked cursor movement is available for
caller-proven loops, but scalar mix scans still favor static access.

For multi-field scans, generated offset constants such as `UserView.ageOffset`
or `UserViewAgeOffset` let callers keep direct `DataView` calls while avoiding
hand-maintained layout numbers. In this witness, constants did not beat the
static accessor path, and manually hoisting constants did not reliably improve
results. Treat offset constants as a control knob for direct `DataView` users,
not as an automatic performance win.

## Promotion Criterion

Promote "Zeno static scalar access is near direct `DataView`" from candidate to
load-bearing when:

- the benchmark runs at least 10 iterations and reports median plus p95
- the same conclusion holds across at least three independent runs
- the same conclusion holds for scalar mixes including `u64`, `f32`, and `f64`
- browser runtime results do not contradict the Node result

Do not promote dynamic string/vector performance claims yet. They need separate
witness cases for byte-slice access, explicit text decode, and vector indexing.

Do not promote cursor offset caching by default until the experimental
`--optimize-cursor-offsets` emitter mode has repeated benchmark and retained
heap witnesses.

The latest generated optimized-view witness still does not clear that bar:

- current cursor unchecked scalar mix: `39.51 ns/record`
- optimized cursor unchecked scalar mix: `40.37 ns/record`
- current retained view heap: `10.97 MiB`
- optimized retained view heap: `17.07 MiB`

There is no stable timing win and there is a clear heap cost, so the default
emitter stays unchanged.

## Scan Kernel Witness

Generated number-scalar scan kernels are part of the v1 hot path. The first
kernel is `sum<Field>()`, emitted for scalar fields whose TypeScript value is
`number`.

Latest local witness:

- direct `DataView` age loop: `5.70 ns/record`
- generated `UserView.sumAge`: `5.38 ns/record`
- pooled noise floor: `1.76 ns/record`

This puts the generated sum kernel inside the direct `DataView` noise floor
while removing handwritten offset math from the caller. Do not generalize this
claim to callback scans, dynamic fields, `i64`/`u64`, or boolean counts yet.

## Cross-References

- Benchmark implementation: [packages/bench/index.mjs](../packages/bench/index.mjs)
- Generated view witness: [examples/basic/src/model.view.ts](../examples/basic/src/model.view.ts)
- Runtime cursor support: [packages/runtime/src/index.ts](../packages/runtime/src/index.ts)
- Allocation test plan: [test-plan.md](test-plan.md)
- Measurement hierarchy: [layout-ir-coarsening.md](layout-ir-coarsening.md)
- Hot-path optimization notes: [hot-path-optimization-notes.md](hot-path-optimization-notes.md)
