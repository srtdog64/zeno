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

Grammar references: [schema-grammar.md](../human/schema-grammar.md) and
[schema-grammar.ko.md](../human/schema-grammar.ko.md). Any new accepted or rejected
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
- read the restricted `.zeno.ts` schema grammar from TypeScript syntax
- resolve supported Zeno marker references without turning TypeScript inference
  into an implicit ABI policy
- lower supported declarations into Layout IR
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

Status: satisfied for the current scalar/view hot-path surface with a
conservative retained-heap budget.

- scalar projection steady-state retained heap stays within the regression budget
- cursor rebase scans stay within the retained heap regression budget
- subview and byte-slice access stays near zero: benchmarked, not separately asserted
- explicit text decode cost is measured separately
- explicit materialization cost is measured separately

### Gate 5A: Package consumer smoke

Status: satisfied for v2.5.

- packed tarballs install into a fresh consumer project
- `zeno-codegen --help` works through the installed compiler bin
- `zeno-inspect` and `zeno-diff-layout` work through the installed compiler bin
- generated layout manifests round-trip through the packed CLI tools
- generated code compiles with package-root imports
- runtime execution reads and writes through the generated view
- deep runtime subpath imports are rejected

### Gate 6: Throughput benchmarks

Status: satisfied as a diagnostic release gate.

- fixed-layout, dynamic-layout, and FlatBuffers comparison workloads run through
  `bench:check`
- exact timing thresholds remain diagnostic because local and CI hardware noise
  is high
- pointer dereference benchmark stays separate from fixed-stride scalar scans

## Immediate next tasks

- publish `2.9.0` after release review if the Geukbit dogfood boundary and
  fixed-record table reuse surface remain the right release boundary
- keep publishing under the owned `@exornea/zeno-*` package family
- keep the publish order explicit for future releases:
  `@exornea/zeno-types`, `@exornea/zeno-schema`, `@exornea/zeno-runtime`,
  `@exornea/zeno-buffers`, then `@exornea/zeno-compiler`
- use [release-checklist.md](../reference/release-checklist.md) as the release gate before
  tagging or publishing future versions
- keep human-facing docs short and route long maintainer context through
  [expanded-readme.md](expanded-readme.md), [documentation-rules.md](documentation-rules.md),
  and reference docs instead of growing the root README again

## v2.9 Geukbit Dogfood Boundary

- Absorb only generic lower-layer patterns from Geukbit-style engine/editor
  dogfooding. Do not absorb Geukbit domain concepts.
- Keep accepted names in Zeno's vocabulary: fixed record table, row, stride,
  byte length, offset, typed-array output, pack plan, dirty range.
- Keep rejected names out of core APIs: scene, entity, component, renderer,
  Three.js, WebGPU, Geukbit, ECS, asset loader, hierarchy, inspector.
- `@exornea/zeno-buffers` may own reusable fixed-row buffer utilities such as
  `createFixedRecordTable(byteLength, initialCapacity?)`.
- `@exornea/zeno-buffers` must still not own renderer upload, scene graphs,
  UI/editor state, ECS behavior, or asset loading.
- Bench fixed-record table reuse separately from scan speed. The benchmark
  should model repeated compile-frame buffer allocation and show whether
  reusable buffers reduce allocation pressure.
- If a future Geukbit adapter needs domain-specific behavior, implement it in
  Geukbit behind a port. Promote only repeated dependency-free buffer patterns
  back into Zeno.

## v2.8 Hot-Path Follow-Up

- Treat `assertRecordRange(view, count, baseOffset?)` plus
  `moveToUnchecked(index)` as the official checked-once cursor-loop pattern.
- Treat `createF32PackPlan` / `createUintPackPlan` plus `pack*Plan...` as the
  primary `@exornea/zeno-buffers` hot path. `pack*Fields...` helpers are
  convenience wrappers.
- Treat `ScalarVectorView.nativeArray()` as the scalar-vector hot path when
  endian and alignment are native-safe.
- Keep descriptor-level `span*Ascii` helpers as the dynamic text predicate
  experiment before promoting any dynamic text claim.
- Keep per-record `new View(...)` creation documented as a hot-loop
  anti-pattern.
- Keep dynamic text out of the strongest hot-path claim; prefer byte predicates
  such as `equalsAscii`, `startsWithAscii`, `endsWithAscii`, `includesAscii`,
  and `hashBytes` before explicit `text()` decode.
- Do not cache `text()` on live views. If a snapshot string API is needed later,
  design it as an explicit materialization layer.
