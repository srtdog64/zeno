# Renderer Buffer Case Studies

## Purpose

This document collects real public WebGL / Three.js game surfaces that justify
the narrow `@exornea/zeno-buffers` package boundary.

The goal is not to copy game assets or depend on a renderer. The goal is to
identify repeated buffer shapes that a dependency-free buffer compiler could
serve.

## Method

- use public repository metadata only
- pin each source to a commit
- store or discuss path, byte-size, extension, and kind metadata only
- do not store texture, model, audio, or game source payload bytes as fixtures
- treat examples as diagnostic witnesses, not universal benchmark proof

## Case Table

| Project    | Source                                                        | Commit                                     | Renderer Surface                         | Zeno-Relevant Shape                                 |
| ---------- | ------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------- | --------------------------------------------------- |
| HexGL      | [BKcore/HexGL](https://github.com/BKcore/HexGL)               | `6addc95a2fce3bf05f4d751823cc054c61a16d68` | racing game assets and instance metadata | asset catalog rows, texture/geometry/audio metadata |
| Nemesis    | [IceCreamYou/Nemesis](https://github.com/IceCreamYou/Nemesis) | `697fae45cf299aaf7070561bbec0b290c3b04a27` | small FPS entity/map state               | transform rows, enemy/projectile/pickup state       |
| xwing      | [amilajack/xwing](https://github.com/amilajack/xwing)         | `2b9fce366736da5ab35238fb7b2fc480f1f2f522` | Three.js/WebGL2 game assets              | asset catalog, projectile/enemy instance buffers    |
| NetHack 3D | [JamesIV4/nethack-3d](https://github.com/JamesIV4/nethack-3d) | `22571ba3ef120a8bc076d82bec4f07853644c82a` | WASM game state plus Three.js renderer   | grid cells, visible entities, item/monster buffers  |

## Observed Public Metadata Shape

This snapshot was taken from GitHub tree metadata only. Counts are diagnostic and
can change when the pinned commits are intentionally refreshed.

| Project    | Metadata Rows | Texture | Geometry | Audio | Shader | Script | Metadata | Approx Bytes |
| ---------- | ------------: | ------: | -------: | ----: | -----: | -----: | -------: | -----------: |
| HexGL      |           184 |      93 |        0 |     5 |      3 |     66 |        1 |    16.42 MiB |
| Nemesis    |            15 |       6 |        0 |     0 |      0 |      7 |        0 |     2.33 MiB |
| xwing      |            52 |      24 |        0 |     3 |      2 |     15 |        3 |    16.30 MiB |
| NetHack 3D |         2,764 |   2,642 |        0 |     0 |      0 |     80 |       25 |    61.97 MiB |

Fixture: [renderer-surface-metadata.json](../packages/bench/fixtures/renderer-surface-metadata.json)
can be regenerated with
[`scripts/update-renderer-surface-fixture.mjs`](../scripts/update-renderer-surface-fixture.mjs).

## Repeated Buffer Patterns

### Asset Catalog Rows

All sampled projects have renderer asset metadata: paths, extensions, sizes,
kind tags, and lookup keys.

Zeno shape:

```ts
interface AssetRow {
  pathHash: z.u32;
  byteLength: z.u32;
  kind: z.enumU16<"texture" | "geometry" | "audio" | "shader" | "script" | "metadata">;
  extension: z.enumU16<"png" | "jpg" | "ogg" | "glsl" | "js" | "json">;
  depth: z.u16;
}
```

Status: represented by
[`examples/renderer-asset-catalog-buffer`](../examples/renderer-asset-catalog-buffer),
which lowers the public renderer-surface metadata fixture into fixed
`AssetRow` records and packs kind-specific typed-array queues.

### Entity Transform Rows

FPS, racing, and space-flight games all need visible object transforms.

Zeno shape:

```ts
interface EntityTransform {
  id: z.u32;
  kind: z.enumU16<"player" | "enemy" | "projectile" | "pickup" | "decal">;
  flags: z.flags32;
  x: z.f32;
  y: z.f32;
  z: z.f32;
  qx: z.f32;
  qy: z.f32;
  qz: z.f32;
  qw: z.f32;
  scale: z.f32;
}
```

Status: represented by
[`examples/renderer-entity-transform-buffer`](../examples/renderer-entity-transform-buffer),
which packs visible transform and identity typed arrays from fixed entity rows.

### Renderer-Ready Struct-Of-Arrays

When upload is the primary path, records should sometimes be authored as
renderer-ready vectors instead of array-of-struct rows.

Zeno shape:

```ts
interface InstanceBuffers {
  positions: z.vector<z.f32>;
  colors: z.vector<z.f32>;
  scales: z.vector<z.f32>;
}
```

Status: represented by the `Zeno vectors` mode in
`examples/webgl-instance-streamer`.

### Grid / Tile Cells

NetHack 3D is the strongest current signal here: the game logic is a grid/state
machine, while the renderer consumes visible cells and entities.

Zeno shape:

```ts
interface DungeonCell {
  tileId: z.u16;
  glyphId: z.u16;
  flags: z.flags32;
  light: z.u8;
  seen: z.bool;
}
```

Status: represented by
[`examples/renderer-grid-buffer`](../examples/renderer-grid-buffer), because it
tests a different workload than asset catalogs or instance transforms.

### Sprite Atlas Batches

Tile, sprite, and UI renderers repeatedly need atlas id, tile id, screen
position, UV rectangles, color, and flags.

Zeno shape:

```ts
interface SpriteInstance {
  atlasId: z.u16;
  tileId: z.u16;
  flags: z.flags32;
  x: z.f32;
  y: z.f32;
  z: z.f32;
  u0: z.f32;
  v0: z.f32;
  u1: z.f32;
  v1: z.f32;
  color: z.u32;
  visible: z.bool;
}
```

Status: represented by
[`examples/renderer-sprite-atlas-buffer`](../examples/renderer-sprite-atlas-buffer),
which groups visible sprites by atlas and packs position, UV, and color typed
arrays.

### Draw Batch Commands

Renderer command lists often reduce many visible instances into mesh/material
or pass-specific draw batches.

Zeno shape:

```ts
interface DrawBatch {
  meshId: z.u32;
  materialId: z.u32;
  pass: z.enumU16<"opaque" | "alpha" | "shadow" | "ui">;
  flags: z.flags32;
  firstIndex: z.u32;
  indexCount: z.u32;
  firstInstance: z.u32;
  instanceCount: z.u32;
}
```

Status: represented by
[`examples/renderer-draw-batch-buffer`](../examples/renderer-draw-batch-buffer),
which packs command words and pass counts without renderer imports.

### Dirty Lists / Upload Lists

Renderer pipelines often update only a subset of visible entities or cells.

Zeno shape:

```ts
interface DirtyRange {
  start: z.u32;
  count: z.u32;
}
```

Status: represented by
[`examples/renderer-grid-buffer`](../examples/renderer-grid-buffer) as a
caller-owned `Uint32Array` pack target. This should not be folded into the core
runtime until at least three examples need the same API.

## Package Boundary

The fifth package now exists as `@exornea/zeno-buffers`.

Keep it limited to the conditions that justified it:

- at least three real examples repeat the same pack helper shape
- the helper stays renderer dependency-free
- browser benchmark witnesses exist for the helper
- the API outputs caller-owned typed arrays or views
- the API does not import Three.js, Babylon.js, WebGL wrappers, or WebGPU helper libraries

Do not promote renderer upload, asset loading, ECS, or scene graph behavior into
this package.

Do not treat `@exornea/zeno-buffers` as a second generated scan-kernel surface.
Generated `*View.sum*`, `count*WhereEq`, and `findFirst*WhereEq` methods own
schema-aware scalar table scans. The buffers package owns generic
pack/histogram helpers that write caller-owned typed arrays.

## Pattern Note

These projects rhyme structurally even though their renderers and game loops are
different: they all move from domain state to compact renderer-facing buffers.
That is a structural rhyme, not a dependency. HexGL being a useful asset-catalog
witness does not imply NetHack 3D should use the same schema; NetHack 3D points
more strongly at grid and dirty-list buffers.
