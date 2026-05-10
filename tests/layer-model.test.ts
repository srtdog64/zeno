import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  analyzeProjectionSourceFile,
  createLayoutManifest,
  emitProjectionFile,
  formatLayoutInspection,
  parseScanKernelMode,
} from "../packages/compiler/src/index.js";
import * as runtime from "../packages/runtime/src/index.js";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const layerDocs = [
  "00-wire-abi.md",
  "01-raw-offsets.md",
  "02-static-accessors.md",
  "03-scan-kernels.md",
  "04-cursor-views.md",
  "05-dynamic-tail.md",
  "06-shared-memory.md",
  "07-layout-ops.md",
] as const;

describe("layered projection model", () => {
  it("keeps every documented layer present and linked from README", () => {
    const readme = readFileSync(path.join(rootDir, "README.md"), "utf8");

    for (const fileName of layerDocs) {
      const relativePath = `docs/layers/${fileName}`;
      expect(existsSync(path.join(rootDir, relativePath))).toBe(true);
      expect(readme).toContain(relativePath);
    }
  });

  it("keeps documented layer APIs aligned with runtime and compiler surfaces", () => {
    expect(runtime).toHaveProperty("ProjectionView");
    expect(runtime).toHaveProperty("DynamicLayoutWriter");
    expect(runtime).toHaveProperty("SharedDynamicLayoutWriter");
    expect(runtime).toHaveProperty("SPAN32_BYTE_LENGTH");
    expect(runtime).toHaveProperty("VECTOR32_BYTE_LENGTH");
    expect(runtime).toHaveProperty("POINTER32_NULL");

    expect(parseScanKernelMode("none")).toBe("none");
    expect(parseScanKernelMode("sum")).toBe("sum");
    expect(parseScanKernelMode("basic")).toBe("basic");
    expect(parseScanKernelMode("full")).toBe("full");
    expect(parseScanKernelMode("invalid")).toBeNull();
  });

  it("emits one representative API from each projection layer", () => {
    const result = analyzeProjectionSourceFile(sourceFileForLayeredSchema());
    expect(result.diagnostics).toEqual([]);

    const manifest = createLayoutManifest(result.layouts);
    const inspection = formatLayoutInspection(manifest);
    const emitted = emitProjectionFile(result.layouts, { scanKernels: "full" });

    expect(inspection).toContain("Struct User");
    expect(emitted).toContain("export const UserViewByteLength");
    expect(emitted).toContain("static getAge(");
    expect(emitted).toContain("static sumAge(");
    expect(emitted).toContain("static countAgeWhereEq(");
    expect(emitted).toContain("static at(view: DataView");
    expect(emitted).toContain("nameView(): Utf8SpanView");
    expect(emitted).toContain("static createWriter(");
  });
});

function sourceFileForLayeredSchema(): ts.SourceFile {
  return ts.createSourceFile(
    "layered.zeno.ts",
    `import type { z } from "@exornea/zeno-types";

export interface User {
  id: z.u32;
  age: z.i32;
  name: z.utf8;
}
`,
    ts.ScriptTarget.ES2022,
    true,
  );
}
