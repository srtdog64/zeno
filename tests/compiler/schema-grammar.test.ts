import ts from "typescript";
import { describe, expect, it } from "vitest";

import { analyzeProjectionSourceFile } from "../../packages/compiler/src/index.js";

function analyzeSchema(sourceText: string) {
  const sourceFile = ts.createSourceFile(
    "grammar-fixture.zeno.ts",
    sourceText,
    ts.ScriptTarget.ES2022,
    true,
  );
  return analyzeProjectionSourceFile(sourceFile);
}

describe("schema grammar examples", () => {
  it("accepts the documented supported grammar surface", () => {
    const result = analyzeSchema(`
      import type { z } from "@exornea/zeno-types";

      export interface Point {
        x: z.f32;
        y: z.f32;
      }

      export interface Item {
        id: z.i32;
        label: z.utf8;
      }

      export interface Node {
        value: z.i32;
        next: z.pointer<Node>;
        children: z.vector<z.pointer<Node>>;
      }

      export interface GrammarSurface {
        id: z.u64;
        scalarAlias: z.enumU8<"cpu" | "gpu">;
        flags: z.flags32;
        createdAt: z.timestampMs;
        fixedBytes: z.fixedBytes<16>;
        fixedUtf8: z.fixedUtf8<16>;
        fixedAscii: z.fixedAscii<8>;
        samples: z.fixedArray<z.f32, 3>;
        labels: z.fixedArray<z.fixedAscii<4>, 2>;
        points: z.fixedArray<Point, 2>;
        slug: z.utf8;
        ascii: z.ascii;
        thumbnail: z.bytes;
        summary: string;
        values: z.vector<z.i32>;
        tags: z.vector<z.utf8>;
        rawTags: z.vector<z.bytes>;
        fixedTags: z.vector<z.fixedAscii<4>>;
        pointVector: z.vector<Point>;
        itemVector: z.dynamicVector<Item>;
        node: z.pointer<Node>;
      }
    `);

    expect(result.diagnostics).toEqual([]);
    expect(result.layouts.map((layout) => layout.name)).toEqual([
      "Point",
      "Item",
      "Node",
      "GrammarSurface",
    ]);
  });

  it("rejects the documented unsupported grammar examples", () => {
    const result = analyzeSchema(`
      import { ProjectionView } from "@exornea/zeno-runtime";
      import type { z } from "@exornea/zeno-types";

      export const runtimeValue = ProjectionView;

      export interface BadNode {
        next: BadNode;
      }

      export interface Bad {
        value: number;
        values: number[];
        nickname?: z.utf8;
        unionValue: z.i32 | z.utf8;
      }
    `);

    const messages = result.diagnostics.map((diagnostic) => diagnostic.message);
    const unsupportedSchemaStatements = result.diagnostics.filter(
      (diagnostic) => diagnostic.code === "UNSUPPORTED_SCHEMA_STATEMENT",
    );

    expect(unsupportedSchemaStatements).toHaveLength(2);
    expect(unsupportedSchemaStatements.map((diagnostic) => diagnostic.message)).toEqual([
      ".zeno.ts schema files must not import runtime values.",
      ".zeno.ts schema files must not export runtime values.",
    ]);
    expect(messages).toContain('Recursive struct "BadNode" is not supported yet.');
    expect(messages.some((message) => message.includes('Field "value" uses bare "number"'))).toBe(
      true,
    );
    expect(messages.some((message) => message.includes('Field "values"'))).toBe(true);
    expect(messages).toContain(
      'Field "nickname" uses optional property syntax. Optional fields need a schema-evolution policy.',
    );
    expect(messages).toContain('Field "unionValue" has an unsupported type expression.');
  });
});
