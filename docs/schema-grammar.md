# Schema Grammar

Korean version: [schema-grammar.ko.md](schema-grammar.ko.md)

This document describes the supported `.zeno.ts` authoring grammar. It is a
TypeScript subset plus Zeno ABI marker types from `@exornea/zeno-types`.

## Claim Status

| Property | Status | Reason |
| --- | --- | --- |
| Type-only imports | load-bearing | Schema files must not depend on runtime values. |
| Interface fields | load-bearing | Field order, names, and marker types define the binary layout. |
| ABI marker types | load-bearing | Width, descriptor, and pointer policy must be explicit. |
| Bare TS shorthand | diagnostic | `string` is supported as UTF-8 shorthand, but explicit `z.utf8` is clearer. |
| Value declarations | rejected | Runtime values in schema files make codegen ambiguous and unsafe. |

## File Shape

```ts
import type { z } from "@exornea/zeno-types";

export interface StructName {
  fieldName: z.i32;
}
```

Allowed top-level declarations:

- type-only imports,
- exported `interface` declarations,
- exported `type` aliases when they resolve to supported marker forms.

Rejected top-level declarations:

- value imports,
- `const`, `let`, `var`,
- functions,
- classes,
- enums,
- runtime exports.

## EBNF-Lite

This is not a TypeScript parser grammar. It is the Zeno schema subset after the
file has already parsed as TypeScript.

```txt
schema-file      ::= type-import* declaration*

type-import      ::= "import type" ... "from" "@exornea/zeno-types"

declaration      ::= interface-declaration | type-alias

interface-declaration
                 ::= "export" "interface" Identifier "{" field* "}"

field            ::= Identifier ":" field-type ";"

field-type       ::= scalar-type
                   | scalar-alias-type
                   | fixed-type
                   | fixed-array-type
                   | dynamic-type
                   | vector-type
                   | pointer-type
                   | struct-reference
                   | string-shorthand

scalar-type      ::= z.i8 | z.u8 | z.i16 | z.u16 | z.i32 | z.u32
                   | z.i64 | z.u64 | z.f32 | z.f64 | z.bool

scalar-alias-type
                 ::= z.enumU8<T> | z.enumU16<T>
                   | z.flags8 | z.flags32 | z.timestampMs

fixed-type       ::= z.fixedBytes<N>
                   | z.fixedUtf8<N>
                   | z.fixedAscii<N>

fixed-array-type ::= z.fixedArray<fixed-array-element, N>

fixed-array-element
                 ::= scalar-type
                   | scalar-alias-type
                   | fixed-type
                   | fixed-struct-reference

dynamic-type     ::= z.utf8 | z.ascii | z.bytes

vector-type      ::= z.vector<vector-element>

vector-element   ::= scalar-type
                   | fixed-type
                   | dynamic-type
                   | fixed-struct-reference
                   | pointer-type

pointer-type     ::= z.pointer<struct-reference>

struct-reference ::= Identifier

string-shorthand ::= string

N                ::= numeric-literal
```

## Supported Examples

### Fixed Scalar Record

```ts
import type { z } from "@exornea/zeno-types";

export interface Point {
  x: z.f32;
  y: z.f32;
  flags: z.u8;
}
```

### Dynamic Text And Bytes

```ts
import type { z } from "@exornea/zeno-types";

export interface ArticleMeta {
  id: z.u64;
  slug: z.utf8;
  title: z.utf8;
  summary: string;
  thumbnail: z.bytes;
}
```

`summary: string` lowers to UTF-8 `Span32`. Prefer `z.utf8` when the schema is
reviewed as a binary contract.

### Fixed Strings And Vectors

```ts
import type { z } from "@exornea/zeno-types";

export interface SearchRow {
  id: z.u32;
  score: z.f32;
  locale: z.fixedAscii<8>;
  tags: z.vector<z.utf8>;
}
```

### Semantic Aliases And Fixed Arrays

```ts
import type { z } from "@exornea/zeno-types";

export interface Point {
  x: z.f32;
  y: z.f32;
}

export interface Metrics {
  kind: z.enumU8<"cpu" | "gpu">;
  flags: z.flags32;
  createdAt: z.timestampMs;
  samples: z.fixedArray<z.f32, 3>;
  labels: z.fixedArray<z.fixedAscii<4>, 2>;
  points: z.fixedArray<Point, 2>;
}
```

Semantic aliases lower to existing scalar ABI kinds. `fixedArray<T, N>` is an
inline fixed-layout region, not a `Vector32` descriptor.

### Nested Fixed Struct

```ts
import type { z } from "@exornea/zeno-types";

export interface Stats {
  hp: z.i32;
  mana: z.i32;
}

export interface Player {
  id: z.u64;
  stats: Stats;
}
```

Nested struct values must have fixed byte length. A struct with dynamic fields
can still be referenced through `z.pointer<T>`.

### Explicit Recursive Reference

```ts
import type { z } from "@exornea/zeno-types";

export interface Node {
  value: z.i32;
  next: z.pointer<Node>;
  children: z.vector<z.pointer<Node>>;
}
```

Pointers use signed relative `pointer32` offsets. Generated pointer APIs move
one edge at a time; graph traversal needs an explicit step budget.

## Rejected Examples

### Bare Number

```ts
export interface Bad {
  value: number;
}
```

Rejected because `number` has no stable ABI width. Use `z.i32`, `z.u32`,
`z.f32`, `z.f64`, or another explicit scalar marker.

### Bare Array

```ts
export interface Bad {
  values: number[];
}
```

Rejected because a bare TS array does not specify descriptor shape or element
layout. Use `z.vector<T>`.

### Direct Recursive Struct

```ts
export interface BadNode {
  next: BadNode;
}
```

Rejected because direct recursion has infinite inline size. Use
`z.pointer<BadNode>`.

### Optional Field

```ts
export interface Bad {
  nickname?: z.utf8;
}
```

Rejected because optional fields need a schema-evolution/vtable policy. Zeno
does not treat TypeScript optional syntax as an inline nullable field.

### Union Field

```ts
export interface Bad {
  value: z.i32 | z.utf8;
}
```

Rejected because unions need an explicit discriminator ABI. Future support must
define a tag field and fixed variant table before accepting union syntax.

### Runtime Values

```ts
import { ProjectionView } from "@exornea/zeno-runtime";

export const runtimeValue = ProjectionView;

export interface Bad {
  id: z.u64;
}
```

Rejected because `.zeno.ts` files are schema-only. Use type-only imports from
`@exornea/zeno-types`.

## Cross-References

- Construct-to-IR mapping: [layout-ir-coarsening.md](layout-ir-coarsening.md)
- Detailed walkthrough: [getting-started.md](getting-started.md)
- Schema evolution boundary: [schema-evolution.md](schema-evolution.md)
- ABI contract: [abi.md](abi.md)
- Test plan: [TODO.md](TODO.md)
