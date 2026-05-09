import type { z } from "@zeno/types";

export interface Point {
  x: z.f32;
  y: z.f32;
}

export interface Metrics {
  kind: z.enumU8<"cpu" | "gpu">;
  mode: z.enumU16<1 | 2>;
  flags: z.flags32;
  createdAt: z.timestampMs;
  samples: z.fixedArray<z.f32, 3>;
  labels: z.fixedArray<z.fixedAscii<4>, 2>;
  points: z.fixedArray<Point, 2>;
}
