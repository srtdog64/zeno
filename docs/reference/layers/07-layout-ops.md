# Layer 7 - Layout Ops / Release Gate

## Purpose

Make layout changes visible during review, CI, and release.

## Public API

```sh
zeno-codegen ./src/model.zeno.ts ./src/model.view.ts --manifest ./src/model.layout.json
zeno-inspect ./src/model.zeno.ts
zeno-diff-layout ./old.layout.json ./new.layout.json
```

## Guarantees

- manifests expose byte length, alignment, field offsets, and layout hash
- diff output classifies breaking changes and version-routed additions
- malformed manifest inputs are rejected at the CLI boundary

## Non-Guarantees

- layout diff does not provide schema evolution
- `layoutHash` is not a cryptographic integrity hash
- incompatible buffers still require application-level version routing

## When To Use

Use this layer in CI, release review, and migration planning.

## Lower Layer Dependency

Layer 0 supplies the layout facts that manifests inspect and compare.

## Tests / Witness

- `tests/compiler/layout-manifest.test.ts`
- `scripts/consumer-smoke.mjs`
