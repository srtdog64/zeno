# TODO

## Non-negotiables

- pure TypeScript-first authoring
- projection-first API
- materialization-explicit API
- TS toolchain-native generation
- ABI-first internal layout IR

## Terminology to keep precise

- `zero-copy`: scalar reads, byte spans, and subviews can read directly from the backing buffer
- `zero-materialization`: the default API must not build plain JS object graphs
- `zero-allocation`: a hot-path target for scalar and view access, not a guarantee for string decode or explicit materialization

## Product rules

- no separate IDL such as `.proto` or `.fbs`
- no runtime schema object required from the user
- no `Proxy` on the hot path
- no implicit `string` decode for dynamic text fields
- no implicit JS array materialization for vectors

## Schema authoring

Grammar references: [schema-grammar.md](schema-grammar.md) and
[schema-grammar.ko.md](schema-grammar.ko.md). Any new accepted or rejected
schema construct must update both grammar documents before implementation is
considered complete.

### Must support

- `interface` and `type` based authoring
- branded or aliased scalar types such as `i32`, `u32`, `f32`, `u64`
- bare `string` as the default dynamic UTF-8 text type
- `bytes` as the default dynamic raw payload type
- fixed-width binary-friendly string and byte types
- dynamic string and vector marker types
- nested struct composition
- explicit `pointer<T>` fields for relative references and recursive shapes

### Must reject early

- bare `number` where ABI width is ambiguous
- open-ended `T[]` without an explicit vector type
- direct recursive layouts without `pointer<T>` indirection
- unsupported union forms without a discriminator rule

## Runtime API

### Internal layers

- narrow runtime ABI files own one concern each: range checks, scalar codecs,
  `descriptor32`, fixed bytes/text, and `pointer32`
- `abi.ts`, `views.ts`, and `writer.ts` are public-facing barrels, not mixed
  helper modules
- view files separate cursor base, span views, vector base, byte/scalar/struct
  vectors, pointer vectors, and traversal
- writer files separate tail arena, span writing, byte/scalar/struct vector
  writing, and pointer vector writing
- `index.ts` is the public root export surface

### Projection-first

- generated classes expose scalar getters directly
- fixed-size nested structs return subviews
- dynamic strings expose `bytes()` and explicit `text()` decode
- dynamic bytes expose raw byte slices without text decode
- vectors expose a generated view with `length` and `at(i)`
- low-level dynamic writer owns tail cursor movement and descriptor patching
- generated object writer writes fixed fields plus supported dynamic tail fields

### Materialization-explicit

- generated views may expose `.materialize()`
- `.materialize()` is the only API that is allowed to build plain JS object graphs by default
- benchmarks must separate projection cost from materialization cost

## Wire layout

### Fixed-only schemas

- packed fixed-layout struct projection
- alignment and padding policy defined in the IR and tested

### Dynamic schemas

- head plus tail arena format
- head stores scalar fields plus descriptors
- span and vector descriptors are relative, never absolute
- string descriptor shape: `Span32 { relOffset, byteLength }`
- vector descriptor shape: `Vector32 { relOffset, count }`
- pointer descriptor shape: `pointer32` stores a signed field-relative offset, with raw `0xffffffff` as null
- string/vector payload bytes live in the tail arena
- optional vtable support is postponed until sparse/versioned schema work

## Compiler pipeline

### Phase 0: Internal IR

- define stable layout IR types
- represent scalar, fixed bytes, fixed string, struct, span, vector, and pointer descriptors
- encode alignment, byte length, and endianness in the IR
- snapshot-test IR output before emitter work expands

### Phase 1: Analyzer and validation

- traverse TS source with Compiler API
- resolve symbols with type checker
- lower supported declarations into layout IR
- emit deterministic diagnostics for unsupported patterns

### Phase 2: Code generation

- generate view classes from IR
- inline offsets into getters/setters
- generate nested subview accessors
- generate dynamic string and vector view helpers
- generate object-level writer helpers for supported fields, including fixed-size `vector<struct>` and `vector<pointer<T>>` elements
- avoid reflective lookup tables on the hot path

### Phase 3: Toolchain integration

- support standalone codegen first
- generate `.view.ts` or equivalent stable output
- then integrate with `tsc`, Vite, and bundlers
- avoid requiring a separate CLI workflow for normal use

## Performance rules

