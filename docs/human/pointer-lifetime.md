# Pointer Lifetime, Simply

This page explains one pointer problem in plain words.

## The Short Version

A Zeno pointer can prove:

- the target offset is inside the buffer,
- the target has enough bytes,
- the target starts at the right alignment,
- the pointer is not the null value.

But a pointer cannot prove:

- the old object is still alive,
- the slot was not reused for another object,
- the target still means what you think it means.

That second list is the lifetime problem.

## Box Address Example

Imagine a warehouse.

You have a note:

```txt
Box 12
```

The note can be correct as an address. Box 12 exists.

But yesterday Box 12 had an apple. Today someone removed the apple and put a
book there.

The address is still valid, but the thing at that address changed.

That is what a stale pointer is.

```txt
valid address != same object is still alive
```

## What `pointer32` Does

`pointer32` is the small and fast pointer.

It stores a relative byte offset.

Use it when data lives together for a short time:

- one frame,
- one worker message,
- one temporary graph,
- one renderer buffer build.

It is good for hot paths because it stays small.

It does not track object deletion.

## When You Need More

If records can be deleted and slots can be reused, use a lifetime layer above
`pointer32`.

Zeno provides two simple choices.

## Choice 1 — `ArenaEpoch`

Use this when the whole buffer changes at once.

Example:

- frame 1 buffer,
- frame 2 buffer,
- worker snapshot,
- temporary renderer data.

Mental model:

```txt
This pointer is only valid for this arena version.
```

When the whole arena is reset, bump the epoch.

Old cached references become stale.

This is cheap, but it only works at arena/frame level.

## Choice 2 — `GenerationHandleTable`

Use this when individual objects can be deleted.

Instead of storing only an offset, you store:

```txt
slot + generation
```

Mental model:

```txt
slot      = which box
generation = which owner of that box
```

If object A used slot 7, then got deleted, slot 7 can be reused by object B.
When that happens, the generation number changes.

An old handle to object A will no longer match.

That catches stale references.

## Which One Should I Pick?

| Situation                           | Pick                    |
| ----------------------------------- | ----------------------- |
| Fast temporary graph                | `pointer32`             |
| Whole buffer replaced every frame   | `ArenaEpoch`            |
| Editor objects can be deleted       | `GenerationHandleTable` |
| Saved files or public data contract | app versioning          |

## Rule of Thumb

If the data is only used during one short operation, `pointer32` is enough.

If the data can be deleted, reused, or kept around, add lifetime tracking.

Do not put lifetime tracking into every hot pointer. Pay for it only where the
application needs it.
