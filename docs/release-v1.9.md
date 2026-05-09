# 1.9.0 Release Notes

Status: dynamic struct vector read/write codegen release.

## Load-Bearing Changes

| Property                                 | Status       | Reason                                                                                                                               |
| ---------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `z.dynamicVector<T>` marker              | load-bearing | Separates variable-record vectors from fixed-stride `z.vector<T>`.                                                                   |
| `dynamic-struct` Layout IR element       | load-bearing | Represents a `Vector32` table of object-relative struct offsets.                                                                     |
| `DynamicStructVectorView` codegen        | load-bearing | Generated views can read variable-size struct records without pretending they are fixed-stride.                                      |
| Dynamic struct vector writer             | load-bearing | Uses `writeDynamicStructVector*` and `write*AtBase(...)` so nested descriptors remain element-relative.                              |
| Validator kind dispatch                  | diagnostic   | Removes the rule-list over-application smell without changing emitted ABI.                                                           |
| Enumerable source locations              | diagnostic   | Makes source metadata survive ordinary JSON serialization; tests strip it explicitly where the snapshot wants source-independent IR. |
| `textAt(i)` string vector API            | diagnostic   | Names string allocation/decode sites explicitly while keeping the v1 `at(i)` alias for compatibility.                                |
| Shared dynamic struct vector publication | diagnostic   | Extends the existing shared-writer ready-cell pattern to dynamic struct vectors.                                                     |
| Optional/sparse fields                   | candidate    | Requires presence metadata or vtable ABI.                                                                                            |
| Discriminated unions                     | candidate    | Requires explicit tag and variant table ABI.                                                                                         |
| Varint / LEB128                          | retired      | Conflicts with Zeno's fixed-offset direct projection model.                                                                          |

## Witness Case

```ts
import type { z } from "@exornea/zeno-types";

export interface Item {
  id: z.i32;
  label: z.utf8;
}

export interface Bag {
  items: z.dynamicVector<Item>;
}
```

Generated access and write:

```ts
bag.itemsView(); // DynamicStructVectorView<ItemView>
BagView.write(view, { items: [{ id: 1, label: "alpha" }] });
```

Dynamic string vectors expose the allocation boundary explicitly:

```ts
bag.labelsView().bytesAt(0); // zero-copy byte slice
bag.labelsView().textAt(0); // TextDecoder + JS string allocation
```

Shared writer publication:

```ts
sharedWriter.writeDynamicStructVectorPublished(
  BagView.itemsOffset,
  [{ id: 1, label: "alpha" }],
  ItemView.byteLength,
  (view, writer, value, baseOffset, littleEndian) =>
    ItemView.writeInto(view, writer, value, baseOffset, littleEndian),
  stateCell,
);
```

## Promotion Criterion

Promote dynamic struct vector writing only when:

- the writer API can write nested dynamic descriptors relative to each element
  base, not the parent vector base,
- generated tests cover at least one dynamic field inside the element struct,
- consumer smoke covers pack/install/codegen/build/run for a generated
  `dynamicVector<T>` schema,
- malformed offset-table and descriptor-base cases are covered by runtime tests.

The first three criteria are met in this release. Keep malformed offset-table
fixtures as the next hardening step before widening `dynamicVector<T>` beyond
struct elements.

Do not promote optional fields or unions in the same release unless their
presence/tag metadata is represented in Layout IR and documented in the ABI.

## Methodological Note

This release borrows the offset-table shape from dynamic binary projection
formats, but not a full FlatBuffers vtable model. `z.dynamicVector<T>` is a
dynamic record vector, not schema-evolution support.