- Revisit fixed-string generated predicates only if real workloads show repeated
  fixed ASCII comparisons that cannot be served by existing byte accessors.

## Technical Debt Policy

### Complexity posture

- Zeno is intentionally a small but complex infrastructure project. Do not
  collapse load-bearing layers only to make the repository look simpler.
- Reduce accidental complexity: duplicated routing, unclear package boundaries,
  unsupported claims, dead flags, hidden generated-code behavior, and missing
  tests.
- Keep load-bearing complexity: Layout IR, runtime/compiler/package separation,
  explicit docs, manifest/diff tooling, renderer-buffer examples, and benchmark
  witnesses.
- Prefer "make the layer boundary explicit" over "merge layers" when a critique
  says the project is over-engineered.

### Must block now

- do not add `Result<T, E>` to runtime hot projection paths. Generated scalar
  getters, scan kernels, cursor movement, and tight vector access loops must
  stay value-returning APIs.
- keep unsupported use cases explicit in README and docs: cross-language
  protocols, public network contracts, schema-evolution-heavy storage,
  arbitrary nested object serialization, and security-critical untrusted binary
  parsing are not Zeno's target.
- keep shared writer contracts precise. Do not imply that a single shared tail
  cursor is the high-contention worker-pool design; use shard-first guidance and
  descriptor publication rules.
- keep `pack:check`, `consumer:smoke`, and `release:check` healthy. Published
  package contents, installed CLI behavior, root-only exports, and deep-import
  rejection are release-blocking surfaces.
- malformed buffers must fail closed with `RangeError` at runtime boundaries.
  Do not silently clamp, wrap, or partially materialize invalid descriptors.

### Evidence-gated work

- codegen DX wrapper: CLI-first is acceptable for the current release, but
  adoption needs a lower-friction workflow. Candidate surfaces are `zeno dev`
  watch mode, a Vite plugin, an esbuild plugin, or a tsup integration. Promote
  only when the wrapper preserves explicit generated files, manifest output, and
  deterministic diagnostics instead of hiding layout changes.
- browser `SharedArrayBuffer` barrier: keep SAB support advanced, not core.
  Browser users need COOP/COEP and cross-origin isolation before SAB works.
  Document fallback paths that use plain `ArrayBuffer`, generated views, and
  non-shared typed-array packing for apps that cannot adopt isolation headers.
- performance claim boundary: keep the promoted claim on fixed-layout scalar
  scans and renderer-facing pack/histogram workloads. Dynamic text, dynamic
  vectors, pointer-heavy traversal, and shared-memory publication remain
  diagnostic until each has its own benchmark witness, p95/p99 noise notes, and
  allocation/GC notes.
- hostile buffer corpus: inline malformed descriptor tests are not enough for
  long-term trust. Add a `tests/corpus/malformed` suite covering span offset
  overflow, vector count overflow, descriptor length overflow, pointer target
  OOB, frame hash mismatch, and truncated buffers. Every case must fail closed
  without silent clamp, wrap, or partial materialization.
- CI version matrix: add Node LTS coverage for at least two active LTS lines
  once publish confidence matters more than CI duration. Keep one fast default
  lane and avoid duplicating expensive browser/benchmark jobs across every Node
  version unless a failure justifies it.
- consumer bundler smoke: extend packed consumer validation with at least one
  Vite or Rollup scenario that imports generated code from installed packages.
  This should catch package export, ESM, and tree-shaking regressions that plain
  `tsc` consumer smoke can miss.
- boundary validation API: consider a `validateBuffer(layout, view)` or
  `tryValidateFrame(...)` entrypoint for file/network/IPC/application-envelope
  boundaries. This must be a pre-hot-loop safety path, not the return style of
  generated scalar getters or scan kernels.
- pointer traversal budget API: keep traversal budget explicit and public for
  pointer-heavy data. Candidate shape: require a `maxSteps` / traversal budget
  in helper APIs that can follow user-controlled pointer chains, so cycles and
  very large counts fail closed instead of becoming DoS-style loops.
- generated output split mode: `zeno-codegen --output=split` now emits a small
  barrel plus one generated file per struct. Keep single-file output as the
  default. Future work should measure large-schema type-check and bundle impact
  before adding finer layer-based files such as `UserView.scalars.ts`,
  `UserView.scan.ts`, and `UserView.dynamic.ts`.
- shared writer adaptive backoff: only add after a benchmark shows real
  high-contention worker collapse on a single cursor and sharded arenas do not
  solve the target workload.
- padded shared control blocks: only add after browser/worker stress shows
  false sharing or cache-line contention between adjacent atomic cursor/ready
  cells. Until then, keep the policy documented and prefer worker-owned shards.