- do not use `Proxy` for field access
- do not create `{ offset, length, buffer }` wrapper objects per access
- do not decode text eagerly
- do not allocate JS arrays for vector iteration by default
- favor monomorphic generated classes and predictable getter code

## Test gates

### Gate 1: Layout correctness

Status: satisfied for v2.

- IR snapshots for supported schemas: done for representative schemas
- diagnostics snapshots for rejected schemas: done for representative rejected source schemas
- alignment, padding, and offset math verified: covered by analyzer and validator tests

### Gate 2: Emitter correctness

Status: satisfied for v2.

- generated code golden tests: done for a representative schema
- emitted code compiles under `tsc`: covered by `npm run check`
- imports and helper usage stay stable: covered by snapshot and analyzer tests

### Gate 3: Runtime correctness

Status: satisfied for current supported surface.

- raw byte fixtures read correctly through generated views
- writes patch the correct offsets
- nested structs compose offsets correctly
- pointer vector writes can validate target ranges when the target byte length is known

### Gate 4: Dynamic layout correctness

Status: satisfied for v2.

- `Span32` string descriptors resolve correctly
- `Vector32` descriptors resolve correctly
- vector-of-strings follows descriptor-table plus payload rules
- malformed offsets fail safely
- explicit `pointer32` references have checked and unchecked target offset APIs

### Gate 5: Allocation behavior

Status: satisfied for v1 with a conservative retained-heap budget.

- scalar projection steady-state retained heap stays within the regression budget
- cursor rebase scans stay within the retained heap regression budget
- subview and byte-slice access stays near zero: benchmarked, not separately asserted
- explicit text decode cost is measured separately
- explicit materialization cost is measured separately

### Gate 5A: Package consumer smoke

Status: satisfied for v2.

- packed tarballs install into a fresh consumer project
- `zeno-codegen --help` works through the installed compiler bin
- generated code compiles with package-root imports
- runtime execution reads and writes through the generated view
- deep runtime subpath imports are rejected

### Gate 6: Throughput benchmarks

Status: local witness only.

- compare against plain object decode
- compare against JSON parse baseline
- compare against typia or equivalent optimized decoder
- compare against hand-written `DataView` access
- keep pointer dereference benchmark separate from fixed-stride scalar scans

## Immediate next tasks

- tag and publish `2.0.0` after human release review
- keep publishing under the owned `@exornea/zeno-*` package family
- keep the publish order explicit: `@exornea/zeno-types`, `@exornea/zeno-schema`,
  `@exornea/zeno-runtime`, then `@exornea/zeno-compiler`
- keep [performance-comparison.md](performance-comparison.md) synced when
  benchmark code or generated hot-path code changes
- use [release-checklist.md](release-checklist.md) as the release gate before
  tagging or publishing
- keep [schema-grammar.md](schema-grammar.md) and
  [schema-grammar.ko.md](schema-grammar.ko.md) in sync with every new accepted
  or rejected schema construct

## Completed in 1.3

- `emitter.ts` tagged-template DSL now covers dynamic writers, vector writers,
  static pointer accessors, and scalar `sum<Field>()` kernels.
- `lowerTypeNode` is split by semantic boundary: syntax, scalar, fixed,
  dynamic, vector, pointer, and struct references.
- `--optimize-cursor-offsets` was retired from the default release and benchmark
  paths.
- optional frame payload boundaries are covered by `assertZenoFramePayload(...)`
  and `checkedZenoFramePayloadView(...)`.
- cyclic pointer traversal has an explicit budget failure test.
- `writePointerVector` requires `targetByteLength`; there is no implicit
  unchecked raw writer path.
- optional fields and union fields have rejected grammar witnesses in both
  grammar documents.
- optional fields are rejected by the compiler until a schema-evolution ABI
  exists.
- [schema-evolution.md](schema-evolution.md) records the optional/union design
  boundary.
- [release-checklist.md](release-checklist.md) records scoped public publish
  order and dry-run gates.

## Completed in 1.4

- `lowerVectorElement` is split by semantic boundary: syntax validation,
  reference dispatch, scalar, fixed, dynamic, pointer, and struct element
  lowering.
- `emitter.ts` tagged-template DSL now covers object writers and non-pointer
  instance field accessors.
- generated-code golden snapshots stayed stable through the compiler
  maintainability refactor.

## Completed in 1.5

- `emitter.ts` tagged-template DSL now covers instance pointer accessors and
  top-level generated view class scaffolding.
