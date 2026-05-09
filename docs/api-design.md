# API Design

Zeno exposes two API layers on purpose: a static hot-path API and a projection
view API. They should not be collapsed into one abstraction.

Schema authors use `.zeno.ts` files and `import type { z } from "@exornea/zeno-types"`.
Runtime code imports generated `.view.ts` classes.

## Claim Status

| Property | Status | Reason |
| --- | --- | --- |
| Static scalar accessors are the scan hot path | load-bearing | They avoid per-record view allocation and are close to direct `DataView` timing. |
| Generated numeric scan kernels are the aggregate hot path | load-bearing | They give TS callers direct aggregate loops without handwritten offset math or per-record views. |
| Cursor views are the ergonomic record API | load-bearing | They support named properties, nested views, and dynamic fields with one reusable object. |
| Per-record view allocation is discouraged | load-bearing | Current benchmark shows it is much slower and retains heap if stored. |
| Offset APIs are lower-level than index APIs | load-bearing | Offset APIs are the fastest hot path; index APIs trade some speed for safer call sites. |
| Materialization should be explicit | load-bearing | Implicit object graphs would erase the main projection benefit. |
| Pointer target APIs separate checked and unchecked offsets | candidate | Recursive links need low-level inspection, but normal dereference must prove the target record range. |
| Object writers are construction helpers, not materializers | candidate | `UserView.write(view, value)` writes into caller-owned memory and returns the tail writer for dynamic records. |

## Witness Case

- Witness: 1,000,000 fixed-stride `UserView` records in
  [performance-comparison.md](performance-comparison.md).
- Asymptotic form: `N` records with generated scalar accessors and optional cursor
  reuse over a shared `DataView`.

Current witness result:

- static accessor is within the measured noise floor for a single `age` field
- static scalar mix is measurably slower than direct `DataView` for
  `u64 + i32 + f64 + f32`
- index-based static accessors are safer but slower than byte-offset accessors
- per-record view creation is about `5x` direct `DataView` for the single-field scan

Methodological note: these numbers are local benchmark witnesses, not universal
runtime guarantees. See [performance-comparison.md](performance-comparison.md)
for command, memory, and promotion criterion.

## API Layers

### Static hot-path API

Use this for scans, filters, aggregates, and tight loops.

```ts
UserView.getAge(view, byteOffset);
UserView.setAge(view, value, byteOffset);
UserView.getAgeAt(view, index);
UserView.setAgeAt(view, value, index);
UserView.sumAge(view, count);
```

Rules:

- `getX(view, byteOffset)` takes a byte offset.
- `getXAt(view, index)` takes a record index and multiplies by
  `UserView.byteLength`.
- Prefer `getX(view, byteOffset)` for tight loops that already track byte offsets.
- Prefer `getXAt(view, index)` when call-site safety matters more than the last
  few nanoseconds.
- In scan loops, prefer incrementing a byte offset over retaining one view per
  record.
- Static accessors should not allocate.
- Static accessors should only cover scalar fields first. Dynamic fields need
  separate witness cases before being promoted.
- `sumX(view, count)` is generated for `number` scalar fields only. `i64`,
  `u64`, and `bool` do not get sum kernels in v1 because their accumulation
  semantics are different.
- Scan kernels validate the record count and overall range once, then run a
  direct stride loop.
- Cursor offset caching is an experimental emit mode, not the default API.
- Do not enable cursor offset caching globally until its timing benefit exceeds
  its retained heap cost.

### Cursor projection API

Use this when code reads multiple fields from one record or needs nested/dynamic
views.

```ts
const user = UserView.at(view);

for (let index = 0; index < count; index += 1) {
  user.moveTo(index);
  sum += user.age;
}
```

Rules:

- `rebase(byteOffset)` moves by byte offset.
- `moveTo(index)` moves by record index.
- `rebaseUnchecked(byteOffset)` and `moveToUnchecked(index)` skip range checks
  for loops that already prove bounds outside the cursor.
