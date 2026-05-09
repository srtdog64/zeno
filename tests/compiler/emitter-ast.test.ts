import { describe, expect, it } from "vitest";

import {
  emitAstCheckedSource,
  emitSyntheticSource,
} from "../../packages/compiler/src/emitter-ast.js";

describe("emitter AST boundary", () => {
  it("returns generated source after parsing it as TypeScript", () => {
    const source = "export const value = 1;\n";
    const emitted = emitAstCheckedSource(source, "generated.view.ts");

    expect(emitted.code).toBe(source);
    expect(emitted.sourceFile.statements).toHaveLength(1);
  });

  it("rejects invalid generated TypeScript", () => {
    expect(() => emitAstCheckedSource("export const = ;\n", "broken.view.ts")).toThrow(
      /Generated TypeScript failed to parse/,
    );
  });

  it("prints generated source from a synthetic TypeScript AST", () => {
    const emitted = emitSyntheticSource("export const value=1;\n", "generated.view.ts");

    expect(emitted.code).toBe("export const value = 1;\n\n");
    expect(emitted.sourceFile.statements).toHaveLength(1);
  });
});
