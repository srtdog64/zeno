import type { z } from "@exornea/zeno-types";

export interface Labels {
  fixed: z.fixedAscii<8>;
  dynamic: z.ascii;
  fixedCodes: z.vector<z.fixedAscii<4>>;
  dynamicCodes: z.vector<z.ascii>;
}
