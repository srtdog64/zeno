# 2.8.0 Release Notes

## Status

Hot-loop guard and decode-free predicate release.

## What Changed

- Generated view classes now include:

  ```ts
  static assertRecordRange(view: DataView, count: number, baseOffset = 0): void
  ```

  This is the official assert-once entrypoint for loops that then use
  `moveToUnchecked`, raw offsets, or generated static accessors.

- `@exornea/zeno-runtime` adds three byte helpers:
  - `endsWithAscii(bytes, suffix)`
  - `includesAscii(bytes, needle)`
  - `hashBytes(bytes, seed?)`
- `@exornea/zeno-runtime` also adds descriptor-level span helpers:
  - `spanEqualsAscii(view, descriptorOffset, value, baseOffset?, littleEndian?)`
  - `spanStartsWithAscii(view, descriptorOffset, prefix, baseOffset?, littleEndian?)`
  - `spanEndsWithAscii(view, descriptorOffset, suffix, baseOffset?, littleEndian?)`
  - `spanIncludesAscii(view, descriptorOffset, needle, baseOffset?, littleEndian?)`
  - `spanHashBytes(view, descriptorOffset, baseOffset?, littleEndian?, seed?)`

- Dynamic-layout benchmarks now use the public `hashBytes` helper and include
  the descriptor-level `spanEqualsAscii` path.
- Renderer-surface benchmarks now include the `@exornea/zeno-buffers` planned
  pack path. This is the primary generic buffer API, not a claim that a generic
  two-pass plan beats every renderer-specific fused loop.
- Generated-code E2E tests execute `assertRecordRange` across fuzzed scalar
  schemas.

## Why

Checked cursor movement is intentionally slower because it validates every
record movement. The hot-loop pattern should be:

```ts
RowView.assertRecordRange(view, count);

const row = RowView.at(view);
for (let index = 0; index < count; index += 1) {
  row.moveToUnchecked(index);
  // scalar reads here
}
```

Dynamic text remains outside Zeno's strongest hot-path claim. The new byte
helpers make common ASCII predicates allocation-free without pretending that
UTF-8 decoding is free.

The broader hot-loop rule is:

```txt
loop before: assert / create plan / validate range
loop inside: raw offset / unchecked cursor / typed-array plan
```

## Compatibility

This is additive for runtime and generated view APIs. Regenerate checked-in
`.view.ts` files so the new `assertRecordRange` method appears in generated
classes.
