# Renderer Draw Batch Buffer Example

This example models renderer command metadata: mesh id, material id, index
range, instance range, and pass id.

It is intentionally not a rendering API. It packs fixed rows into caller-owned
typed arrays that a renderer could sort, batch, or upload later.
