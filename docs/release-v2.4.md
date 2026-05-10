# 2.4.0 Release Notes

Status: frontend and runtime boundary hardening release.

## Load-Bearing Changes

| Property                     | Status       | Reason                                                                                     |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| Frontend model document      | load-bearing | Zeno is AST-first over a restricted schema grammar, not a full TypeScript semantic parser. |
| Runtime boundary document    | load-bearing | Runtime hot projection paths explicitly reject `Result<T, E>`.                             |
| Architecture wording cleanup | load-bearing | Architecture must not imply arbitrary TypeScript type checker semantics are accepted.      |
| Documentation policy test    | load-bearing | Boundary claims are now tested so future docs do not drift silently.                       |
| Real game metadata witness   | diagnostic   | HexGL metadata gives a pinned public WebGL game distribution without storing asset bytes.  |

## Frontend Boundary

The TypeScript frontend is intentionally limited. It reads schema-only
`.zeno.ts` declarations and lowers them into Layout IR. The Layout IR is the
stable compiler boundary, which leaves room for future non-TypeScript frontends
without making TypeScript checker semantics the ABI source of truth.

## Runtime Boundary

Runtime hot paths remain value-returning APIs. Generated scalar getters, scan
kernels, cursor movement, and tight vector loops must not return `Result<T, E>`.
Boundary validation can be added as a separate wrapper layer when a concrete
untrusted-buffer workload needs it.

## Real Game Metadata

`bench:real-game` uses a pinned HexGL repository tree fixture containing path,
extension, size, kind, depth, and hash metadata. It intentionally stores no
asset payload bytes. The benchmark compares JSON metadata ingestion,
FlatBuffers JS table projection, and Zeno binary fixed-record scans. It remains
diagnostic until a browser version measures fetch, parse, and WebGL upload-list
preparation separately.

## Non-Goals

- No full TypeChecker semantic frontend.
- No runtime hot-path `Result` API.
- No async/backoff shared writer implementation in this release.
- No schema evolution ABI.
