# Release Checklist

This checklist is the publish gate for Zeno package releases.

## Load-Bearing Checks

| Check | Status | Reason |
| --- | --- | --- |
| Workspace versions are aligned | load-bearing | All published packages use the same version and internal dependency pins. |
| Package root exports are stable | load-bearing | Consumers must not rely on unpublished subpaths. |
| Tarball contents are small and intentional | load-bearing | Only `dist/` and compiler `bin/` should ship. |
| Packed consumer smoke passes | load-bearing | It verifies the real npm consumer path, not only workspace links. |
| Benchmark claims are refreshed | diagnostic | Performance witnesses are local and should not block correctness releases. |

## Commands

Run this before tagging or publishing:

```powershell
npm run release:check
```

This runs:

- version and internal dependency policy checks
- clean build
- full test suite
- example codegen
- package dry-runs
- packed consumer smoke test

For a scoped public publish, use explicit package order:

```powershell
npm publish --workspace @exornea/zeno-types --access public
npm publish --workspace @exornea/zeno-schema --access public
npm publish --workspace @exornea/zeno-runtime --access public
npm publish --workspace @exornea/zeno-compiler --access public
```

## Preconditions

- Confirm npm ownership of the `@zeno` scope.
- Confirm `CHANGELOG.md` has an entry for the package version.
- Confirm README install examples match the package names being published.
- Confirm `docs/performance-comparison.md` records the latest benchmark witness
  if the release announcement mentions speed.

## Do Not Publish When

- `package-lock.json` and workspace package versions disagree.
- `npm pack --dry-run` includes source fixtures, tests, or private scripts.
- consumer smoke fails on packed tarballs.
- the package scope has not been reserved by the publisher account.

