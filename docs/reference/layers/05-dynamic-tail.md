# Layer 5 - Dynamic Tail Views / Writers

## Purpose

Represent text, bytes, vectors, and dynamic struct vectors through descriptors
and explicit writer APIs.

## Public API

```ts
user.nameView().bytes();
user.nameView().text();
user.tagsView().textAt(0);
startsWithAscii(user.nameView().bytes(), "debug_");
includesAscii(user.nameView().bytes(), "_test");
hashBytes(user.nameView().bytes());

spanStartsWithAscii(view, UserView.nameOffset, "debug_");
spanIncludesAscii(view, UserView.nameOffset, "_test");
spanHashBytes(view, UserView.nameOffset);

const writer = UserView.createWriter(view);
UserView.writeName(writer, "Zeno");
```

## Guarantees

- `Span32` and `Vector32` descriptors stay explicit
- text decode is opt-in
- writers return or update caller-owned buffers
- byte predicates can compare or hash ASCII-oriented payloads without creating
  JavaScript strings
- descriptor-level `span*` predicates can avoid constructing a span view and
  `Uint8Array` when the loop already owns the generated descriptor offset

## Non-Guarantees

- no claim that text decode is a scalar hot path
- no implicit `textArray()` materialization in projection access
- no cached `.text()` result on live views
- no schema evolution compatibility shim

## When To Use

Use this layer for payloads that cannot be fixed-size scalar fields.

## Lower Layer Dependency

Layer 0 defines descriptors. Layer 4 exposes dynamic views from cursor records.

## Tests / Witness

- `tests/runtime/dynamic-layout.test.ts`
- `packages/bench/dynamic-layout.mjs`
