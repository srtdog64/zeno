# Performance Comparison

This document records the current Zeno scalar hot-path comparison against plain
baselines.

## Claim Status

| Property                                                                                  | Status       | Reason                                                                                                   |
| ----------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| Buffer-backed storage avoids per-record JS object materialization                         | load-bearing | This is the core Zeno runtime thesis.                                                                    |
| Static generated scalar access can approach direct `DataView` cost                        | candidate    | Current witness supports it, but more workloads and repeated runs are needed.                            |
| Zeno fixed-stride scalar projection can beat FlatBuffers JS table projection on hot scans | candidate    | Current witness supports it for a scalar-only table shape, but payload shape and schema features differ. |
| Cursor reuse is preferable to per-record view allocation                                  | load-bearing | The benchmark shows a large timing difference and avoids retained view arrays.                           |
| Per-record retained `UserView` objects still allocate heap                                | diagnostic   | It is useful for API design, but not the intended hot path.                                              |
| Materialized JS objects retain more heap than view objects                                | diagnostic   | True for this witness, but schema shape can change the exact ratio.                                      |
| Pointer dereference has a separate cost model                                             | candidate    | `pointer32` chasing is benchmarked separately from fixed-stride scalar scans.                            |

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

After the `1.5.0` compiler emitter maintainability pass, the local smoke witness was
rerun with the default benchmark settings:

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

| Comparison                                     |     Median delta |      Pooled std | Status       |
| ---------------------------------------------- | ---------------: | --------------: | ------------ |
| age: static offset vs direct                   |  -0.17 ns/record |  1.18 ns/record | within noise |
| age: static index vs direct                    |  -0.31 ns/record |  2.14 ns/record | within noise |
| age: generated `sumAge` vs direct              |  +0.43 ns/record |  2.48 ns/record | within noise |
| age: cursor `rebase` vs direct                 |  +9.86 ns/record |  5.39 ns/record | above noise  |
| age: cursor `rebaseUnchecked` vs direct        |  +0.20 ns/record |  4.80 ns/record | within noise |
| age: cursor `moveToUnchecked` vs direct        |  -0.87 ns/record |  0.93 ns/record | within noise |
| age: per-record view vs direct                 | +36.35 ns/record | 10.93 ns/record | above noise  |
| scalar mix: static offset vs direct            |  +5.02 ns/record | 10.11 ns/record | within noise |
| scalar mix: static index vs direct             |  +3.69 ns/record |  5.79 ns/record | within noise |
| scalar mix: cursor `rebase` vs direct          | +17.32 ns/record | 14.25 ns/record | above noise  |
| scalar mix: cursor `rebaseUnchecked` vs direct |  +7.11 ns/record | 12.49 ns/record | within noise |

Retained memory:

| Scenario                              | Heap delta over buffer-only | Meaning                                                  |
| ------------------------------------- | --------------------------: | -------------------------------------------------------- |
| Scalar passes after GC                |                 +290.93 KiB | Hot scalar reads leave little retained heap.             |
| Retained `UserView` objects           |                  +10.96 MiB | Per-record views are still an avoid path.                |
| Retained optimized `UserView` objects |                  +17.08 MiB | Optimized cursor offsets still retain more heap.         |
| Retained materialized JS objects      |                  +23.18 MiB | Plain object materialization is heavier in this witness. |

Current conclusion: the `1.5.0` compiler refactor did not intentionally change
generated hot-path behavior. Static accessors remain close to direct `DataView`
in this local witness. Generated `sumAge` is a clean aggregate API boundary but
does not clear the local noise floor as a speed win in this run. Checked cursor
movement remains slower. Per-record view allocation is clearly slower and
retains avoidable heap.

Pointer dereference witness from the same local run:

| Pointer workload                           |  Median |     p95 |     p99 |     Std | Median ns/record |
| ------------------------------------------ | ------: | ------: | ------: | ------: | ---------------: |
| Direct `DataView` signed `pointer32` deref | 0.47 ms | 0.49 ms | 0.53 ms | 0.01 ms |          2.34 ns |
| Cursor `pointer32` `nextInto`              | 1.21 ms | 1.86 ms | 1.93 ms | 0.26 ms |          6.07 ns |

Pointer delta: cursor `nextInto` was +3.73 ns/record over direct `DataView`,
above the pooled noise floor in this run. This is a separate workload from
fixed-stride scalar projection because it measures pointer chasing and cursor
rebasing rather than contiguous record scanning.

