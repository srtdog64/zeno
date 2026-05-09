import { ProjectionView } from "@exornea/zeno-runtime";
import type { z } from "@exornea/zeno-types";

export const runtimeValue = ProjectionView;

export interface User {
  id: z.u64;
  age: z.i32;
}
