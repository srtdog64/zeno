# Documentation Rules

Zeno documentation must separate claim weight, promotion gates, witness cases,
references, and methodological borrowing. A document should not leave important
claims floating without status or route.

## Source

This rule set was extracted on 2026-05-08 from analysis of
`NATIVE-F-MINIMAL-DEFINITION.md`.

Methodological note: this citation is methodological and structural only. The
source supplies a documentation shape, not Zeno's technical conclusions or
benchmark results.

## Status Table

| Property | Status | Reason |
| --- | --- | --- |
| Load-bearing vs diagnostic split | load-bearing | Zeno claims need explicit weight so architecture and benchmarks can be reviewed without status drift. |
| Promotion criterion | load-bearing | New claims should not become phase goals or README claims without measurable gates. |
| Witness case | load-bearing | Abstract compiler and performance claims need a concrete failing or passing case. |
| Cross-reference graph | load-bearing | A claim must route to code, docs, tests, or external prior art. |
| Methodological note | diagnostic | It improves source hygiene but does not decide whether Zeno works. |
| Pattern note / structural rhyme | diagnostic | It records useful similarity without making a dependency claim. |

Unclassified properties are TODO until assigned one of:
`load-bearing`, `diagnostic`, `candidate`, or `retired`.

## Promotion Criterion

Promote a documentation claim to load-bearing when:

- it affects a public Zeno design target, phase gate, or benchmark conclusion
- it has at least one witness case in the repo
- it has a cross-reference to code, test, benchmark output, or prior art

Do not promote a performance claim into README headline status unless:

- `npm run bench` includes a reproducible command and record count
- retained heap, external memory, and timing are all reported
- the comparison includes at least one plain baseline

Promotion is a review trigger, not an automatic edit.

## Witness Case

- Witness: 1,000,000 fixed-stride `UserView` records in
  [performance-comparison.md](performance-comparison.md).
- Asymptotic form: `N` fixed-layout records with stride `S`, backed by one
  contiguous `ArrayBuffer` and projected through generated accessors.

New abstract claims should add their own smallest witness case instead of
replacing this one.

## Cross-Reference Rules

Every non-trivial claim should point to one of:

- local code path, for example [runtime](../packages/runtime/src/index.ts)
- local test path, for example [dynamic-layout.test.ts](../tests/runtime/dynamic-layout.test.ts)
- local doc section, for example [layout-ir-coarsening.md](layout-ir-coarsening.md)
- external source in `author year section` form

If a claim is intentionally self-evident, mark it as self-evident. Do not use
vague references such as "seen elsewhere" or "known pattern".

## Pattern Note

Pattern note: `layout-ir-coarsening.md` and this file share the same motif:
make the observation layer explicit before making a conclusion. This is a
structural rhyme, not a dependency chain. The measurement hierarchy can remain
valid even if this documentation style changes, and this style can remain useful
even if the compiler hierarchy changes.

## Anti-Patterns

- treating every claim with the same weight
- moving a diagnostic note into a phase goal without a promotion criterion
- publishing an abstract rule without a witness case
- adding prior art without saying what was borrowed
- saying two patterns are similar without separating dependency from rhyme

