import type { z } from "@exornea/zeno-types";

export interface AssetRow {
  projectId: z.u16;
  kind: z.enumU16<
    | "other"
    | "texture"
    | "geometry"
    | "audio"
    | "shader"
    | "script"
    | "style"
    | "font"
    | "document"
    | "metadata"
  >;
  extension: z.enumU16<
    "other" | "png" | "jpg" | "jpeg" | "webp" | "ogg" | "mp3" | "glsl" | "js" | "json" | "css"
  >;
  pathHash: z.u32;
  byteLength: z.u32;
  depth: z.u16;
  flags: z.flags32;
}
