# Frontend Model

Status: v2.4 frontend boundary note.

## Load-Bearing Claims

| Property                   | Status       | Reason                                                                                                  |
| -------------------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| Restricted schema grammar  | load-bearing | Zeno does not attempt to compile arbitrary TypeScript semantics into a binary ABI.                      |
| AST-first frontend         | load-bearing | The current TypeScript frontend reads a small schema grammar from TypeScript syntax.                    |
| Layout IR boundary         | load-bearing | Frontends lower into Layout IR; emitters and runtime layers do not depend on TypeScript AST shapes.     |
| Frontend portability       | candidate    | Other schema frontends can become possible if they lower to the same Layout IR invariants.              |
| Full TypeChecker semantics | retired      | Treating inferred TypeScript semantics as the ABI source would make layout rules implicit and unstable. |

## Rule

Zeno is AST-first over a restricted schema grammar. It is not a full TypeScript
semantic type parser.

The frontend reads schema-only `.zeno.ts` files because TypeScript syntax is a
convenient authoring surface for TypeScript-owned projects. The durable contract
is not the TypeScript AST. The durable contract is the normalized Layout IR:
field names, field kinds, offsets, byte lengths, alignment, descriptors,
endianness, pointer policy, and source locations.

## Why AST-First Is Acceptable

AST-first is a deliberate scope boundary, not only a limitation.

It keeps accepted syntax reviewable:

```ts
import type { z } from "@exornea/zeno-types";

export interface Instance {
  id: z.u32;
  x: z.f32;
  y: z.f32;
  flags: z.flags32;
}
```

The schema author can see the ABI markers directly. There is no hidden rule
where a broad TypeScript type such as `number`, an inferred alias, or an
intersection type silently becomes a wire layout.

## What This Rejects

The TypeScript frontend should reject constructs until they have explicit ABI
rules:

- arbitrary `number`
- runtime imports or values in `.zeno.ts`
- optional fields
- unions
- namespace-scoped schema declarations
- intersection-heavy type composition
- inferred generic structures that do not map to a fixed Layout IR node

This is a feature of the frontend boundary. Rejection keeps layout coarsening
visible instead of turning TypeScript inference into a hidden ABI policy.

## Portability

Because the rest of Zeno consumes Layout IR, another frontend could later lower
into the same IR:

- a JSON schema-like restricted frontend
- a small dedicated IDL
- a Rust-like struct declaration parser
- a build-tool generated schema manifest

Such a frontend would not need to imitate TypeScript's checker. It would only
need to satisfy the Layout IR invariants validated by the compiler.

## Promotion Criterion

Promote a new frontend only when:

- it emits the same Layout IR shape as the TypeScript frontend for a shared
  witness schema
- `validateLayouts(...)` accepts the emitted layouts
- generated code from the emitted layouts passes the generated-code E2E test
- layout manifest output matches or intentionally differs with a documented
  `diff-layout` witness

Do not add a frontend that bypasses Layout IR or emits directly to view code.
