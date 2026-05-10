# 2.2.0 Release Notes

Status: binary table scan and layout tooling minor release.

## Load-Bearing Changes

| Property                         | Status       | Reason                                                                                 |
| -------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| Scan kernel mode                 | load-bearing | Generated aggregate surface is now selectable with `none`, `sum`, `basic`, or `full`.  |
| Scan kernel emitter layer        | load-bearing | Kernel generation has its own compiler layer instead of living as emitter helpers.     |
| Layout manifest and diff tooling | load-bearing | Zeno defers schema evolution, so explicit layout review is the compatibility boundary. |
| Manifest input validation        | load-bearing | `zeno-diff-layout` rejects malformed manifests before comparing layout signatures.     |
| Scalar-only example              | diagnostic   | The example demonstrates the strongest fixed-layout scalar scan path.                  |

## Compiler

`zeno-codegen` now accepts:

```sh
zeno-codegen ./src/model.zeno.ts ./src/model.view.ts \
  --manifest ./src/model.layout.json \
  --scan-kernels=full
```

Scan kernel modes:

- `none`: emit only scalar getters/setters and index accessors
- `sum`: add numeric `sum<Field>()`
- `basic`: add `sum<Field>()`, `min<Field>()`, and `max<Field>()`
- `full`: add all scan kernels, including integer/bool equality predicates

The default remains `full` because Zeno's main read-side value is generated
table scanning. Use a narrower mode when generated file size matters more than
aggregate convenience.

## Layout Tooling

`zeno-inspect` prints a human-readable layout table from a `.zeno.ts` schema.
`zeno-diff-layout` compares two manifest files and exits nonzero when it finds
breaking layout changes.

`layoutHash` is a deterministic compatibility fingerprint, not a cryptographic
hash. It is useful for routing and review, not for adversarial integrity checks.

## Non-Goals

- No sparse optional fields or vtable-style schema evolution.
- No automatic compatibility shim for changed fixed-layout records.
- No cryptographic payload verification in the layout manifest.