- TypeChecker-assisted frontend: treat as optional assistance, not replacement
  of the restricted AST-first schema grammar, unless a concrete accepted syntax
  needs semantic resolution.
- stronger browser worker stress: add when the WebGL/Electron/Obsidian graph
  workload uses browser workers or `SharedArrayBuffer` in a way Node stress
  cannot model.
- boundary `tryValidateFrame` / `Result` wrapper: valid at file, network, IPC,
  or application envelope boundaries before entering hot loops; not valid as
  the scalar/vector hot path return style.
- source-map/debugger polish: improve when generated-view debugging becomes a
  user-facing friction point, especially around statement-level generated code
  mappings.
- renderer-facing buffer compiler direction: the target is not WebGL, Three.js,
  Babylon.js, or WebGPU as a framework dependency. The target is renderer-ready
  memory: typed arrays, binary metadata, struct-of-arrays vectors, and explicit
  pack kernels that any 3D renderer can consume.
- `@exornea/zeno-buffers` owns only dependency-free fixed-row packing helpers:
  `DataView` rows plus generated byte lengths/offsets in, caller-owned typed
  arrays out. It must not grow renderer imports, asset loading, scene graph, ECS,
  WebGL upload, or WebGPU binding behavior.
- keep scan surface routing explicit: generated `*View.sum*`,
  `count*WhereEq`, and `findFirst*WhereEq` are schema-aware scalar table scans;
  `@exornea/zeno-buffers` is the generic pack/histogram layer for caller-owned
  typed-array outputs. Do not let both surfaces grow duplicate scan APIs.
- keep [renderer-buffer-case-studies.md](../human/renderer-buffer-case-studies.md) as
  the evidence file for `@exornea/zeno-buffers`. Add real public renderer
  surfaces there first, then only promote repeated patterns into code.
- renderer vector upload path: keep the
  [WebGL streamer](../examples/webgl-instance-streamer) `Zeno vectors` mode as
  the current struct-of-arrays witness using `vector<f32>` plus
  `ScalarVectorView.nativeArray()`. Add WebGPU/worker/custom-engine variants
  only when a real browser workload needs them.
- Raw WebGL double-buffer path: keep
  [webgl-raw-double-buffer](../examples/webgl-raw-double-buffer) as the separate
  renderer/concurrency witness for
  `SharedArrayBuffer -> worker -> Float32Array -> gl.bufferSubData`. Do not fold
  this into Zeno core unless a real renderer integration needs a generated API.
- raw WebGL timing policy: `setInterval(writeFrame, 16)` is acceptable for the
  current smoke-test witness, but not a promoted production simulation loop.
  Promote to delta-time simulation or worker `requestAnimationFrame` only after
  a browser workload needs refresh-rate-aware simulation behavior.
- raw WebGL buffering policy: double buffering proves the tearing boundary.
  Consider triple buffering only after a benchmark shows `gl.bufferSubData`
  upload stalls causing material `skippedFrames` growth on target hardware.
- GPU-ready row layout promotion: the current 20-float interleaved instance row
  belongs to the renderer experiment. If the same shape becomes reusable product
  code, promote it into a Zeno schema or generated pack layer so stride and
  offsets are generated and reviewable rather than handwritten constants.
- WebGL overkill threshold: do not pitch Zeno for trivial vertex buffers such as
  position-only `Float32Array` data. Handwritten typed arrays are better when a
  layout is a single obvious vector stream and has no schema review, scan,
  manifest, or pack-routing value. Zeno's WebGL target starts when multiple
  fields, record kinds, visibility/filtering, worker handoff, or layout review
  become real.
- WebGL math-layout ABI: do not add `mat3`, `mat4`, `quat`, `vec3`, or similar
  aliases without an explicit memory-layout policy. WebGL/GPU-facing layouts may
  pad or align differently from a naive "N floats" TypeScript model. Any future
  math alias must specify column/row order, byte stride, padding, and whether it
  is renderer-local or wire ABI.
- generated output scale: large renderer projects can have dozens of buffer
  schemas. Track generated file count, generated LOC, TypeScript build time, and
  bundled bytes before promoting more generated surfaces. Prefer opt-in split
  output or per-layer generated files when the single `.view.ts` output becomes
  the bottleneck.
- runtime bundle surface: keep `@exornea/zeno-buffers` dependency-free and keep
  renderer examples honest about which packages enter the browser bundle. For
  simple WebGL demos, handwritten typed arrays may beat `zeno-runtime` plus
  generated views on bundle size and setup cost.
