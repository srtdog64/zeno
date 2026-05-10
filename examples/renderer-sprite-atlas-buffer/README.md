# Renderer Sprite Atlas Buffer Example

This example models tile and sprite renderers: atlas id, tile id, screen
position, UV rectangle, color, and flags.

It demonstrates two repeated buffer helpers:

- group visible sprites by atlas id
- pack sprite position, UV, and color channels into caller-owned typed arrays

No renderer library is imported.
