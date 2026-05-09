import type { z } from "@zeno/types";

export interface Node {
  value: z.i32;
  next: Node;
}
