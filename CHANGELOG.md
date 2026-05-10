# Changelog

## 2.3.0

Status: layered projection model release.

- Added the Layered Projection Model documentation under `docs/layers/`.
- Linked the layer model from the README so users can choose the lowest layer
  that fits the job.
- Split `emitter.ts` further into writer, static accessor, and cursor/projection
  field emitter layers.
- Added a layer consistency test that verifies the documented layers are linked
  and represented by compiler/runtime surfaces.
- Added `bench:check` to the release gate so fixed-layout, dynamic-layout, and
  FlatBuffers comparison benchmarks must execute before publish.
- Package manifests and workspace lockfile are aligned at `2.3.0`.

## 2.2.0

Status: binary table scan and layout tooling minor release.

- Added `zeno-codegen --scan-kernels=none|sum|basic|full` so generated scan
  kernel surface can be controlled per schema.
- Moved scan kernel emission into an explicit compiler layer instead of keeping
  it as helper code inside the main emitter.
- Added `zeno-codegen --manifest`, `zeno-inspect`, and `zeno-diff-layout` for
  layout review and version-routed migration checks.
- Added layout manifest validation for `zeno-diff-layout` input files.
- Added the scalar-only example to show Zeno's fixed-layout hot path without
  dynamic tail fields.
- Consumer smoke now verifies packed `zeno-inspect`, `zeno-diff-layout`, and a
  manifest round trip.
- Documented that `layoutHash` is a deterministic compatibility fingerprint,
  not a cryptographic integrity hash.
- Package manifests and workspace lockfile are aligned at `2.2.0`.

## 2.1.0

Status: browser/runtime/compiler observability minor release.

- Added decode-free text byte predicate helpers:
  `bytesEqual`, `equalsAscii`, and `startsWithAscii`.
- Added `ScalarVectorView.nativeArray()` for zero-copy native `TypedArray`
  projection when scalar kind, host endian, and payload alignment make it safe.
- Source maps now collect generated class, interface, const, and member mapping
  points from the generated TypeScript AST instead of substring-scanning lines.
- Browser smoke now emits structured per-mode benchmark metrics for the WebGL
  demo and verifies a nonblank WebGL visual sample.
- Added a synthetic AST emitter utility for future emitter migration work while
  keeping the default generated view formatting stable.
- Split repeated emitter naming/literal helpers into `emitter-names.ts`.
- Package manifests and workspace lockfile are aligned at `2.1.0`.

## 2.0.0

Status: v2 API cleanup release.

- Breaking: dynamic and fixed string vector `at(i)` now returns the zero-copy
  `Uint8Array` byte view. Use `textAt(i)` or `textArray()` for explicit
  UTF-8/ASCII decoding and JS string allocation.
- Breaking: fixed string array `at(i)` now returns the zero-copy `Uint8Array`
  byte view. Use `textAt(i)` or `textArray()` for explicit decoding.
- Breaking: removed the retired `--optimize-cursor-offsets` CLI/emitter path.
  Static accessors and generated scan kernels remain the supported hot path.
- Analyzer lowering no longer writes completed layouts through a shared
  `state.layouts` side effect; `lowerStruct` returns layout plus diagnostics
  explicitly.
- Validator field rules dispatch by `FieldLayout.kind` instead of running every
  field-specific rule against every field.
- Generated view output now passes through a TypeScript AST parse boundary
  before being returned or written, so emitter syntax errors fail inside the
  compiler.
- Added generated-code compile/run fuzz tests, a frozen v1 layout compatibility
  fixture, hostile malformed-descriptor property tests, and a Node worker
  SharedArrayBuffer writer stress gate.
- Added a Playwright browser smoke workflow for the WebGL demo across Chromium
  and Firefox.
- Added schema grammar acceptance/rejection tests so grammar docs and compiler
  behavior do not drift silently.
- Repaired the Korean schema grammar document and added it to the format gate.
- Documented `VectorView`'s live-view plus cached-descriptor contract at the
  runtime boundary.
- Layout IR `source` locations remain enumerable; tests explicitly strip them
  when snapshotting source-independent layout shape.
- Package manifests and workspace lockfile are aligned at `2.0.0`.

## 1.9.0

