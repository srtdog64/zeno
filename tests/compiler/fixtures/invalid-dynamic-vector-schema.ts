import type { z } from "@exornea/zeno-types";

export interface BadBag {
  items: z.dynamicVector<z.i32>;
}
