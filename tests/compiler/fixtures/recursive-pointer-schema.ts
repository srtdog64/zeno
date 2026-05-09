import type { z } from "@zeno/types";

export interface Node {
  value: z.i32;
  next: z.pointer<Node>;
  children: z.vector<z.pointer<Node>>;
}
