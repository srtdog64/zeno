# Layout IR Coarsening

Zeno intentionally lowers rich TypeScript declarations into a smaller binary layout
IR before emitting runtime view classes.

That lowering is a measurement hierarchy:

```text
TypeScript source -> TypeScript types -> Layout IR -> emitted view code
finest              resolved symbols    ABI facts    runtime-only offsets
```

Each step forgets information. The validator should report unsupported constructs
in terms of the layer that cannot represent them, not only as generic syntax
failures.

## Resolution Layers

| Layer | Keeps | Forgets | Zeno use |
| --- | --- | --- | --- |
| `typescript-syntax` | AST node shape, declarations, type references | resolved aliases, ABI width, layout offsets | source traversal and syntax diagnostics |
| `typescript-type` | resolved symbols, aliases, type arguments | concrete field offsets, padding, wire descriptors | branded scalar and marker type recognition |
| `layout-ir-fixed` | scalar widths, fixed string/bytes length, struct offsets, alignment | arbitrary unions, open arrays, runtime payload sizes | packed fixed-layout struct projection |
| `layout-ir-dynamic` | `Span32`, `Vector32`, dynamic string/bytes/vector descriptors | sparse evolution metadata, optional vtables | head plus tail arena projection |
| `emitted-view` | inline offsets and helper calls | original authoring syntax and unsupported alternatives | hot-path runtime API |

## Current Construct Mapping

| TypeScript construct | Current IR | Status |
| --- | --- | --- |
| `i8`, `u8`, `i16`, `u16`, `i32`, `u32`, `i64`, `u64`, `f32`, `f64`, `bool` | `ScalarFieldLayout` | supported |
| `z.fixedBytes<N>` / `fixed_bytes<N>` | `FixedBytesFieldLayout` | supported when `N` is a numeric literal |
| `z.fixedUtf8<N>`, `z.fixedAscii<N>` / legacy snake_case aliases | `FixedStringFieldLayout` | supported when `N` is a numeric literal |
| `string`, `z.utf8`, `z.ascii` | `DynamicStringFieldLayout` with `Span32` | supported |
| `z.bytes` / `bytes` | `DynamicBytesFieldLayout` with `Span32` | supported |
| nested interface reference | `StructFieldLayout` | supported for non-recursive local interfaces |
| `z.vector<T>` / `vector<T>` | `VectorFieldLayout` with `Vector32` | supported for scalar, fixed bytes/string, dynamic bytes/string, fixed struct, and pointer elements |
| `z.pointer<T>` / `pointer<T>` | `PointerFieldLayout` with `pointer32` | supported; stores a field-relative offset and permits explicit recursive references |
| bare `number` | none | ambiguous ABI width |
| bare `T[]` | none | insufficient fixed-layout resolution; use `vector<T>` |
| non-literal fixed length | none | insufficient fixed-layout resolution |
| direct recursive struct | none | unsupported; use `z.pointer<T>` for explicit indirection |
| union types | none | unsupported until discriminant or table rules exist |

## Diagnostic Categories

The compiler keeps this split in code:

- `packages/compiler/src/result.ts`: the small `Result<T, E>` pattern used by
  lowering and later compiler passes.
- `packages/compiler/src/measurement.ts`: the measurement hierarchy, phase labels,
  and failure constructors.
- `packages/compiler/src/diagnostics.ts`: source locations and user-facing messages
  that wrap measurement failures.

Compiler diagnostics carry a structured `ValidationError`:

- `AmbiguousLayout`: TypeScript has more than one plausible ABI mapping. Example:
  bare `number` could be `i32`, `u32`, `f32`, `f64`, and others.
- `InsufficientResolution`: the current IR layer cannot encode a construct without
  more information. Example: `T[]` does not provide descriptor or element layout
  rules.
- `UnsupportedAtPhase`: the construct has a plausible future representation, but
  this phase intentionally rejects it. Example: direct recursive structs and
  unions.
- `DuplicateDefinition`: the same construct is defined more than once. Example:
  duplicate field names inside one layout.
- `LayoutInvariantViolation`: a produced IR object violates an invariant that the
  layout layer must already satisfy. Example: a field offset is not divisible by
  its alignment.

`LayoutDiagnostic.code` is the precise user-facing diagnostic code.
`LayoutDiagnostic.error.kind` is the broader measurement-failure category. They
are intentionally separate, but their meanings must not conflict.

IR-derived diagnostics must use `source.kind = "ir-derived"` instead of fake
`line: 0` source locations.

## Phase Boundary

Phase 0 should keep rejecting anything that cannot fit into fixed scalar and
explicit descriptor layouts. Later phases should update this table before adding
new IR nodes, so the project can say which resolution layer was added and which
diagnostics moved from failure to support.
