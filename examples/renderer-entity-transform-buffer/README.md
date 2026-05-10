# Renderer Entity Transform Buffer Example

This example models the transform rows repeated across FPS, racing, and
space-flight WebGL games: visible entities, projectiles, pickups, and effects.

It writes fixed Zeno records and packs caller-owned typed arrays:

- `Float32Array` transform rows: position, quaternion, scale
- `Uint32Array` identity rows: id, kind, flags
- `Uint32Array` visible queue: selected entity indices

No renderer library is imported.
