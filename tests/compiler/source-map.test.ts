import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  analyzeProjectionSourceFile,
  emitProjectionFileWithSourceMap,
} from "../../packages/compiler/src/index.js";

describe("generated projection source maps", () => {
  it("maps generated field accessors back to schema fields", () => {
    const sourceText = [
      'import type { z } from "@exornea/zeno-types";',
      "",
      "export interface User {",
      "  id: z.u32;",
      "  age: z.i32;",
      "}",
    ].join("\n");
    const sourceFile = ts.createSourceFile(
      "schema.zeno.ts",
      sourceText,
      ts.ScriptTarget.ES2022,
      true,
    );

    const result = analyzeProjectionSourceFile(sourceFile);
    expect(result.diagnostics).toEqual([]);

    const emitted = emitProjectionFileWithSourceMap(result.layouts, "schema.view.ts");
    const classLine = emitted.code.split("\n").findIndex((line) => line.includes("class UserView"));
    const ageLine = emitted.code.split("\n").findIndex((line) => line.includes("static getAge("));

    expect(classLine).toBeGreaterThan(0);
    expect(ageLine).toBeGreaterThan(0);
    expect(emitted.sourceMap.file).toBe("schema.view.ts");
    expect(emitted.sourceMap.sources).toContain("schema.zeno.ts");
    expect(emitted.sourceMap.mappings.split(";")[classLine]).not.toBe("");
    expect(emitted.sourceMap.mappings.split(";")[ageLine]).not.toBe("");
  });

  it("uses relative source paths instead of leaking absolute workspace paths", () => {
    const sourceText = [
      'import type { z } from "@exornea/zeno-types";',
      "",
      "export interface User {",
      "  age: z.i32;",
      "}",
    ].join("\n");
    const sourceFile = ts.createSourceFile(
      "F:/zeno/packages/demo/src/schema.zeno.ts",
      sourceText,
      ts.ScriptTarget.ES2022,
      true,
    );

    const result = analyzeProjectionSourceFile(sourceFile);
    expect(result.diagnostics).toEqual([]);

    const emitted = emitProjectionFileWithSourceMap(
      result.layouts,
      "F:/zeno/examples/demo/src/schema.view.ts",
    );

    expect(emitted.sourceMap.sources).toEqual(["../../../packages/demo/src/schema.zeno.ts"]);
  });
});
