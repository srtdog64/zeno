import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  analyzeProjectionSourceFile,
  createLayoutManifest,
  diffLayoutManifests,
  formatLayoutDiff,
  formatLayoutInspection,
} from "../../packages/compiler/src/index.js";

describe("layout manifests", () => {
  it("creates a stable manifest for fixed-layout schemas", () => {
    const manifest = manifestFor(`import type { z } from "@exornea/zeno-types";

export interface Instance {
  id: z.u32;
  kind: z.u16;
  health: z.i32;
}
`);

    expect(manifest).toMatchInlineSnapshot(`
      {
        "structs": [
          {
            "alignment": 4,
            "byteLength": 12,
            "endianness": "little",
            "fields": [
              {
                "alignment": 4,
                "byteLength": 4,
                "kind": "scalar",
                "name": "id",
                "offset": 0,
                "scalar": "u32",
              },
              {
                "alignment": 2,
                "byteLength": 2,
                "kind": "scalar",
                "name": "kind",
                "offset": 4,
                "scalar": "u16",
              },
              {
                "alignment": 4,
                "byteLength": 4,
                "kind": "scalar",
                "name": "health",
                "offset": 8,
                "scalar": "i32",
              },
            ],
            "layoutHash": "0x373a09d6",
            "name": "Instance",
          },
        ],
        "version": 1,
      }
    `);

    expect(formatLayoutInspection(manifest)).toContain("Struct Instance");
    expect(formatLayoutInspection(manifest)).toContain("health\ti32\t8\t4\t4");
  });

  it("classifies layout diffs as breaking or version-routed additions", () => {
    const previous = manifestFor(`import type { z } from "@exornea/zeno-types";

export interface Instance {
  id: z.u32;
  health: z.i32;
}
`);
    const next = manifestFor(`import type { z } from "@exornea/zeno-types";

export interface Instance {
  id: z.u32;
  teamId: z.u16;
  health: z.i32;
}
`);

    const diff = diffLayoutManifests(previous, next);
    expect(diff.breaking).toContain("Instance.byteLength changed: 8 -> 12");
    expect(diff.breaking).toContain("Instance.health.offset changed: 4 -> 8");
    expect(diff.versionRouted).toContain("Added Instance.teamId at offset 4 byteLength 2");
    expect(formatLayoutDiff(diff)).toContain("BREAKING:");
  });
});

function manifestFor(sourceText: string) {
  const sourceFile = ts.createSourceFile(
    "schema.zeno.ts",
    sourceText,
    ts.ScriptTarget.ES2022,
    true,
  );
  const result = analyzeProjectionSourceFile(sourceFile);
  expect(result.diagnostics).toEqual([]);
  return createLayoutManifest(result.layouts);
}
