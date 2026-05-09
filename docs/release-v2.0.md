# 2.0.0 Release Notes

Status: v2 API cleanup release.

## Load-Bearing Changes

| Property                                | Status       | Reason                                                                                                   |
| --------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| String vector `at(i)` returns bytes     | load-bearing | Restores the projection-first rule: indexed access is zero-copy unless the method name says text decode. |
| String array `at(i)` returns bytes      | load-bearing | Keeps fixed arrays and dynamic vectors consistent.                                                       |
| `textAt(i)` / `textArray()` decode APIs | load-bearing | Makes JS string allocation explicit at every decode site.                                                |
| Removed cursor-offset optimizer flag    | load-bearing | The retired v1 diagnostic did not clear its benchmark or heap promotion gate.                            |
| Explicit analyzer layout result         | diagnostic   | Removes the hidden `state.layouts.set(...)` side effect from struct lowering.                            |
| Validator kind dispatch                 | diagnostic   | Keeps validation rules aligned with the field kinds they actually handle.                                |

## Breaking Changes

Dynamic string vectors:

```ts
const tags = user.tagsView();

tags.at(0); // v2: Uint8Array
tags.bytesAt(0); // same zero-copy byte slice
tags.textAt(0); // explicit TextDecoder + JS string
tags.textArray(); // explicit materialized string[]
```

Fixed string vectors and fixed string arrays follow the same rule:

```ts
labels.at(0); // Uint8Array
labels.textAt(0); // string
```

The `--optimize-cursor-offsets` CLI flag is removed. Use generated static
accessors and scan kernels for hot scalar loops.

## Migration

Replace string-vector `toArray()` calls with `textArray()` when the caller wants
strings:

```ts
// v1
const tags = user.tagsView().toArray();

// v2
const tags = user.tagsView().textArray();
```

Replace hot string `at(i)` loops with either bytes or explicit text:

```ts
for (let index = 0; index < tags.length; index += 1) {
  consumeBytes(tags.bytesAt(index));
  consumeText(tags.textAt(index));
}
```

## Methodological Note

This release is a semantic cleanup, not a new ABI family. It breaks APIs whose
names hid allocation cost so that Zeno's public surface matches its
projection-first thesis.
