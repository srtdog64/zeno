import type { z } from "@exornea/zeno-types";

export interface Item {
  id: z.i32;
  label: z.utf8;
}

export interface Bag {
  items: z.dynamicVector<Item>;
}
