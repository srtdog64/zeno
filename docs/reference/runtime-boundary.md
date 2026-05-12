# Runtime Boundary

Status: v2.4 runtime failure boundary note.

## Load-Bearing Claims

| Property                                   | Status       | Reason                                                                                                                         |
| ------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Hot path rejects `Result<T, E>`            | load-bearing | Generated scalar getters, scan kernels, cursor movement, and tight vector loops must stay value-returning APIs.                |
| Runtime bounds failures throw `RangeError` | load-bearing | Invalid memory access is a memory boundary failure, not a recoverable compiler diagnostic.                                     |
| Boundary validation is separate            | load-bearing | Untrusted buffers should be validated before entering projection loops.                                                        |
| Shared writer high contention is separate  | candidate    | A single shared cursor is not the high-contention industrial path; sharding or future async/backoff writers are separate work. |

## Rule

Runtime hot projection APIs must not return `Result<T, E>`.

`Result` belongs in:

- compiler analysis
- lowering
- validation
- optional boundary validation wrappers

`Result` does not belong in:

- generated scalar getters
- generated scan kernels
- cursor movement
- pointer dereference hot loops
- tight vector element access

The hot path must stay shaped like direct `DataView`: value-returning reads plus
fail-closed range errors when the caller violates the memory contract.

## Boundary Shape

Use checked APIs at trust boundaries:

```ts
const view = UserView.at(dataView, baseOffset);
view.moveTo(index);
```

Use unchecked APIs only after a caller has already proved the range:

```ts
const user = UserView.at(dataView);

for (let index = 0; index < count; index += 1) {
  user.moveToUnchecked(index);
  total += user.age;
}
```

For untrusted buffers, validate once before the loop or add a separate safe
wrapper. Do not push recoverable `Result` objects into the inner projection
loop.

## Shared Writer Boundary

The synchronous shared writer is suitable for low-contention or sharded append
paths. A single shared cursor is not the recommended high-contention path.

Preferred high-contention shape:

```txt
worker 0 -> shard 0 cursor + shard 0 payload
worker 1 -> shard 1 cursor + shard 1 payload
worker 2 -> shard 2 cursor + shard 2 payload
```

Future async/backoff writer work should be a separate layer. It should not be
hidden inside the synchronous `reserve(...)` API unless a benchmark shows the
tradeoff is consistently better.

## Witness

- `tests/runtime/dynamic-layout.test.ts` covers descriptor and range failures.
- `scripts/shared-writer-stress.mjs` covers shared writer stress at the Node
  worker boundary.
- `packages/bench/index.mjs` and `packages/bench/dynamic-layout.mjs` keep hot
  projection and dynamic boundary costs separate.
