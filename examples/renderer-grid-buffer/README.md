# Renderer Grid Buffer Example

This example models a NetHack-style renderer surface without depending on
Three.js, WebGL, WebGPU, or a game engine.

It demonstrates three repeated buffer shapes from
[`docs/renderer-buffer-case-studies.md`](../../docs/renderer-buffer-case-studies.md):

- fixed dungeon/grid cells
- visible entities
- dirty ranges for partial renderer uploads

The output is caller-owned typed arrays that a renderer could upload later.
Zeno does not upload anything and does not import renderer libraries.

```sh
npm run build --workspace @exornea/zeno-example-renderer-grid-buffer
npm run start --workspace @exornea/zeno-example-renderer-grid-buffer
```

The example intentionally keeps the renderer layer absent. It exists to keep the
buffer shapes visible while `@exornea/zeno-buffers` stays limited to
dependency-free fixed-row packing helpers.
