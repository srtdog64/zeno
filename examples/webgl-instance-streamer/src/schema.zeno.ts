import type { z } from "@exornea/zeno-types";

export interface Instance {
  id: z.u32;
  meshId: z.u16;
  materialId: z.u16;
  x: z.f32;
  y: z.f32;
  z: z.f32;
  scale: z.f32;
  color: z.flags32;
}
