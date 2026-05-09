import type { z } from "@exornea/zeno-types";

export interface Stats {
  hp: z.i32;
  mana: z.i32;
}

export interface Player {
  id: z.u64;
  stats: Stats;
  handle: z.fixedUtf8<16>;
  bio: z.utf8;
  tags: z.vector<z.utf8>;
  chunks: z.vector<z.fixedBytes<4>>;
  codes: z.vector<z.fixedUtf8<4>>;
  payload: z.bytes;
}
