import type { z } from "@exornea/zeno-types";

export interface EntityTransform {
  id: z.u32;
  kind: z.enumU16<"player" | "enemy" | "projectile" | "pickup" | "effect">;
  flags: z.flags32;
  x: z.f32;
  y: z.f32;
  z: z.f32;
  qx: z.f32;
  qy: z.f32;
  qz: z.f32;
  qw: z.f32;
  scale: z.f32;
  visible: z.bool;
}
