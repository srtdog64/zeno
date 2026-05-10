import type { z } from "@exornea/zeno-types";

export interface SpriteInstance {
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
