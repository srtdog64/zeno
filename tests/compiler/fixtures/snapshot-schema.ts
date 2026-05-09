import type { z } from "@exornea/zeno-types";

export interface Mini {
  id: z.u64;
  age: z.i32;
  handle: z.fixedUtf8<8>;
  chunks: z.vector<z.fixedBytes<4>>;
}
