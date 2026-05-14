# Pointer Lifetime

`pointer32` proves addressability, not liveness.

Checked pointer APIs prove that a target byte range is inside the backing
`DataView` and aligned for the target struct. They cannot prove that the bytes
still represent the logical object the application meant to reference after an
arena slot has been deleted, reused, or rewritten.

Use lifetime helpers above `pointer32` only when records can outlive a single
transient frame.

## Option A — Arena Epoch

`ArenaEpoch` is the coarse option.

Use it when a whole arena is treated as one lifetime domain, such as renderer
frame buffers, worker-produced snapshots, or transient simulation data.

```ts
const epoch = new ArenaEpoch();
const snapshot = epoch.snapshot();

// Later, before using cached references into the arena:
epoch.assertCurrent(snapshot);
```

When the arena is reset or repurposed, call `epoch.bump()`. Any old snapshot is
then stale.

This does not detect individual object deletion. It only says whether the whole
arena lifetime changed.

## Option B — Generation Handle Table

`GenerationHandleTable` is the object-level option.

It returns handles shaped like `{ slot, generation }`. Releasing a handle bumps
the slot generation. If the slot is reused, stale handles with the old generation
no longer resolve.

```ts
const table = new GenerationHandleTable();
const handle = table.allocate(offset, byteLength, alignment);

const targetOffset = table.resolveOrThrow(view, handle);

table.release(handle);
```

Use this for editor/object-graph data where records can be deleted and slots can
be reused while older references may still exist.

## Why Not Put This Into `pointer32`?

`pointer32` stays a 4-byte field-relative offset so fixed-layout hot paths remain
small and direct. Generation checks require either an extra table lookup or more
bytes in the pointer payload. That cost belongs in an explicit lifetime layer,
not in every pointer dereference.

## Decision Rule

| Situation                              | Use                                      |
| -------------------------------------- | ---------------------------------------- |
| Fixed transient graph inside one frame | `pointer32` + traversal budget           |
| Whole arena replaced per frame         | `ArenaEpoch`                             |
| Records deleted/reused individually    | `GenerationHandleTable`                  |
| Cross-language or long-lived storage   | Application versioning or another format |