- generated-code golden snapshots stayed stable through the remaining class
  scaffold refactor.

## Completed in 1.7

- supported ABI aliases without changing underlying scalar layout:
  - `z.enumU8<T>` / `enum_u8<T>` -> `u8`
  - `z.enumU16<T>` / `enum_u16<T>` -> `u16`
  - `z.flags8` / `flags8` -> `u8`
  - `z.flags32` / `flags32` -> `u32`
  - `z.timestampMs` / `timestamp_ms` -> `i64`
- generated accessors stay typed by the underlying scalar value type.
- `z.fixedArray<T, N>` / `fixed_array<T, N>` is supported for fixed-layout
  scalar, fixed bytes/string, and fixed-size struct elements.
- fixed arrays stay distinct from dynamic `z.vector<T>` descriptors: fixed arrays are
  inline head bytes, vectors are tail descriptors
- analyzer, validator, emitter, runtime view/writer, grammar, and test witnesses
  cover the new fixed-array ABI surface.

## V2 Deferred Design

- optional fields: needs vtable/schema-evolution ABI
- unions: needs discriminant and fixed variant table ABI
- packed bool/bitset: reduces memory but adds ABI and accessor complexity
- graph/object serializer: pointer is a projection primitive; graph allocation
  and serialization is a separate design
- FP ULP boundaries: keep as a diagnostic schema-migration candidate for future
  `f64`/`f32` conversion, quantization, or cross-runtime conformance work; do
  not expose this as a runtime API while Zeno only projects existing
  `DataView` float bits without numeric transformation

## Completed in 1.9

- `z.dynamicVector<T>` / `dynamic_vector<T>` is supported for offset-table
  vectors of dynamic struct records.
- generated dynamic struct vector views use `DynamicStructVectorView<TView>`.
- generated writers emit `writeDynamicStructVector*` and preserve element-local
  descriptor bases for nested dynamic fields.
- `SharedDynamicLayoutWriter` can publish dynamic struct vectors through the
  existing descriptor-ready cell contract.
- validator field checks dispatch by `FieldLayout.kind` so field-specific rules
  do not run against unrelated field kinds.
- Layout IR `source` locations are enumerable; snapshots strip source metadata
  explicitly when testing source-independent shape.
- dynamic/fixed string vector APIs expose `textAt(i)` as the explicit decode
  boundary; in v2, `at(i)` returns the zero-copy byte view for string vectors.
- `--optimize-cursor-offsets` is removed from the public CLI and emitter.

## Completed in 2.0

- dynamic and fixed string vector `at(i)` now returns the zero-copy byte view;
  use `textAt(i)` or `textArray()` for decoding.
- fixed string array `at(i)` now returns the zero-copy byte view; use
  `textAt(i)` or `textArray()` for decoding.
- the retired cursor-offset optimizer is removed from CLI, emitter, release
  scripts, and benchmark entrypoints.
- analyzer struct lowering returns explicit layout plus diagnostics instead of
  writing completed layouts through a shared `state.layouts` side effect.
- schema grammar docs now have compiler acceptance/rejection tests that cover
  the documented supported and rejected examples.
- the Korean schema grammar document is valid UTF-8 and included in the format
  gate.
- `VectorView` documents its live payload view plus cached descriptor contract;
  descriptor rewrites require `refreshDescriptor()` after a publication
  boundary.

## Completed in 1.8

- source maps are a compiler surface through `--source-map` and
  `emitProjectionFileWithSourceMap(...)`
- WebGL instance streaming demo compares Zeno binary, FlatBuffers JS, and JSON
  browser payloads at larger record counts
- dynamic-layout benchmark separates byte-slice access, UTF-8 decode, vector
  indexing, and dynamic writer throughput
- `SharedDynamicLayoutWriter` uses a shared atomic tail cursor instead of a
  per-instance local cursor
- shared descriptor publication uses explicit `Int32Array` ready cells and
  `*Published(...)` writer methods; plain descriptor-writing methods are not
  exposed on the shared writer
- shared atomic control cells are documented as host-native control words,
  separate from serialized Zeno ABI fields
- the shared writer public surface uses composition instead of overriding
  normal `DynamicLayoutWriter` methods with runtime throws
- shared arena sharding provides the high-contention path instead of adding
  backoff to synchronous `reserve(...)`

## v2.1 Candidate Work

### Compiler maintainability

