# Changelog

## 1.2.0

Status: compiler maintainability release with no intended ABI or generated-code behavior changes.

- `validateLayouts` now runs explicit field and layout rule lists instead of one large imperative validator body.
- Dynamic vector writer generation now uses an exhaustive dispatch table over `VectorElementLayout["kind"]`.
- `emitter.ts` has a lightweight tagged-template codegen helper for generated methods.
- Package manifests and workspace lockfile are aligned at `1.2.0`.

## 1.1.0

Status: stable v1 surface plus optional container-boundary helpers.

- Optional `ZENO` frame header helpers in `@zeno/runtime`.
- `analyzeProjectionSourceFile(sourceFile, options)` in `@zeno/compiler`.
- Schema source validation rejects value declarations in `.zeno.ts` files.
- Backwards-compatible `analyzeProjectionFile(program?, sourceFile)` wrapper.

## 1.0.0

Status: stable v1 API for the documented TypeScript-only surface.

### Load-Bearing Scope

- TypeScript-only `.zeno.ts` schema authoring through `@zeno/types`.
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
