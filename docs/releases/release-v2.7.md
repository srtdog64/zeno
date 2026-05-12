# 2.7.0 Release Notes

Status: documentation split and maintainer-context release.

## What Changed

- Documentation is now grouped by reader type:
  - `docs/human/` for short human-facing usage and positioning docs.
  - `docs/llm/` for AI-assisted repository orientation, TODOs, and maintenance
    rules.
  - `docs/reference/` for ABI, API, architecture, runtime boundary, and layer
    reference.
  - `docs/releases/` for release notes.
- The root `README.md` stays concise and follows the eight-section public
  structure.
- The longer pre-shortening README narrative is preserved at
  `docs/llm/expanded-readme.md` for LLM-assisted work and maintainer context.
- Documentation tests now target the new reader-split paths.
- Formatting scripts use directory groups instead of a long list of root-level
  docs files.

## Why

The public README should help a human decide quickly whether Zeno fits their
buffer-heavy TypeScript project. The longer context is still useful for
maintenance and AI-assisted review, but it should not make the first reading path
heavy.

## Verification

Run the normal release gate:

```sh
npm run release:check
```

At minimum, this release should be covered by:

- documentation policy tests
- layer-model tests
- full format check
- version and package policy checks
