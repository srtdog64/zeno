# 1.1.0 Release Notes

## Claim Status

| Property                     | Status       | Reason                                                                                             |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| Raw record ABI compatibility | load-bearing | v1.1 must not add mandatory bytes to generated records.                                            |
| Optional frame header        | load-bearing | File and network boundaries can now identify Zeno payloads without changing raw record projection. |
| Source-file analyzer API     | load-bearing | CLI codegen no longer needs a fake `ts.Program` argument.                                          |
| Legacy analyzer API          | diagnostic   | `analyzeProjectionFile(program, sourceFile)` remains as a compatibility wrapper.                   |

## Stable V1.1 Additions

- Optional `ZENO` frame header helpers in `@exornea/zeno-runtime`.
- Frame metadata for major/minor version, payload endianness, flags, layout hash,
  payload offset, and payload byte length.
- `analyzeProjectionSourceFile(sourceFile, options)` in `@exornea/zeno-compiler`.
- `zeno-codegen` uses the source-file analyzer path internally.

## Explicit Non-Goals

- mandatory per-record headers,
- automatic schema hashing,
- pointer graph serialization,
- runtime DAG enforcement for pointer graphs.

## Witness Case

- Frame helper tests: [frame.test.ts](../tests/runtime/frame.test.ts)
- Public API snapshot: [public-api.test.ts](../tests/public-api.test.ts)
- ABI contract: [abi.md](../reference/abi.md)
- Release gate: `npm run release:check`

## Methodological Note

The frame header is a container boundary, not a replacement for the raw record
ABI. Generated views still read records from any caller-provided `DataView` and
`baseOffset`.
