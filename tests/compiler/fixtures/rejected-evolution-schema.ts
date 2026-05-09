import type { z } from "@exornea/zeno-types";

export interface EvolutionBad {
  nickname?: z.utf8;
  value: z.i32 | z.utf8;
}

