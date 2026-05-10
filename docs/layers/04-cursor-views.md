# Layer 4 — Cursor Projection Views

## Purpose

Provide ergonomic record-level access through one reusable object.

## Public API

```ts
const user = UserView.at(view);
user.moveToUnchecked(index);
user.age;
user.nameView();
```

## Guarantees

- named properties for record code
- nested and dynamic field access
- cursor reuse without retaining one object per record

## Non-Guarantees

- not the default fastest path for scalar scans
- dynamic text decode remains explicit
- retaining one cursor per record defeats the allocation model

## When To Use

Use this layer when a workflow reads several fields from one record or needs
nested/dynamic views.

## Lower Layer Dependency

Layers 1 and 2 supply offsets and scalar access mechanics.

## Tests / Witness

- `tests/runtime/dynamic-layout.test.ts`
- `packages/bench/index.mjs`
