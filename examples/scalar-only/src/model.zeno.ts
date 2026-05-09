import type { z } from "@exornea/zeno-types";

export interface Instance {
  entityId: z.u32;
  kind: z.u16;
  x: z.f32;
  y: z.f32;
  z: z.f32;
  health: z.i32;
  flags: z.flags32;
  active: z.bool;
}