## FlatBuffers JS Projection Witness

This comparison exists because Zeno is not trying to beat raw `DataView`.
`DataView` is the lower-level baseline. The more relevant external comparison is
FlatBuffers JS table projection: a generated-style accessor over a vector of
tables.

Witness:

- Zeno shape: fixed-stride inline `UserView` record array.
- FlatBuffers shape: `table User { id: ulong; age: int; score: double; ratio: float; }`
  plus a root `vector<User>`.
- Implementation: manual FlatBuffers generated-class equivalent using the
  official `flatbuffers` npm runtime.
- Command:
  `$env:ZENO_BENCH_RECORDS='1000000'; $env:ZENO_BENCH_RUNS='20'; npm run bench:flatbuffers`
- Date: 2026-05-09

Payload byte counts are diagnostic only. The Zeno fixture currently reuses the
existing 88-byte example view, which includes non-scalar fields not present in
the FlatBuffers table. Use the timing comparison as the load-bearing witness,
not the payload-size comparison.

Timing summary:

| Workload                           | Direct `DataView` | Zeno static/generated | FlatBuffers JS table vector |
| ---------------------------------- | ----------------: | --------------------: | --------------------------: |
| `age` single-field scan            |    5.04 ns/record |   4.87-4.96 ns/record |             18.88 ns/record |
| `u64 + i32 + f64 + f32` scalar mix |   33.33 ns/record |       32.14 ns/record |            105.59 ns/record |

Delta interpretation:

| Comparison             | Median delta vs direct |      Pooled std | Status       |
| ---------------------- | ---------------------: | --------------: | ------------ |
| Zeno static `age`      |        -0.17 ns/record |  0.65 ns/record | within noise |
| Zeno `ageAt`           |        -0.08 ns/record |  0.73 ns/record | within noise |
| Zeno `sumAge`          |        -0.10 ns/record |  0.70 ns/record | within noise |
| FlatBuffers `age`      |       +13.84 ns/record |  1.06 ns/record | above noise  |
| Zeno scalar mix        |        -1.20 ns/record |  6.93 ns/record | within noise |
| FlatBuffers scalar mix |       +72.26 ns/record | 10.55 ns/record | above noise  |

Current conclusion: in this TS/JS hot-read witness, Zeno keeps named schema
access inside the raw `DataView` noise floor, while FlatBuffers JS table
projection is slower by an above-noise margin. This does not make Zeno a
universal FlatBuffers replacement. FlatBuffers still owns cross-language
contracts, mature schema evolution, optional/union/table modeling, and ecosystem
tooling. Zeno's narrow performance claim is fixed-layout TypeScript-only scalar
scans.

## WebGL Instance Streaming Witness

The browser demo compares a WebGL-style instance payload across Zeno binary,
FlatBuffers JS, and JSON objects. The workload is intentionally not a universal
serialization benchmark. It models the path Zeno is built for: many same-layout
records, uploaded into GPU instance matrices without per-record object
materialization.

Witness:

- Schema: 28-byte `Instance` records with `u32`, `u16`, `f32`, and `flags32`
  fields.
- Demo: [examples/webgl-instance-streamer](../examples/webgl-instance-streamer)
- Default workload: 250,000 records, with a 1,000,000-record option and a
  250,000-instance render cap.
- Date: 2026-05-09

Local browser smoke result at 250,000 records:

| Mode           |   Payload |    Build |    Parse | Pack + GPU |
| -------------- | --------: | -------: | -------: | ---------: |
| Zeno binary    |  6.68 MiB |  18.7 ms |     0 ms |    7.20 ms |
| FlatBuffers JS |  8.58 MiB |  98.0 ms |     0 ms |    34.3 ms |
| JSON objects   | 34.45 MiB | 173.4 ms | 168.4 ms |    7.00 ms |

Interpretation: Zeno's win here is not that it is lower-level than `DataView`;
it is that the schema gives named offsets while keeping the payload as one
contiguous fixed-stride binary buffer. JSON pays parse and object materialization
cost. FlatBuffers JS pays table/vector indirection cost. The demo does not claim
better cross-language tooling or schema evolution than FlatBuffers.

## Dynamic Layout Timing

Dynamic descriptors are supported, but the current performance witness does not
promote dynamic string/vector access as a hot-path claim. This benchmark
separates byte-slice access, explicit UTF-8 decode, vector indexing, and writer
throughput.

