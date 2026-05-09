# API Stability

This document defines which Zeno APIs are public, experimental, or internal in
`1.0.0`.

## Claim Status

| Property | Status | Reason |
| --- | --- | --- |
| Root package imports | load-bearing | Consumers must import only package roots such as `@zeno/runtime`; package subpaths are intentionally closed. |
| Generated view class shape | load-bearing | This is the user-facing runtime API produced by the compiler. |
| `@zeno/types` ABI marker names | load-bearing | Schema authors depend on these names in `.zeno.ts` files. |
| Fixed-layout scalar accessors | load-bearing | This is the stable hot path Zeno is built around. |
| Dynamic span/vector APIs | load-bearing | `Span32` and `Vector32` are part of the v1 ABI and covered by runtime, compiler, and consumer witnesses. |
| Pointer APIs | load-bearing | `pointer32` is stable as an explicit relative reference primitive; object graph serialization remains out of scope. |
| Runtime implementation files | diagnostic | They keep the codebase layered, but are not public import paths. |

## Public Import Rule

Use package roots only:

```ts
import { ProjectionView, DynamicLayoutWriter } from "@zeno/runtime";
import type { z } from "@zeno/types";
```

Do not import runtime internals:

```ts
import { readScalar } from "@zeno/runtime/dist/abi.js"; // rejected
```

The runtime package may ship internal `dist/*.js` files because Node needs them
behind the root export graph. They are not public subpath APIs.

## Stable / Experimental Split

Stable for `1.0.x`:

- `.zeno.ts` TypeScript interface input convention
- `@zeno/types` scalar markers: `i8`, `u8`, `i16`, `u16`, `i32`, `u32`, `i64`,
  `u64`, `f32`, `f64`, `bool`
- fixed bytes/string markers with explicit length
- generated fixed-layout scalar getters/setters
- generated static accessor methods for fixed fields
- `z.utf8`, `z.ascii`, `z.bytes`, `z.vector<T>`, and `z.pointer<T>`
- `Span32`, `Vector32`, and `pointer32` descriptor ABI
- generated view methods for supported dynamic fields and pointer fields
- generated object writers for supported fields
- `zeno-codegen` CLI
- root `@zeno/runtime` imports used by generated code

Experimental for `1.0.x`:

- optimized cursor-offset emission mode
- pointer graph serialization policy
- vtable/optional-field schema evolution

Internal:

- files under `packages/runtime/src/*` except root exports
- files under `packages/*/dist/*` except package root entrypoints
- compiler lowering and emitter helper functions not exported from package roots

## Witness Case

- Root imports and closed subpaths: [consumer-smoke.mjs](../scripts/consumer-smoke.mjs)
- Package manifest policy: [package-policy-check.mjs](../scripts/package-policy-check.mjs)
- Runtime root surface: [index.ts](../packages/runtime/src/index.ts)
- Public runtime export snapshots: [public-api.test.ts](../tests/public-api.test.ts)
- Runtime layer split: [abi.md](abi.md)
- Generated view shape: [snapshot.test.ts](../tests/compiler/snapshot.test.ts)

## Promotion Criterion

Promote an experimental API to stable when:

- it has a generated-code snapshot witness,
- it has runtime read/write tests for valid data,
- it has malformed-buffer tests for invalid descriptors or offsets,
- it has a consumer smoke witness through packed tarballs,
- it is documented in README and this file as stable.

Pointer APIs are stable as single-edge relative references. Do not promote
pointer graph serialization unless:

- traversal budget behavior is documented at the schema/API level,
- null sentinel behavior is covered by tests,
- graph serialization is either implemented or explicitly postponed with a
  stable non-goal.

Dynamic vector APIs are stable for the supported element kinds. Do not promote
new vector element kinds unless:

- vector element layout compatibility is validated by the compiler,
- dynamic workloads have benchmark witnesses separate from fixed scalar hot
  paths,
- schema evolution rules say which descriptor changes are breaking.

Current witness: `vector<struct>` elements with dynamic tail fields are rejected
with a diagnostic that routes users to `vector<pointer<T>>`.

## Pattern Note

This is a public-surface stability graph, not a source-layout freeze. The
runtime may keep splitting internal layers to preserve ABI clarity while the
consumer import graph remains stable.
