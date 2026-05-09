# 1.8.0 Release Notes

## Claim Status

| Property                     | Status       | Reason                                                                                                                               |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Shared-memory arena helpers  | load-bearing | Browser worker pipelines can reserve tail payloads in a `SharedArrayBuffer` without object serialization.                            |
| Atomic cursor reservation    | load-bearing | `SharedDynamicLayoutWriter` stores the tail cursor in a shared `Int32Array` cell and reserves ranges with `Atomics.compareExchange`. |
| Descriptor publication cells | load-bearing | Shared descriptor writes use explicit ready cells so readers can avoid torn `span32` / `vector32` reads.                             |
| Generated source maps        | load-bearing | `--source-map` maps generated `.view.ts` accessors back to schema fields for debugging.                                              |
| WebGL instance demo          | diagnostic   | The demo is a browser-facing witness, not a universal performance guarantee.                                                         |

## Stable V1.8 Additions

- `SharedDynamicLayoutWriter` for `SharedArrayBuffer`-backed tail arenas.
- `sharedArenaCursorCell(...)`, `sharedDescriptorStateCell(...)`,
  `isSharedDescriptorPublished(...)`, `resetSharedDescriptor(...)`, and
  `publishSharedDescriptor(...)` in `@exornea/zeno-runtime`.
- `*Published(...)` shared writer methods that write payload and descriptor
  bytes before publishing a ready cell.
- Compiler `--source-map` and `emitProjectionFileWithSourceMap(...)`.
- WebGL instance streaming example comparing Zeno binary, FlatBuffers JS, and
  JSON object payloads.

## Explicit Non-Goals

- shared-memory graph serialization,
- automatic worker lifecycle management,
- mandatory `SharedArrayBuffer` use for normal dynamic writers,
- statement-level generated source maps,
- cross-language IDL compatibility.

## Witness Case

- Shared writer tests: [dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)
- Source map tests: [source-map.test.ts](../tests/compiler/source-map.test.ts)
- Public API snapshot: [public-api.test.ts](../tests/public-api.test.ts)
- WebGL benchmark notes: [performance-comparison.md](performance-comparison.md)
- Release gate: `npm run release:check`

## Methodological Note

The shared-memory control cells are host-native `Int32Array` synchronization
words. They are not part of the portable Zeno binary ABI. The serialized record
fields and descriptors still use the schema endianness through `DataView`.
