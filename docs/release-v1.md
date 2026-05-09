# 1.0.0 Release Notes

## Claim Status

| Property | Status | Reason |
| --- | --- | --- |
| TS-only schema authoring | load-bearing | This is Zeno's product boundary and differentiator. |
| Generated view API | load-bearing | Consumers use generated `.view.ts` classes as the runtime API. |
| Runtime ABI descriptors | load-bearing | Scalar, `Span32`, `Vector32`, and `pointer32` layouts are the wire contract. |
| Package root imports | load-bearing | Root imports are verified by consumer smoke; subpath imports stay closed. |
| Schema evolution | diagnostic | v1 documents breaking-change rules but does not implement vtable compatibility. |

## Stable V1 Surface

- `.zeno.ts` schema-only convention using TypeScript interfaces.
- `@zeno/types` ABI marker namespace `z`.
- fixed scalar, fixed bytes, fixed string, nested fixed struct layouts.
- `z.utf8`, `z.ascii`, `z.bytes` as `Span32` descriptors.
- emitted readers and writers preserve UTF-8 vs ASCII text encoding.
- `z.vector<T>` as `Vector32` for supported scalar, fixed bytes/string,
  dynamic bytes/string, fixed struct, and pointer elements.
- `z.pointer<T>` as signed relative `pointer32` with raw `0xffffffff` null.
- generated getters, setters, static accessors, view methods, and supported
  object writer methods.
- generated `sum<Field>()` scan kernels for `number` scalar fields.
- unchecked cursor movement methods for caller-proven hot loops.
- runtime root export `@zeno/runtime`.
- compiler CLI `zeno-codegen`, including `--diagnostics=json` for structured
  diagnostic output.

## Explicit Non-Goals

- cross-language codegen,
- FlatBuffers-style schema evolution,
- optional/vtable records,
- unions without discriminator policy,
- object graph allocation or pointer graph serialization,
- importing package internals through subpaths.

## Witness Case

- Build/test/codegen/package/consumer gate: `npm run release:check`
- Version consistency gate: [version-check.mjs](../scripts/version-check.mjs)
- Package manifest policy gate: [package-policy-check.mjs](../scripts/package-policy-check.mjs)
- Packed consumer project: [consumer-smoke.mjs](../scripts/consumer-smoke.mjs)
- Packed CLI JSON diagnostics: [consumer-smoke.mjs](../scripts/consumer-smoke.mjs)
- API stability: [api-stability.md](api-stability.md)
- Schema compatibility: [schema-compatibility.md](schema-compatibility.md)
- ABI contract: [abi.md](abi.md)
- Performance witness: [performance-comparison.md](performance-comparison.md)

## Methodological Note

This is a v1 stability claim for the TypeScript package and ABI contract, not a
claim that every future binary schema change is compatible. Schema compatibility
is governed by [schema-compatibility.md](schema-compatibility.md).
