# 0.1.0 Release Candidate Notes

## Claim Status

| Property                         | Status       | Reason                                                                                                                        |
| -------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Fixed-layout projection compiler | load-bearing | This is the core Zeno identity and is covered by analyzer, snapshot, runtime, and example witnesses.                          |
| Static scalar hot path           | load-bearing | Benchmarks keep it near direct `DataView` for the supported fixed-layout workloads.                                           |
| Dynamic descriptors              | candidate    | `Span32` and `Vector32` are implemented and tested, but performance promotion still needs separate dynamic workloads.         |
| Pointer descriptors              | candidate    | `pointer32` supports explicit recursive references with checked dereference APIs, but graph serialization is not implemented. |
| Runtime ABI layer                | load-bearing | Runtime internals are split into range, scalar, descriptor32, fixed, pointer32, view, vector, and writer layers.              |
| Package surface                  | load-bearing | Root `exports` are closed and the packed consumer smoke test verifies codegen/import/runtime behavior.                        |

## Witness Case

- Build/test/codegen: `npm run check`
- Package dry-run: `npm run pack:check`
- Packed consumer smoke: `npm run consumer:smoke`
- Local benchmark: `npm run bench`
- Example execution: `node examples\basic\dist\main.js`
- Consumer smoke test details: install packed tarballs into a fresh project,
  run `npx zeno-codegen --help`, generate a `MiniView`, compile and execute it,
  and confirm deep imports fail.

## Promotion Criterion

Promote this candidate to `0.1.0` when:

- `npm run check` passes on a clean checkout.
- `npm run pack:check` shows only intended package contents.
- `npm run consumer:smoke` can import package roots, run `zeno-codegen`, compile
  generated code, execute runtime reads, and reject deep imports.
- README and CHANGELOG both describe dynamic and pointer APIs as candidate APIs.
- The release decision accepts that v0.1 is TS-only and not a FlatBuffers replacement for cross-language systems.

Do not promote dynamic or pointer APIs to stable until:

- dynamic string/vector workloads have separate benchmark witnesses,
- malformed buffer testing includes deterministic descriptor cases and
  seed-fixed pseudo-fuzz mutations,
- pointer graph serialization policy is defined or explicitly postponed,
- schema evolution compatibility policy exists.

## Methodological Note

The performance comparison is methodological and local. It supplies benchmark
shape, p95/p99/noise-floor handling, and per-record units. It does not supply a
universal runtime guarantee for all V8 versions, schemas, or machines.

## Cross-References

- [README.md](../README.md)
- [CHANGELOG.md](../CHANGELOG.md)
- [api-design.md](../reference/api-design.md)
- [api-stability.md](api-stability.md)
- [abi.md](../reference/abi.md)
- [performance-comparison.md](../human/performance-comparison.md)
- [test-plan.md](test-plan.md)
- [TODO.md](../llm/TODO.md)