Command:

```sh
npm run bench:dynamic
```

Run parameters:

- Date: 2026-05-09
- Records: 100,000
- Warmup: 3 runs
- Measured: 25 runs
- Text payload: 20 bytes
- Raw byte payload: 32 bytes

Local Node result:

| Workload                         |   Median |      p95 |      p99 |     Std | Median ns/record |
| -------------------------------- | -------: | -------: | -------: | ------: | ---------------: |
| Direct span bytes `DataView`     |  2.89 ms | 15.03 ms | 15.17 ms | 3.39 ms |         28.92 ns |
| Direct span bytes `Uint8Array`   |  4.40 ms | 15.80 ms | 16.70 ms | 3.31 ms |         44.03 ns |
| Zeno `BytesSpanView.bytes()`     |  7.60 ms | 18.37 ms | 21.11 ms | 4.01 ms |         76.01 ns |
| Direct UTF-8 decode              | 13.62 ms | 16.58 ms | 16.72 ms | 1.96 ms |        136.19 ns |
| Zeno `Utf8SpanView.text()`       | 27.31 ms | 41.06 ms | 43.97 ms | 6.75 ms |        273.08 ns |
| `JSON.parse` string array        |  5.78 ms | 10.53 ms | 20.87 ms | 3.46 ms |         57.81 ns |
| Direct scalar vector `i32`       |  0.13 ms |  0.18 ms |  1.57 ms | 0.29 ms |          1.31 ns |
| Zeno `ScalarVectorView.at(i)`    |  3.48 ms |  4.36 ms |  6.96 ms | 0.83 ms |         34.85 ns |
| Direct bytes vector              |  5.63 ms | 17.54 ms | 17.72 ms | 3.48 ms |         56.31 ns |
| Zeno `BytesVectorView.bytesAt()` |  6.11 ms | 18.87 ms | 23.49 ms | 4.32 ms |         61.07 ns |
| Direct UTF-8 vector decode       | 11.38 ms | 14.50 ms | 15.15 ms | 1.54 ms |        113.79 ns |
| Zeno `Utf8VectorView.textAt(i)`  | 20.32 ms | 22.12 ms | 25.13 ms | 1.62 ms |        203.17 ns |
| Manual `writeUtf8`               | 65.84 ms | 75.85 ms | 79.52 ms | 5.23 ms |        658.41 ns |
| `DynamicLayoutWriter.writeUtf8`  | 77.00 ms | 82.72 ms | 82.74 ms | 3.62 ms |        770.00 ns |
| Manual `writeBytes`              |  3.98 ms |  7.81 ms | 10.17 ms | 1.71 ms |         39.81 ns |
| `DynamicLayoutWriter.writeBytes` | 10.05 ms | 11.39 ms | 16.67 ms | 1.71 ms |        100.47 ns |
| Manual `writeScalarVector`       |  6.38 ms |  7.71 ms |  8.10 ms | 0.88 ms |         63.80 ns |
| `writeScalarVector`              |  9.25 ms | 11.31 ms | 13.23 ms | 1.20 ms |         92.53 ns |

Delta interpretation:

| Comparison                          | Median delta vs direct |      Pooled std | Status       |
| ----------------------------------- | ---------------------: | --------------: | ------------ |
| `BytesSpanView.bytes()` vs DataView |       +47.09 ns/record | 52.47 ns/record | within noise |
| `BytesSpanView.bytes()`             |       +31.97 ns/record | 51.98 ns/record | within noise |
| `Utf8SpanView.text()`               |      +136.89 ns/record | 70.30 ns/record | above noise  |
| `JSON.parse` string array           |       -78.39 ns/record | 39.78 ns/record | above noise  |
| `ScalarVectorView.at(i)`            |       +33.54 ns/record |  8.81 ns/record | above noise  |
| `BytesVectorView.bytesAt(i)`        |        +4.76 ns/record | 55.49 ns/record | within noise |
| `Utf8VectorView.textAt(i)`          |       +89.38 ns/record | 22.31 ns/record | above noise  |
| `DynamicLayoutWriter.writeUtf8`     |      +111.59 ns/record | 63.64 ns/record | above noise  |
| `DynamicLayoutWriter.writeBytes`    |       +60.65 ns/record | 24.18 ns/record | above noise  |
| `writeScalarVector`                 |       +28.73 ns/record | 14.86 ns/record | above noise  |