Status: dynamic struct vector read/write codegen release.

- Added `z.dynamicVector<T>` / `dynamic_vector<T>` for `Vector32` offset-table
  vectors of dynamic struct records.
- Lowering now emits a `dynamic-struct` vector element layout for
  `dynamicVector<Struct>`.
- Generated views now return `DynamicStructVectorView<TView>` for dynamic
  struct vectors.
- Runtime tests cover dynamic struct vector offset-table reads and writes.
- Generated writers now emit `writeDynamicStructVector*` calls for
  `dynamicVector<Struct>` fields, with nested descriptors written relative to
  each element base.
- `SharedDynamicLayoutWriter` now supports
  `writeDynamicStructVectorPublished(...)` for SharedArrayBuffer pipelines that
  publish dynamic struct vectors through descriptor-ready cells.
- Validator field rules now dispatch by `FieldLayout.kind` instead of running
  every field-specific rule against every field.
- Layout IR `source` locations are enumerable; tests explicitly strip them when
  snapshotting source-independent layout shape.
- `Utf8VectorView.textAt(i)` is the explicit text-decoding API for dynamic
  string vectors. The v1-compatible `at(i)` alias remains but is deprecated in
  docs/types because it allocates a JavaScript string.
- Optional/sparse fields and discriminated unions remain schema-evolution design
  work; varint/LEB128 remains a non-goal for Zeno's fixed-offset projection
  thesis.
- Package manifests and workspace lockfile are aligned at `1.9.0`.

## 1.8.0

Status: browser/data-pipeline minor release for shared-memory arenas and generated source maps.

- Added `SharedDynamicLayoutWriter`, `sharedArenaCursorCell(...)`, and
  `sharedArenaView(...)` for `SharedArrayBuffer`-backed browser worker
  pipelines with an atomic shared tail cursor.
- Added shared descriptor state cells and `*Published(...)` writer methods so
  `span32`/`vector32` descriptors are published after payload writes with an
  explicit atomic ready flag.
- Kept plain descriptor-writing methods off the shared writer public surface;
  shared writers coordinate tail reservation and published descriptors only.
- Added shared arena shard helpers for low-contention worker append paths
  without changing the synchronous `reserve(...)` contract.
- Added compiler `--source-map` support and
  `emitProjectionFileWithSourceMap(...)` for field-level generated `.view.ts`
  source maps back to `.zeno.ts` schema fields.
- Added a WebGL instance streaming demo comparing Zeno binary, FlatBuffers JS,
  and JSON object payloads at larger browser-facing record counts.
- Documented WebGL demo benchmark results in the performance comparison notes.
- Added a dynamic-layout benchmark for byte slices, UTF-8 decode, vector access,
  and writer throughput; current dynamic performance remains diagnostic rather
  than a promoted hot-path claim.
- Package manifests and workspace lockfile are aligned at `1.8.0`.

## 1.7.0

Status: v1 completion release for semantic aliases and inline fixed arrays.

- Added semantic scalar aliases: `z.enumU8<T>`, `z.enumU16<T>`, `z.flags8`,
  `z.flags32`, and `z.timestampMs`; these lower to existing scalar ABI kinds.
- Added `z.fixedArray<T, N>` / `fixed_array<T, N>` for inline fixed-layout
  arrays over scalar, fixed bytes/string, and fixed-size struct elements.
- Added runtime fixed-array projection views and object-writer support for
  supported fixed-array fields.
- Documented optional fields, unions, packed bitsets, and graph/object
  serialization as v2 design work.
- Package manifests and workspace lockfile are aligned at `1.7.0`.

## 1.5.0

Status: compiler emitter maintainability release with no intended public API changes.

- Expanded the emitter tagged-template DSL to instance pointer accessors and top-level generated view class scaffolding.
- Kept generated-code snapshots stable while reducing the remaining large manual `lines.push(...)` blocks in `emitStructClass`.
- Package manifests and workspace lockfile are aligned at `1.5.0`.

## 1.4.0

Status: compiler maintainability release with no intended public API changes.