- generated renderer pack kernels: consider `packPositions2f/3f`,
  `packFieldToTypedArray`, and interleaved attribute packers for array-of-struct
  schemas after the SoA native-array path has a browser benchmark witness. These
  should output caller-owned typed arrays and must not import renderer
  libraries.

## Ongoing policies

- keep `--scan-kernels=none|sum|basic|full` documented when scan kernel output
  changes
- keep [layers](../reference/layers/00-wire-abi.md) and `tests/layer-model.test.ts` in sync
  when moving public API between layers
- do not grow `packages/compiler/src/emitter.ts` with new feature emission;
  add or extend a layer-specific emitter file and keep `emitter.ts` as assembly
  only
- keep `bench:check` in `release:check`; benchmark workloads are part of the
  publish gate, while exact timing thresholds stay diagnostic because CI
  hardware noise is high
- keep [performance-comparison.md](../human/performance-comparison.md) synced when
  benchmark code or generated hot-path code changes
- keep [schema-grammar.md](../human/schema-grammar.md) and
  [schema-grammar.ko.md](../human/schema-grammar.ko.md) in sync with every new accepted
  or rejected schema construct
- keep [frontend-model.md](../reference/frontend-model.md) synchronized with analyzer and
  schema grammar changes. Zeno is AST-first over a restricted schema grammar,
  not a full TypeScript semantic type parser; this is partly a portability
  choice because future frontends can lower another language or IDL into the
  same Layout IR.
- keep high-contention shared writer work separate from the synchronous shared
  writer. Candidate work: async/backoff writer, sharded arena benchmarks, and
  explicit guidance that a single shared cursor is not the high-contention
  industrial path.
- keep shared-memory control words separate from serialized payload bytes.
  Atomic cursor cells and descriptor ready cells are host-native control data;
  if future stress tests show false sharing, use padded control blocks rather
  than changing the Zeno wire ABI.
- keep renderer-buffer claims separated from scalar scan claims.
  Struct-of-arrays native vector projection can expose typed arrays suitable for
  upload APIs when alignment and endian conditions hold; array-of-struct schemas
  need explicit pack kernels and should be described as batching, not zero-copy
  upload.
- keep [runtime-boundary.md](../reference/runtime-boundary.md) synchronized with runtime API
  changes. Hot projection APIs may throw `RangeError`, while untrusted input
  boundaries should use checked/try validation APIs before entering hot loops.
- explicitly reject `Result<T, E>` on runtime hot projection paths. `Result`
  belongs in compiler analysis and optional boundary validation APIs, not in
  generated scalar getters, scan kernels, cursor movement, or tight vector
  access loops.

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
- [schema-evolution.md](../reference/schema-evolution.md) records the optional/union design
  boundary.
- [release-checklist.md](../reference/release-checklist.md) records scoped public publish
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
- generated `.view.ts` output crosses a TypeScript AST parse boundary before it
  is returned or written, while preserving the existing tagged-template emitter
  formatting.
- v2.0 deliberately stops at an AST-checked emitter boundary. A full
  `ts.factory`/synthetic AST emitter is deferred until statement-level source
  map generation is worth the extra surface.
- generated-code compile/run fuzzing covers scalar schema shapes, and a
  representative big-endian nested dynamic schema runs through generated
  writer/view APIs.
- ABI compatibility now has a frozen v1 fixed-layout byte fixture read by the
  v2 runtime.
- hostile malformed descriptors are covered by property tests in addition to
  deterministic fixtures.
- `release:check` includes a Node worker SharedArrayBuffer writer stress gate
  for atomic tail reservation.
- packed consumer smoke checks compiler/runtime package-root import resolution
  and rejects deep package imports.
- CI includes a Playwright WebGL browser smoke matrix for Chromium and Firefox.

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

## Completed in 2.1

- source maps collect generated class, interface, const, and member mapping
  points from the generated TypeScript AST instead of substring-scanning lines
- `bytesEqual`, `equalsAscii`, and `startsWithAscii` provide decode-free text
  predicate helpers for byte slices
- `ScalarVectorView.nativeArray()` projects aligned host-endian scalar vectors
  as native typed arrays and rejects unsafe endian/alignment cases
- browser smoke records structured per-mode WebGL benchmark metrics
- WebGL smoke verifies nonblank visual state through an app-exposed pixel sample
- repeated emitter naming and literal helpers moved into `emitter-names.ts`
- `emitSyntheticSource(...)` exists as a diagnostic migration utility, while
  the default emitter keeps stable tagged-template formatting