Current conclusion: the dynamic runtime API is correctness-first and ergonomic,
not yet a promoted hot path. Caching each vector descriptor after the first view
access moves byte vector indexing to within the direct baseline noise, but
string decode and dynamic writer UTF-8 encoding still dominate. Promote dynamic
performance only after byte-slice predicates, generated dynamic scan helpers,
or immutable descriptor snapshot APIs have repeated benchmark witnesses.

## Scalar Read Timing

| Access mode                                     |   Median |      p95 |      p99 |     Std | Median ns/record | Relative median | Allocation shape            |
| ----------------------------------------------- | -------: | -------: | -------: | ------: | ---------------: | --------------: | --------------------------- |
| Direct `DataView.getInt32`                      |  4.78 ms |  5.69 ms |  5.73 ms | 0.53 ms |          4.78 ns |           1.00x | no per-record object        |
| `UserView.getAge(view, offset)` static accessor |  5.31 ms |  7.17 ms |  7.41 ms | 0.82 ms |          5.31 ns |           1.11x | no per-record object        |
| `UserView.getAgeAt(view, index)` index accessor |  6.34 ms |  7.35 ms |  7.70 ms | 0.62 ms |          6.34 ns |           1.33x | no per-record object        |
| One `UserView` cursor with `rebase(offset)`     |  6.38 ms |  7.77 ms |  8.14 ms | 0.75 ms |          6.38 ns |           1.33x | one reusable view object    |
| One `UserView` cursor with `moveTo(index)`      |  5.61 ms |  7.78 ms |  7.98 ms | 0.79 ms |          5.61 ns |           1.17x | one reusable view object    |
| `new UserView(view, offset).age` per record     | 24.57 ms | 31.48 ms | 33.06 ms | 3.41 ms |         24.57 ns |           5.14x | transient object per record |

## Scalar Mix Timing

The scalar mix reads `u64`, `i32`, `f64`, and `f32` from each record.

| Access mode                                                 |   Median |      p95 |      p99 |     Std | Median ns/record | Relative median | Allocation shape         |
| ----------------------------------------------------------- | -------: | -------: | -------: | ------: | ---------------: | --------------: | ------------------------ |
| Direct `DataView` scalar mix                                | 26.65 ms | 31.93 ms | 32.73 ms | 2.53 ms |         26.65 ns |           1.00x | no per-record object     |
| Direct `DataView` with `UserView.*Offset` constants         | 35.92 ms | 40.59 ms | 42.29 ms | 3.31 ms |         35.92 ns |           1.35x | no per-record object     |
| Direct `DataView` with top-level generated offset constants | 36.78 ms | 44.83 ms | 44.91 ms | 3.51 ms |         36.78 ns |           1.38x | no per-record object     |
| Direct `DataView` with hoisted offset constants             | 35.57 ms | 47.07 ms | 56.24 ms | 6.54 ms |         35.57 ns |           1.33x | no per-record object     |
| Zeno static scalar mix                                      | 33.85 ms | 44.30 ms | 46.03 ms | 5.86 ms |         33.85 ns |           1.27x | no per-record object     |
| Zeno static scalar mix with `At` accessors                  | 43.10 ms | 52.08 ms | 54.06 ms | 4.47 ms |         43.10 ns |           1.62x | no per-record object     |
| Zeno cursor scalar mix with `rebase(offset)`                | 45.35 ms | 49.05 ms | 50.55 ms | 3.31 ms |         45.35 ns |           1.70x | one reusable view object |
| Zeno cursor scalar mix with `moveTo(index)`                 | 47.71 ms | 50.97 ms | 51.46 ms | 2.90 ms |         47.71 ns |           1.79x | one reusable view object |

## Noise Floor

The benchmark reports sample standard deviation across repeated runs and compares
median deltas against pooled standard deviation.

