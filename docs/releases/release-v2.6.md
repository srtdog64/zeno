# 2.6.0 Release Notes

Status: split generated output release.

## What Changed

- `zeno-codegen` now accepts `--output=single|split`.
- `single` remains the default and keeps the historical one-file `.view.ts`
  output.
- `split` writes the requested output path as a barrel and emits one
  `*.view.ts` file per struct in a sibling `<name>.views/` directory.
- The compiler package now exposes `emitProjectionFileParts` and
  `emitProjectionFileBarrel` for build tools that want to own file writes.
- Packed consumer smoke verifies split codegen output from the installed
  compiler package.

## Why

Large TypeScript-owned renderer and data-heavy schemas can make one generated
view file expensive for editors, type-checkers, and bundlers. Split output is a
scale valve: it preserves the same generated API while letting projects keep
struct implementations in separate files.

## Current Limits

- `--source-map` is still single-file only.
- Split output is per struct, not yet per layer. Finer outputs such as
  `UserView.scalars.ts`, `UserView.scan.ts`, and `UserView.dynamic.ts` require
  separate bundle/type-check evidence before promotion.
- The single-file output remains the compatibility baseline.

## Verification

Run the normal release gate:

```sh
npm run release:check
```

At minimum, split output should be covered by:

- generated E2E type-check tests
- packed consumer smoke
- package dry-runs
- version and package policy checks
