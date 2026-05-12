# Schema Evolution Notes

This document records the v1 policy for optional fields and discriminated
unions. It is a design boundary, not an implementation plan for the current
ABI.

## Claim Status

| Property                                                                          | Status       | Reason                                                                                         |
| --------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| Fixed field order is the v1 ABI                                                   | load-bearing | Current generated views rely on compile-time offsets.                                          |
| Optional fields require metadata                                                  | load-bearing | Absence cannot be represented by a fixed inline field without a presence model.                |
| Discriminated unions require a tag ABI                                            | load-bearing | Variant interpretation must be explicit and stable.                                            |
| TypeScript optional syntax is documentation only                                  | diagnostic   | It is familiar syntax, but accepting it without ABI meaning would be unsafe.                   |
| Schema evolution is deferred because Zeno's positioning does not face its drivers | load-bearing | Adding evolution would dilute the v1 thesis to solve problems Zeno's target users do not have. |

## Why Zeno Defers Schema Evolution

Schema evolution does not mean "schemas change." Schemas always change.
Schema evolution means **old and new readers/writers can remain alive at the
same time while the schema changes**.

That distinction is the whole decision. If producer and consumer are deployed
together, then a schema edit is just a coordinated breaking change: regenerate
the view, rebuild the bundle, and discard or migrate any old transient data. If
old readers must keep reading new data, or new readers must keep reading old
data, then evolution is load-bearing.

Schema evolution is not a fashion feature. It exists in Protobuf, FlatBuffers,
Avro, and Cap'n Proto because real systems hit three concrete pain points:

- **Time**: persisted data outlives its writer. A record written years ago must
  still be readable after the schema has changed many times.
- **Space**: independent deploys cannot upgrade atomically. During a rolling
  release, new writers send data to old readers and vice versa.
- **Control**: a public schema cannot force every consumer to upgrade. Once a
  binary contract is published, breaking it requires coordination Zeno authors
  do not have.

For Zeno's target audience these three drivers do not apply:

| Driver                           | Applies to Zeno? | Reason                                                                                                                                                                   |
| -------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Time (long-term persistence)     | no               | Generated views project transient buffers inside a single process lifetime. Persistent stores like SQLite, IndexedDB schema migrations, or Protobuf are the right tools. |
| Space (independent deploys)      | no               | Schemas and views ship in the same TypeScript bundle. Producer and consumer compile from the same `.zeno.ts` source.                                                     |
| Control (uncontrolled consumers) | no               | Zeno authors own both the writer and reader. There is no third party reading the binary on a schedule the author cannot break.                                           |

The practical test:

| Question                                                            | Zeno answer |
| ------------------------------------------------------------------- | ----------- |
| Do producer and consumer deploy atomically?                         | yes         |
| Can changing the schema regenerate both writer and reader together? | yes         |
| Does the binary outlive the deploy that wrote it?                   | no          |

When the answers are `yes / yes / no`, schema evolution solves no current Zeno
problem. The schema will still change, but compatibility windows have length
one. Zeno should spend complexity on fixed-layout projection, generated access,
and fail-fast layout mismatch detection, not on carrying deprecated fields
forever.

If a future Zeno user runs into any of these drivers, that is a signal Zeno is
the wrong tool for that scenario, not a signal to add evolution to Zeno. Reach
for FlatBuffers, Protobuf, or Cap'n Proto when these constraints become
load-bearing. See [ts-only-positioning.md](ts-only-positioning.md) for the
positioning that makes deferral coherent.

Adding evolution would break the v1 hot-path thesis: vtable indirection forces
an extra pointer chase per scalar read, the compatibility matrix expands the
test surface, and the codegen must track field ids, default values, and
deprecated paths across versions. None of that cost is recovered for the
single-deploy, single-process Zeno user.

## Where Zeno Fits, And Where It Does Not

The single rule:

> **Zeno fits when data lifetime is shorter than the deploy that wrote it.**
> **Schema evolution fits when multiple schema versions must be alive at once.**

If a record is created, read, and discarded inside one running version of the
application, schema evolution is irrelevant. The schema is the same code on
both sides because there is only one side.

### Fits Zeno (event-style, ephemeral, in-flight)

| Workload                                             | Why Zeno fits                                           |
| ---------------------------------------------------- | ------------------------------------------------------- |
| WebGL / canvas instance streaming                    | Each frame is rebuilt; the buffer dies at end of frame. |
| Worker ↔ main thread IPC over `SharedArrayBuffer`    | Both sides ship in the same bundle.                     |
| Real-time analytics or telemetry pipelines           | Records flow through and are aggregated, not stored.    |
| Network packets where each request is self-contained | Wire format dies with the request.                      |
| In-memory caches and indexes                         | Rebuilt on restart from the source of truth.            |
| Inter-process channels in the same product           | Producer and consumer deploy together.                  |
| Game session state during a single match             | Discarded when the match ends.                          |

