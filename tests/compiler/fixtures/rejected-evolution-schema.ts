import type { z } from "@zeno/types";

export interface EvolutionBad {
  nickname?: z.utf8;
  value: z.i32 | z.utf8;
}

