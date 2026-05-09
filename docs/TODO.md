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

Status: satisfied for v1.

- IR snapshots for supported schemas: done for representative schemas
- diagnostics snapshots for rejected schemas: done for representative rejected source schemas
- alignment, padding, and offset math verified: covered by analyzer and validator tests

### Gate 2: Emitter correctness

Status: satisfied for v1.

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

Status: satisfied for v1.

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

Status: satisfied for v1.

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

- tag and publish `1.1.0` after human release review
- keep [schema-grammar.md](schema-grammar.md) and
  [schema-grammar.ko.md](schema-grammar.ko.md) in sync with every new accepted
  or rejected schema construct

## Deferred tasks

- sparse/versioned records with vtable-style metadata
- schema evolution guarantees
- grammar additions for discriminated unions and optional fields
- browser-focused bundle verification
- fuzzing and malformed buffer corpus expansion
