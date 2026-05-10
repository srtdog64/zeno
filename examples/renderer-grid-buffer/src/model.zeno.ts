import type { z } from "@exornea/zeno-types";

export interface DungeonCell {
  tileId: z.u16;
  glyphId: z.u16;
  flags: z.flags32;
  light: z.u8;
  seen: z.bool;
}

export interface VisibleEntity {
  id: z.u32;
  kind: z.enumU16<"player" | "monster" | "item" | "projectile">;
  x: z.f32;
  y: z.f32;
  z: z.f32;
  glyphId: z.u16;
  flags: z.flags32;
}

export interface DirtyRange {
  start: z.u32;
  count: z.u32;
}
