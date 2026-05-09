import type { z } from "@zeno/types";

export interface User {
  id: z.u64;
  age: z.i32;
  score: z.f64;
  ratio: z.f32;
  handle: z.fixedUtf8<32>;
  name: z.utf8;
  tags: z.vector<z.utf8>;
  avatar: z.bytes;
}
