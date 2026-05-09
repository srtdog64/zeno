# TS-Only Positioning

Zeno is not trying to replace FlatBuffers for every environment. Zeno is a
TypeScript-only binary projection tool for teams that want TypeScript-native
schema authoring and generated `DataView` access without maintaining a separate
IDL file.

## Claim Status

| Property | Status | Reason |
| --- | --- | --- |
| TypeScript-only scope | load-bearing | Cross-language support would change the product and compiler design. |
| `.zeno.ts` schema-only convention | load-bearing | It keeps schema diffs and documentation cleaner than arbitrary interfaces spread through app code. |
| `@zeno/types` marker imports | load-bearing | ABI facts must be explicit in TypeScript without runtime schema objects. |
| FlatBuffers comparison | diagnostic | It helps explain tradeoffs, but Zeno should not be judged as a universal FlatBuffers replacement. |
| Runtime has no external dependencies | load-bearing | Hot-path projection should stay small; internal type-only package references are acceptable. |

## Positioning

Use Zeno when:

- the system is TypeScript-only
- cross-language schema generation is not required
- the team wants TypeScript as the schema source of truth
- a separate `.fbs` or `.proto` workflow is more cognitive overhead than value
- binary records are read through `DataView` hot paths

Use FlatBuffers, Cap'n Proto, protobuf, or another IDL when:

- cross-language compatibility is load-bearing
- long-term schema governance matters more than TypeScript DX
- schema files must be consumed by non-TypeScript tooling
- mature versioning and compatibility tooling are required today

## Schema-Only Convention

Zeno schemas should live in `.zeno.ts` files.

```ts
import type { z } from "@zeno/types";

export interface User {
  id: z.u64;
  age: z.i32;
  score: z.f64;
  handle: z.fixedUtf8<32>;
  name: z.utf8;
  tags: z.vector<z.utf8>;
}
```

Rules:

- schema files use `import type { z } from "@zeno/types"`
- schema files export `interface` and supported `type` declarations only
- runtime logic does not belong in `.zeno.ts`
- generated views go into separate `.view.ts` files
- generated view files are the runtime API; schema files are the authoring API

The compiler enforces this boundary in Phase 0. A schema file that imports
runtime values or exports runtime values receives
`UNSUPPORTED_SCHEMA_STATEMENT` diagnostics before generated code is emitted.

## Import Boundary

`@zeno/types` contains type-only ABI markers:

- `z.i32`, `z.u64`, `z.f32`, `z.f64`
- `z.fixedUtf8<N>`, `z.fixedAscii<N>`, `z.fixedBytes<N>`
- `z.utf8`, `z.ascii`, `z.bytes`
- `z.vector<T>`

`@zeno/runtime` contains generated-code helpers and projection views. Schema
authors should not import ABI markers from runtime, even though compatibility
aliases may remain during transition.

## Witness Case

- Witness: [examples/basic/src/model.zeno.ts](../examples/basic/src/model.zeno.ts)
- Generated view: [examples/basic/src/model.view.ts](../examples/basic/src/model.view.ts)
- Codegen command: `npm run codegen:basic`

This witness keeps the schema in a schema-only file while preserving TypeScript
syntax, editor support, and generated hot-path accessors.

## Promotion Criterion

`.zeno.ts` is promoted from project convention to compiler rule when:

| Condition | Status | Witness |
| --- | --- | --- |
| Codegen rejects value exports from schema files | load-bearing | `tests/compiler/fixtures/schema-hygiene.ts` |
| Codegen rejects runtime imports from schema files | load-bearing | `tests/compiler/fixtures/schema-hygiene.ts` |
| Generated docs or IR snapshots make schema review as direct as reading `.fbs` | candidate | `tests/compiler/snapshot.test.ts` |

Do not claim stronger schema versioning than FlatBuffers until Zeno has layout
hashes and schema diff tooling.

## Cross-References

- API split: [api-design.md](api-design.md)
- Benchmark witness: [performance-comparison.md](performance-comparison.md)
- Measurement hierarchy: [layout-ir-coarsening.md](layout-ir-coarsening.md)
- Codegen CLI: [packages/compiler/bin/zeno-codegen.mjs](../packages/compiler/bin/zeno-codegen.mjs)
