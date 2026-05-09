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

For a scoped public publish, use the release publisher:

```powershell
npm run release:publish
```

The publisher uses dependency order, skips packages whose current version is
already published, and accepts npm OTP when needed:

```powershell
npm run release:publish -- --otp=123456
```

For a packaging-only rehearsal:

```powershell
npm run release:publish:dry-run
```

## GitHub Actions Publish

The normal release path is `.github/workflows/release.yml`, triggered by a
`v*` tag or by manual `workflow_dispatch`.

Configure npm Trusted Publishing for each package:

- Provider: GitHub Actions
- Organization or user: `srtdog64`
- Repository: `zeno`
- Workflow filename: `release.yml`
- Environment: leave blank unless the workflow is changed to use a GitHub
  environment

The workflow uses OIDC with `id-token: write`, Node 24, and npm 11.5.1 or
newer. No long-lived `NPM_TOKEN` is required. Already-published package
versions are skipped by `scripts/publish-packages.mjs`, so a partially completed
release can be retried safely.

Local publish is only the fallback path for the first package publish,
recovering a failed release, or testing npm account permissions.

## Preconditions

- Confirm npm ownership of the `@exornea` scope.
- Confirm npm Trusted Publishing is configured for every already-published
  package.
- Confirm `CHANGELOG.md` has an entry for the package version.
- Confirm README install examples match the package names being published.
- Confirm `docs/performance-comparison.md` records the latest benchmark witness
  if the release announcement mentions speed.

## Do Not Publish When

- `package-lock.json` and workspace package versions disagree.
- `npm pack --dry-run` includes source fixtures, tests, or private scripts.
- consumer smoke fails on packed tarballs.
- the package scope has not been reserved by the publisher account.