| Comparison                                       |     Median delta |     Pooled std | Ratio | Status       |
| ------------------------------------------------ | ---------------: | -------------: | ----: | ------------ |
| age: static offset vs direct                     |  +0.54 ns/record | 0.97 ns/record | 0.55x | within noise |
| age: static index vs direct                      |  +1.56 ns/record | 0.81 ns/record | 1.92x | above noise  |
| age: cursor `moveTo` vs direct                   |  +0.83 ns/record | 0.95 ns/record | 0.88x | within noise |
| age: per-record view vs direct                   | +19.79 ns/record | 3.45 ns/record | 5.74x | above noise  |
| scalar mix: offset constants vs direct           |  +9.27 ns/record | 4.17 ns/record | 2.22x | above noise  |
| scalar mix: top-level offset constants vs direct | +10.12 ns/record | 4.32 ns/record | 2.34x | above noise  |
| scalar mix: hoisted offset constants vs direct   |  +8.91 ns/record | 7.02 ns/record | 1.27x | above noise  |
| scalar mix: static offset vs direct              |  +7.20 ns/record | 6.38 ns/record | 1.13x | above noise  |
| scalar mix: static index vs direct               | +16.45 ns/record | 5.14 ns/record | 3.20x | above noise  |
| scalar mix: cursor `rebase` vs direct            | +18.70 ns/record | 4.16 ns/record | 4.49x | above noise  |

## Retained Memory

| Scenario                      | Heap delta over buffer-only | External memory delta | ArrayBuffer delta | Meaning                                                  |
| ----------------------------- | --------------------------: | --------------------: | ----------------: | -------------------------------------------------------- |
| Raw buffer retained           |     +7.61 KiB over baseline |            +83.92 MiB |        +83.92 MiB | Record bytes live outside JS object heap.                |
| Scalar passes after GC        |                 +146.82 KiB |                   0 B |               0 B | Hot scalar reads leave little retained heap.             |
| Retained `UserView` objects   |                  +53.56 MiB |                   0 B |               0 B | Keeping one view per record is not zero-allocation.      |
| Retained materialized objects |                 +114.59 MiB |                   0 B |               0 B | Plain object materialization is heavier in this witness. |

## Plain Baseline Interpretation

Plain object materialization is the baseline Zeno is trying to avoid. Direct
`DataView` is the lower-level baseline Zeno tries to approach while preserving
TypeScript-native schema authoring.

| Question                             | Plain JS object | Direct `DataView` | Zeno static accessor | Zeno cursor view |
| ------------------------------------ | --------------- | ----------------- | -------------------- | ---------------- |
| TypeScript schema authoring          | no              | no                | yes                  | yes              |
| Per-record object required           | yes             | no                | no                   | no               |
| Named field API                      | yes             | no                | yes                  | yes              |
| Near-direct scalar timing in witness | no              | yes               | yes                  | mostly           |
| Nested/dynamic view API              | manual          | manual            | generated            | generated        |

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

Do not reintroduce cursor offset caching by default. The removed v1 diagnostic
emitter mode did not produce repeated benchmark and retained-heap witnesses.

The latest generated optimized-view witness still does not clear that bar:

- current cursor unchecked scalar mix: `52.75 ns/record`
- optimized cursor unchecked scalar mix: `46.64 ns/record`
- current retained view heap: `10.97 MiB`
- optimized retained view heap: `17.08 MiB`

This latest run still keeps the timing delta inside noise while showing a clear
heap cost, so the default emitter stays unchanged.

## Scan Kernel Witness

Generated number-scalar scan kernels are part of the v2 hot path. The first
kernel is `sum<Field>()`, emitted for scalar fields whose TypeScript value is
`number`.

Latest local witness:

- direct `DataView` age loop: `5.63 ns/record`
- generated `UserView.sumAge`: `6.06 ns/record`
- pooled noise floor: `2.48 ns/record`

This puts the generated sum kernel inside the direct `DataView` noise floor
while removing handwritten offset math from the caller. Do not generalize this
claim to callback scans, dynamic fields, `i64`/`u64`, or boolean counts yet.

## Cross-References

- Benchmark implementation: [packages/bench/index.mjs](../packages/bench/index.mjs)
- FlatBuffers comparison benchmark: [packages/bench/flatbuffers-comparison.mjs](../packages/bench/flatbuffers-comparison.mjs)
- Generated view witness: [examples/basic/src/model.view.ts](../examples/basic/src/model.view.ts)
- Runtime cursor support: [packages/runtime/src/index.ts](../packages/runtime/src/index.ts)
- Allocation test plan: [test-plan.md](test-plan.md)
- Measurement hierarchy: [layout-ir-coarsening.md](layout-ir-coarsening.md)
- Hot-path optimization notes: [hot-path-optimization-notes.md](hot-path-optimization-notes.md)
