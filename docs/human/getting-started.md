# Getting Started

## Status

| Property                          | Status       | Reason                                                                                  |
| --------------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| TypeScript-only schema authoring  | load-bearing | Zeno removes a separate `.fbs`-style IDL only for TS-only systems.                      |
| `@exornea/zeno-types` ABI aliases | load-bearing | Binary width and dynamic layout policy must be explicit in the type layer.              |
| `.zeno.ts` schema files           | load-bearing | They keep schema review separate from application logic while staying valid TypeScript. |
| Dynamic read/write views          | load-bearing | `Span32` and `Vector32` readers and supported writers are part of the v2 surface.       |
| Bare `string` shorthand           | diagnostic   | The compiler can lower it to UTF-8 today, but `z.utf8` is clearer in schema review.     |

## 1. Write a Schema

Create a schema-only file with type imports from `@exornea/zeno-types`.

```ts
import type { z } from "@exornea/zeno-types";

export interface User {
  id: z.u64;
  age: z.i32;
  score: z.f64;
  ratio: z.f32;
  handle: z.fixedUtf8<32>;
  name: z.utf8;
  tags: z.vector<z.utf8>;
  avatar: z.bytes;
}
```

Keep runtime logic out of `.zeno.ts` files. They are TypeScript source files,
but their job is schema declaration.

For the full schema grammar and rejected examples, see
[schema-grammar.md](schema-grammar.md) or
[schema-grammar.ko.md](schema-grammar.ko.md).

## 2. Generate a View

The basic example uses:

```powershell
npm run codegen:basic
```

That reads:

- [examples/basic/src/model.zeno.ts](../examples/basic/src/model.zeno.ts)

and emits:

- [examples/basic/src/model.view.ts](../examples/basic/src/model.view.ts)

The generated file is the runtime API. It contains fixed offsets, static
accessors, and cursor-style view methods.

The standalone codegen CLI also accepts explicit endianness:

```powershell
node .\packages\compiler\bin\zeno-codegen.mjs .\examples\basic\src\model.zeno.ts .\examples\basic\src\model.view.ts --endian=little
node .\packages\compiler\bin\zeno-codegen.mjs .\examples\basic\src\model.zeno.ts .\examples\basic\src\model.big.view.ts --endian=big
```

For CI or editor integrations, use machine-readable diagnostics:

```powershell
node .\packages\compiler\bin\zeno-codegen.mjs .\examples\basic\src\model.zeno.ts .\examples\basic\src\model.view.ts --diagnostics=json
```

The default is little-endian.

## 3. Read a Buffer

```ts
import { UserView } from "./model.view.js";

const view = new DataView(buffer);
const user = new UserView(view);

const id = user.id;
const age = UserView.getAge(view);
const nameBytes = user.nameView().bytes();
const nameText = user.nameView().text();
const tags = user.tagsView().textArray();
```

Scalar reads are the hot path. Dynamic strings and vectors are lazy view APIs:
byte slices are cheap, but decoding strings and materializing arrays are
explicit costs.

This is the key deserialization model:

```txt
projection read: buffer -> DataView-backed view
materialization: buffer -> plain JS object/string/array
```

Projection read is the default Zeno path. It keeps the buffer as the source of
truth and avoids building an object graph. Materialization is a separate cold
path for UI, debugging, import/export, or tests.

## 4. Write a Record

Use the generated object writer when constructing a full record. The view class
owns fixed offsets, descriptor offsets, and tail cursor setup.

```ts
import { UserView } from "./model.view.js";

UserView.write(view, {
  id: 42n,
  age: 37,
  score: 98.5,
  handle: "zeno-user",
  name: "Zeno",
  tags: ["ts", "view"],
  avatar: [1, 2, 3],
});
```

This is still explicit serialization. It writes into a caller-owned
`ArrayBuffer`; it does not allocate an intermediate object graph.

## 5. Write Dynamic Fields Directly

Use generated writer helpers when a record has `z.utf8`, `z.bytes`, or a
dynamic string/bytes vector. The generated view owns the descriptor offsets and
the writer owns the tail cursor.

```ts
import { UserView } from "./model.view.js";

const writer = UserView.createWriter(view);

UserView.writeName(writer, "Zeno");
UserView.writeTags(writer, ["ts", "view"]);
UserView.writeAvatar(writer, [1, 2, 3]);
```

This remains useful when constructing a record incrementally or when callers
already batch their own fixed-field writes.

## Supported Types

