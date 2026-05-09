import { ProjectionView } from "@zeno/runtime";
import type { z } from "@zeno/types";

export const runtimeValue = ProjectionView;

export interface User {
  id: z.u64;
  age: z.i32;
}