- Split vector element lowering into syntax validation, reference dispatch, and focused scalar/fixed/dynamic/pointer/struct element helpers.
- Expanded the emitter tagged-template DSL to object writers and non-pointer instance field accessors.
- Kept generated-code snapshots stable while reducing manual `lines.push(...)` blocks in the compiler.
- Package manifests and workspace lockfile are aligned at `1.4.0`.

## 1.3.0

Status: v1 hardening release for boundary validation, schema rejection, and compiler maintainability.

- Added `assertZenoFramePayload(...)` and `checkedZenoFramePayloadView(...)` for checked file/network payload boundaries.
- Optional property syntax is now rejected explicitly until schema evolution has a vtable/presence ABI.
- Added rejected grammar witnesses for optional fields and union fields in English and Korean docs.
- Added schema evolution notes for optional fields and discriminated unions.
- Added cyclic pointer traversal budget tests.
- Expanded the emitter tagged-template DSL to scan kernels and static pointer accessors.
- Split `lowerTypeNode` into semantic lowering helpers for syntax, scalar, fixed, dynamic, vector, pointer, and struct references.
- Marked `--optimize-cursor-offsets` as experimental in CLI usage.
- Added a release checklist for scoped public package publishing.

## 1.2.0

Status: compiler maintainability release with no intended ABI or generated-code behavior changes.

- `validateLayouts` now runs explicit field and layout rule lists instead of one large imperative validator body.
- Dynamic vector writer generation now uses an exhaustive dispatch table over `VectorElementLayout["kind"]`.
- `emitter.ts` has a lightweight tagged-template codegen helper for generated methods.
- Package manifests and workspace lockfile are aligned at `1.2.0`.

## 1.1.0

Status: stable v1 surface plus optional container-boundary helpers.

- Optional `ZENO` frame header helpers in `@exornea/zeno-runtime`.
- `analyzeProjectionSourceFile(sourceFile, options)` in `@exornea/zeno-compiler`.
- Schema source validation rejects value declarations in `.zeno.ts` files.
- Backwards-compatible `analyzeProjectionFile(program?, sourceFile)` wrapper.

## 1.0.0

Status: stable v1 API for the documented TypeScript-only surface.

### Load-Bearing Scope

- TypeScript-only `.zeno.ts` schema authoring through `@exornea/zeno-types`.
- AST and type-checker analysis into Layout IR.
- Generated `DataView` projection classes with static scalar accessors and reusable cursor views.
- Fixed-size scalar, fixed byte/string, nested fixed struct, and endian-aware accessor generation.
- Structured compiler diagnostics with Result-style internal failure handling.
- Measurement hierarchy for unsupported constructs and validation failures.

### Stable Dynamic And Pointer APIs

- `Span32` dynamic UTF-8/bytes descriptors.
- `Vector32` vectors for scalar, fixed bytes/string, dynamic bytes/string, fixed struct, and pointer elements.
- Generated object writers for fixed fields plus supported dynamic tail fields.
- Explicit recursive references through `z.pointer<T>` / `pointer32`.
- Pointer vector views and writers.
- Pointer chain traversal helpers with explicit traversal budgets.

### Stabilization Witnesses

- `npm run check` passes build, tests, and basic codegen fixtures.
- Runtime tests cover malformed span, vector, dynamic vector, and pointer vector
  descriptor failures, including seed-fixed pseudo-fuzz mutations.
- Compiler snapshots cover Layout IR, emitted view code, and representative rejected-source diagnostics.
- Allocation regression tests cover scalar helper scans and cursor rebase scans under a conservative retained-heap budget.
- Package dry-runs expose only root package exports and publish only `dist/`, plus the compiler CLI `bin/`.
- Packed consumer smoke installs all tarballs into a fresh project, runs codegen,
  compiles generated code, executes runtime read/write behavior, and verifies
  deep imports are rejected.
- Schema compatibility policy documents that layout-changing edits are breaking
  in v1.

### Not Yet Stable

- Schema evolution and optional/vtable layout.
- Cross-language code generation.
- General unions and optional fields.
- Object graph allocation/serialization for pointer-linked data.
- Fuzz/property corpus beyond deterministic malformed descriptor cases.
- Performance claims for dynamic strings/vectors beyond local benchmark witnesses.

## 0.1.0

Status: internal release candidate superseded by `1.0.0`.
