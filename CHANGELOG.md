# Changelog

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
