import type { z } from "@exornea/zeno-types";

export interface DrawBatch {
  meshId: z.u32;
  materialId: z.u32;
  pass: z.enumU16<"opaque" | "alpha" | "shadow" | "ui">;
  flags: z.flags32;
  firstIndex: z.u32;
  indexCount: z.u32;
  firstInstance: z.u32;
  instanceCount: z.u32;
}