- Cursor APIs may expose dynamic view objects such as `nameView()` and
  `tagsView()`.
- Do not retain one cursor per record in hot paths.
- In hot scans, prefer static accessors first. If a cursor is required, use
  unchecked cursor movement only when the loop bounds are already checked.

### Pointer API

Generated `z.pointer<T>` fields expose three layers:

```ts
node.rawNextRelativeOffset;      // raw uint32 wire word
node.nextRelativeOffset;         // signed i32 or null
node.nextTargetOffset;           // checked DataView byte offset or null
node.uncheckedNextTargetOffset;  // unchecked DataView byte offset or null
node.nextInto(out);              // checked zero-allocation cursor rebase
```

Rules:

- Use `nextInto(out)` or `nextView()` for normal dereference.
- Use `nextTargetOffset` when code needs the byte offset and still wants range
  validation.
- Use `uncheckedNextTargetOffset` only for diagnostics, malformed-buffer tests,
  or code that intentionally defers validation.
- Generated pointer vector writers validate target ranges when the target view
  byte length is known.
- `DynamicLayoutWriter.writePointerVector` requires target byte length because
  the checked writer must prove every non-null target record range.

### Materialization API

Materialization is explicit and future-facing:

```ts
const object = user.materialize();
```

Rules:

- materialization may allocate plain JS objects
- materialization cost must be benchmarked separately
- generated views should not materialize implicitly from property access

### Object writer API

Use this when constructing a complete record from a plain TypeScript value.

```ts
UserView.write(view, {
  id: 42n,
  age: 37,
  score: 98.5,
  ratio: 0.75,
  handle: "zeno-user",
  name: "Zeno",
  tags: ["ts", "view"],
  avatar: [1, 2, 3],
});
```

Rules:

- object writers write into caller-owned `DataView` memory
- fixed strings and fixed bytes are zero-padded before write
- ASCII string fields reject non-ASCII input instead of silently UTF-8 encoding it
- dynamic fields use the same tail arena as the lower-level writer API
- generated object writers do not imply read-side object materialization
- `vector<struct>` write support is promoted only for fixed-size element structs

### Dynamic writer API

Use this when constructing dynamic records by hand. Generated views wrap the
low-level writer so callers do not pass descriptor offsets directly.

```ts
const writer = UserView.createWriter(view);

UserView.writeName(writer, "Zeno");
UserView.writeTags(writer, ["ts", "view"]);
UserView.writeAvatar(writer, [1, 2, 3]);
```

Rules:

- the writer owns tail cursor movement
- generated writer helpers own descriptor offsets
- descriptors remain relative to the object base
- writes fail with `RangeError` when the tail exceeds the backing `DataView`
- field-level helpers remain available for incremental construction

## Promotion Criterion

Promote an API shape to load-bearing when:

- it has generated code support
- it has a benchmark witness or correctness test
- it has a documented failure mode or discouraged usage

Do not promote dynamic field static APIs until:

- byte-slice access is benchmarked separately from text decode
- vector indexing is benchmarked without array materialization
- malformed descriptor behavior is covered by runtime tests

## Cross-References

- Current benchmark witness: [performance-comparison.md](performance-comparison.md)
- Hot-path optimization candidates: [hot-path-optimization-notes.md](hot-path-optimization-notes.md)
- TS-only schema convention: [ts-only-positioning.md](ts-only-positioning.md)
- Benchmark implementation: [packages/bench/index.mjs](../packages/bench/index.mjs)
- Runtime cursor support: [packages/runtime/src/index.ts](../packages/runtime/src/index.ts)
- Generated view witness: [examples/basic/src/model.view.ts](../examples/basic/src/model.view.ts)
- Dynamic writer witness: [examples/basic/src/main.ts](../examples/basic/src/main.ts)
- Layout measurement hierarchy: [layout-ir-coarsening.md](layout-ir-coarsening.md)