- continue migrating small `emitter.ts` declaration emitters from manual
  `lines.push(...)` blocks when the change removes real friction
- keep large AST switches when they directly mirror TypeScript syntax; do not
  split them only to satisfy a line-count target
- keep `emitField`'s large switch intentionally until a dispatch table removes
  real friction; if it stays, add an in-code note explaining that it mirrors the
  Layout IR kind surface
- align fixed-array emitter branching with the vector-writer dispatch-table
  style when that reduces local complexity
- formatting enforcement is active through Prettier and ESLint; keep the policy
  minimal and avoid broad lint churn
- source maps are now a v2 compiler surface through `--source-map`; keep the
  current contract coarse and field-level until a generated AST emitter can
  justify statement-level mappings

### Performance surface

- keep removed cursor offset caching out of the public CLI unless a new design
  clears the benchmark and retained-heap promotion gate
- promote generated scan kernels as the main aggregate hot path, not optimized
  cursor offsets
- add generated scan kernel candidates only after `sum<Field>()` has repeated
  benchmark witnesses:
  - `min<Field>()` / `max<Field>()` for number scalar fields
  - `count<Field>()` for `bool` fields
  - `count<Field>WhereEq(...)` and `findFirst<Field>WhereEq(...)` for scalar
    equality predicates
- keep checked cursor APIs for safety and unchecked cursor APIs for caller-proven
  loops; benchmark them separately
- add text byte predicate candidates that avoid JS `string` decode and allocation:
  `equalsAscii`, `startsWithAscii`, and byte-slice comparison helpers for
  `z.ascii`, `z.utf8`, and bare `string` descriptors
- add a homogeneous scalar vector fast-path candidate for `z.vector<z.f32>`,
  `z.vector<z.i32>`, and related scalar vectors using `TypedArray` views only
  when endian/alignment/browser witnesses are explicit
- add browser benchmark smoke runs for generated static accessors and scan
  kernels, because Node/V8 local witnesses are not browser guarantees
- `VectorView` caches its descriptor after the first access and exposes
  `refreshDescriptor()` for descriptor rewrite boundaries; keep this contract
  explicit whenever shared-memory publication or live descriptor mutation is
  discussed
- keep the WebGL instance demo benchmark in
  [performance-comparison.md](performance-comparison.md), not only as a TODO;
  rerun it when the demo schema or render cap changes

### Runtime and ABI safety

- keep runtime hot-path range failures as `RangeError`; document any new boundary
  API separately from projection methods
- SharedArrayBuffer-backed writers have atomic cursor and descriptor-ready cells
  in v2; add a full producer/consumer worker example if the WebGL demo needs
  live cross-thread writes instead of prebuilt buffers
- add a malformed-buffer corpus once deterministic inline fixtures become too
  large for focused unit tests
- expand property-based tests from descriptor/runtime roundtrips to generated
  random schema roundtrips before promoting production-readiness claims

### Schema and grammar

- `z.dynamicVector<T>` is implemented for read/write codegen over dynamic struct
  elements; add malformed offset-table fixtures before expanding the ABI family
- design optional fields as a schema-evolution feature, not as nullable inline
  fields
- design discriminated unions with an explicit tag field and fixed variant
  table before accepting any union syntax
- keep varint / LEB128 retired unless Zeno explicitly adds a compressed
  non-projection ABI family
- decide whether bare `string` remains a supported shorthand or becomes a
  diagnostic hint toward `z.utf8`
- add witness cases to both grammar docs for every newly rejected construct

### Test and release gates

- add a malformed-buffer corpus directory once fuzz cases exceed deterministic
  inline fixtures
- keep generated-code golden snapshots representative rather than exhaustive;
  add a new golden only when a new ABI family appears
- add a browser bundle smoke test before claiming browser-ready distribution
- keep PR CI green for lint, format, release check, and WebGL example build

### Examples

- split examples by user-facing workload instead of growing `basic`:
  - `examples/scalar-only`: fixed record hot-path scans
  - `examples/dynamic`: strings, bytes, vectors, and writer tail layout
  - `examples/recursive`: pointer-based graph projection
  - `examples/webgl-instance-streamer`: large WebGL instance projection with
    Zeno, FlatBuffers, and JSON comparison

## Deferred tasks

- sparse/versioned records with vtable-style metadata
- schema evolution guarantees
- grammar additions for discriminated unions and optional fields
- browser-focused bundle verification
- fuzzing and malformed buffer corpus expansion
