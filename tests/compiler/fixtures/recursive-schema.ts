import type { z } from "@exornea/zeno-types";

export interface Node {
  value: z.i32;
  next: Node;
}