## Completed in 2.4

- [frontend-model.md](../reference/frontend-model.md) records the TypeScript frontend as
  AST-first over a restricted schema grammar, not a full TypeScript semantic
  parser.
- [runtime-boundary.md](../reference/runtime-boundary.md) records that runtime hot projection
  APIs may throw `RangeError` and must not return `Result<T, E>`.
- [architecture.md](../reference/architecture.md) now describes the compiler frontend as a
  restricted schema grammar lowered to Layout IR.
- `tests/docs-policy.test.ts` locks the frontend, runtime boundary, and emitter
  assembly-layer documentation policies.
- packed `zeno-codegen`, `zeno-inspect`, and `zeno-diff-layout` execution are
  verified by the consumer smoke gate.
- package versions, workspace internal dependencies, and `package-lock.json` are
  aligned at `2.4.0`.

## Completed in 2.5

- Added `@exornea/zeno-buffers` as the fifth package for dependency-free
  fixed-row typed-array packing helpers.
- Added public renderer-surface case studies across HexGL, Nemesis, xwing, and
  NetHack 3D metadata without storing asset payload bytes.
- Added renderer-facing examples for asset catalogs, draw batches, entity
  transforms, grid buffers, and sprite atlas buffers.
- Added `bench:renderer-surfaces` for multi-project metadata scan and pack
  witnesses.
- Extended package policy, version checks, package dry-runs, packed consumer
  smoke, and public API snapshots to cover `@exornea/zeno-buffers`.
- Package manifests and workspace lockfile are aligned at the current release
  family.
- `release:check` keeps `bench:check` in the publish gate.
- `bench:check` includes a real WebGL game metadata fixture derived from the
  pinned HexGL repository tree. The fixture stores metadata only, not asset
  payload bytes.

## Candidate Work

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
- source maps are now a v2 compiler surface through `--source-map`; keep
  statement-level AST mapping covered by tests while full factory-built class
  emission remains future work

### Performance surface

- keep removed cursor offset caching out of the public CLI unless a new design
  clears the benchmark and retained-heap promotion gate
- promote generated scan kernels as the main aggregate hot path, not optimized
  cursor offsets
- `sum<Field>()`, `min<Field>()`, and `max<Field>()` are generated for number
  scalar fields; `count<Field>WhereEq(...)` and `findFirst<Field>WhereEq(...)`
  are generated for integer and boolean scalar equality predicates
- add browser benchmark witnesses for the newer scan kernels before promoting
  them beyond the compiler API surface
- keep checked cursor APIs for safety and unchecked cursor APIs for caller-proven
  loops; benchmark them separately
- promote additional text byte predicates only after real call-site witnesses
  show they avoid decoding in user code
- promote `ScalarVectorView.nativeArray()` only for browser use cases where the
  native-endian/alignment preconditions are already true
- add browser benchmark smoke runs for generated scan kernels beyond the WebGL
  instance packer, because Node/V8 local witnesses are not browser guarantees
- `VectorView` caches its descriptor after the first access and exposes
  `refreshDescriptor()` for descriptor rewrite boundaries; keep this contract
  explicit whenever shared-memory publication or live descriptor mutation is
  discussed
- keep the WebGL instance demo benchmark in
  [performance-comparison.md](../human/performance-comparison.md), not only as a TODO;
  rerun it when the demo schema or render cap changes
- keep the HexGL metadata fixture pinned and metadata-only; rerun
  `scripts/update-real-game-metadata-fixture.mjs` only when intentionally
  refreshing the source repository witness
- keep the renderer-surface fixture pinned and metadata-only; rerun
  `scripts/update-renderer-surface-fixture.mjs` only when intentionally
  refreshing public case-study repositories
- keep `bench:renderer-surfaces` as the multi-project renderer metadata witness
  for asset-catalog rows and kind-specific queue packing

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
  - `examples/scalar-only`: fixed record hot-path scans (implemented)
  - `examples/renderer-asset-catalog-buffer`: public game asset metadata rows
    and kind-specific typed-array queues (implemented)
  - `examples/renderer-draw-batch-buffer`: mesh/material/pass command rows and
    draw command word packing (implemented)
  - `examples/renderer-entity-transform-buffer`: visible entity transforms,
    identity rows, and visible queues (implemented)
  - `examples/renderer-grid-buffer`: NetHack-style grid/entity/dirty-range
    renderer buffers (implemented)
  - `examples/renderer-sprite-atlas-buffer`: sprite atlas grouping plus
    position/UV/color packing (implemented)
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