These are the workloads Zeno is built for. They share a property: **the
producer and consumer are the same code, running at the same moment, on data
that does not outlive them**. Most product surfaces in event-driven, real-time,
or streaming systems land here. Adding/removing fields is a normal change that
ships in one deploy because nothing else has to be aware of it.

### Does Not Fit Zeno (persistent, long-lived, out-of-band)

| Workload                                                             | Why Zeno is the wrong tool                          |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| Database row formats                                                 | Rows persist across schema changes for years.       |
| User-saved files (`.docx`, `.psd`, save games)                       | Files written by v1 are reopened by v10.            |
| Long-term audit logs (banking, compliance)                           | Old records must remain readable indefinitely.      |
| Public APIs for external consumers                                   | The author cannot force consumer upgrade.           |
| Cross-deploy server↔client wire formats                              | Rolling deploys mean version skew is normal.        |
| Plugin / extension binary formats                                    | Plugins ship on a different schedule than the host. |
| IoT firmware with non-atomic update                                  | Old firmware in the field reads new central data.   |
| Long-running game **persisted state** (player saves, progression DB) | Save files outlive the deploy that wrote them.      |

For these, reach for FlatBuffers, Cap'n Proto, Protobuf, or a real database
with migration tooling. Zeno is not trying to compete here.

### How To Decide

A two-question diagnostic:

1. Will this binary still need to be readable after a future deploy that
   changes the schema?
2. Are the producer and consumer outside this team's coordinated upgrade?

If both answers are "no", Zeno fits and evolution is not your problem. If
either is "yes", that workload belongs to a tool with first-class evolution.
Mixing the two in one project is fine — use Zeno for the ephemeral path, use a
versioned format for the persistent path.

### Note On "Long-Running Operations"

A long-running product (10 years, multi-team) is not automatically an
evolution problem. The driver is **data lifetime**, not **operation
lifetime**. A 10-year-old game with only ephemeral session state and no
persisted save format never needs evolution. A 1-year-old SaaS with a database
row format does. Length of operation only forces evolution when data lifetime
forces it; otherwise schema changes ship deploy-by-deploy and the past
disappears with each release.

## Explicit Versioning Instead Of Evolution

Zeno's replacement for schema evolution is explicit versioning at the boundary:

- package schemas as normal TypeScript/npm versions,
- use a frame `layoutHash` or app-level schema version at file/network
  boundaries,
- reject mismatches early,
- rebuild transient buffers after deploy,
- write one-off migration scripts only for caches or assets that truly need to
  cross a release boundary,
- keep parallel readers such as `UserV1View` and `UserV2View` only when an
  explicit migration window requires both.

This is not less honest than vtables. It moves cost from every hot read to the
rare places where compatibility is actually needed. For WebGL instance buffers,
worker arenas, telemetry batches, and game-session tables, that is the cheaper
model.

Do not add optional fields, vtables, or default-value semantics just because the
schema changes. Add them only if version skew becomes a real product constraint.

## Optional Fields

Do not accept this as v1 layout syntax:

```ts
export interface User {
  id: z.u64;
  nickname?: z.utf8;
}
```

Reason: `?` says a property may be absent in TypeScript object space. It does
not define:

- field id
- presence bit
- default value
- vtable slot
- compatibility behavior when the field is added or removed

Promote optional fields only when:

- Layout IR has stable field ids,
- the wire format includes presence metadata or vtable entries,
- missing fields have documented default behavior,
- generated readers can distinguish absent from empty dynamic payloads,
- schema compatibility tests cover old-reader/new-writer and new-reader/old-writer cases.

## Discriminated Unions

Do not accept this as v1 layout syntax:

```ts
export interface Event {
  payload: z.i32 | z.utf8;
}
```

Reason: a union needs an explicit discriminator and variant table. Otherwise the
same bytes can be interpreted as multiple layouts.

Candidate shape:

```ts
export interface Event {
  tag: z.u8;
  payload: z.union<{
    1: z.i32;
    2: z.utf8;
  }>;
}
```

This is illustrative only. Do not implement it until the compiler can validate:

- tag scalar width,
- unique variant ids,
- variant payload descriptor shape,
- unknown variant behavior,
- compatibility when variants are added.

## Pattern Note

Optional fields and unions rhyme structurally: both require a level of metadata
above fixed offsets. That metadata is a schema-evolution layer, not a small
extension to the current packed fixed-layout ABI.