| Schema type                                                             | Layout                                                          | Status                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `z.i8`, `z.u8`, `z.i16`, `z.u16`, `z.i32`, `z.u32`                      | scalar                                                          | supported                                                                                                                                                                                                                          |
| `z.i64`, `z.u64`                                                        | bigint scalar                                                   | supported                                                                                                                                                                                                                          |
| `z.f32`, `z.f64`, `z.bool`                                              | scalar                                                          | supported                                                                                                                                                                                                                          |
| `z.enumU8<T>`, `z.enumU16<T>`, `z.flags8`, `z.flags32`, `z.timestampMs` | semantic scalar aliases                                         | supported; lower to `u8`, `u16`, `u8`, `u32`, and `i64`                                                                                                                                                                            |
| `z.fixedUtf8<N>`, `z.fixedAscii<N>`, `z.fixedBytes<N>`                  | inline fixed region                                             | supported                                                                                                                                                                                                                          |
| `z.fixedArray<T, N>`                                                    | inline fixed array                                              | supported for scalar, fixed bytes/string, and fixed-size struct elements                                                                                                                                                           |
| `z.utf8`, `z.ascii`, `z.bytes`                                          | `Span32` descriptor                                             | read, field-level write, and object-level write supported                                                                                                                                                                          |
| `z.vector<T>`                                                           | `Vector32` descriptor                                           | read supported for scalar, fixed bytes/string, dynamic bytes/string, fixed struct, and pointer elements; object-level write supported for scalar, fixed bytes/string, dynamic bytes/string, fixed-size struct, and pointer vectors |
| `z.dynamicVector<T>`                                                    | `Vector32` offset table                                         | dynamic struct vectors with generated read and write helpers                                                                                                                                                                       |
| `z.pointer<T>`                                                          | signed `pointer32` field-relative offset, raw `0xffffffff` null | supported for explicit recursive references                                                                                                                                                                                        |
| bare `string`                                                           | UTF-8 `Span32` descriptor                                       | supported, but prefer `z.utf8` in schemas                                                                                                                                                                                          |
| bare `number`                                                           | ambiguous                                                       | rejected                                                                                                                                                                                                                           |
| bare `T[]` or `any[]`                                                   | ambiguous dynamic layout                                        | rejected, use `z.vector<T>`                                                                                                                                                                                                        |
| direct recursive structs, unions, optional fields                       | no stable ABI rule yet                                          | rejected                                                                                                                                                                                                                           |

## Why This Is Easier Than `.fbs` in the Target Case

| Question                 | `.fbs` style IDL                     | Zeno `.zeno.ts`                            |
| ------------------------ | ------------------------------------ | ------------------------------------------ |
| Source of truth          | separate schema language             | TypeScript schema file                     |
| Editor behavior          | extra language/tooling               | normal TS parser and imports               |
| TS-only project overhead | extra compiler step and mental model | one TS-flavored schema convention          |
| Cross-language output    | strong                               | intentionally out of scope                 |
| Schema review            | clean standalone file                | clean if `.zeno.ts` convention is followed |
| Hot scalar access        | generated API                        | generated static and cursor accessors      |

The load-bearing claim is narrower than "better than FlatBuffers": Zeno should
be better for TS-only teams that do not need cross-language schema tooling.

## Current Limits

- Object-level serializers reject vectors of structs that themselves contain
  dynamic tail fields; use `z.vector<z.pointer<T>>` for those shapes.
- `z.pointer<T>` stores relative offsets only. It proves addressability, not
  object lifetime. If records can be deleted or reused, read
  [pointer-lifetime.md](pointer-lifetime.md).
- `z.utf8`/`z.bytes` return views or explicit decode helpers, not free JS strings.
- Versioning and schema diff tooling are not implemented; v2 treats
  layout-changing schema edits as breaking.
- Generated dynamic accessors are correctness-first; performance claims remain
  local benchmark witnesses.

## Witness Case

- Schema witness: [examples/basic/src/model.zeno.ts](../examples/basic/src/model.zeno.ts)
- Runtime witness: [examples/basic/src/main.ts](../examples/basic/src/main.ts)
- Grammar reference: [schema-grammar.md](schema-grammar.md) /
  [schema-grammar.ko.md](schema-grammar.ko.md)
- Dynamic runtime tests: [tests/runtime/dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)
- Positioning: [ts-only-positioning.md](../reference/ts-only-positioning.md)
- Dynamic layout model: [dynamic-layout.md](dynamic-layout.md)
