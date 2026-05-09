import type { z } from "@zeno/types";

export interface Item {
  id: z.i32;
  label: string;
}

export interface Bag {
  items: z.vector<Item>;
}
