import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import fc from "fast-check";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import * as runtime from "../../packages/runtime/src/index.js";
import {
  analyzeProjectionSourceFile,
  emitProjectionFile,
} from "../../packages/compiler/src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const runtimeEntry = path.join(rootDir, "packages", "runtime", "src", "index.ts");

type GeneratedModule = Record<string, unknown>;

const scalarKinds = [
  "i8",
  "u8",
  "i16",
  "u16",
  "i32",
  "u32",
  "f32",
  "f64",
  "i64",
  "u64",
  "bool",
] as const;

type ScalarKind = (typeof scalarKinds)[number];

describe("generated code compile and run checks", () => {
  it("type-checks and runs generated scalar-only views over fuzzed schema shapes", () => {
    let checkedRepresentative = false;

    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...scalarKinds), { minLength: 1, maxLength: 8 }),
        (fields) => {
          const source = schemaForScalarFields(fields);
          const emitted = compileSchema(source);
          if (!checkedRepresentative) {
            typeCheckGenerated(emitted);
            checkedRepresentative = true;
          }
          const generated = runGeneratedModule(emitted);
          const RowView = generated.RowView as GeneratedViewConstructor;
          const buffer = new ArrayBuffer(RowView.byteLength);
          const view = new DataView(buffer);

          fields.forEach((kind, index) => {
            RowView[`setF${index}`](view, sampleValue(kind, index));
          });
          fields.forEach((kind, index) => {
            const value = RowView[`getF${index}`](view);
            expectValue(value, sampleValue(kind, index), kind);
            expectGeneratedKernels(RowView, view, kind, index, sampleValue(kind, index));
          });

          const row = new RowView(view);
          fields.forEach((kind, index) => {
            expectValue(row[`f${index}`], sampleValue(kind, index), kind);
          });
        },
      ),
      { numRuns: 32 },
    );
  }, 10_000);

  it("runs generated nested dynamic views with big-endian scalar fields", () => {
    const emitted = compileSchema(
      `import type { z } from "@exornea/zeno-types";

export interface Header {
  code: z.u16;
}

export interface Packet {
  header: Header;
  name: string;
  scores: z.vector<z.i32>;
}
`,
      "big",
    );
    typeCheckGenerated(emitted);
    const generated = runGeneratedModule(emitted);
    const PacketView = generated.PacketView as GeneratedViewConstructor;
    const buffer = new ArrayBuffer(128);
    const view = new DataView(buffer);

    PacketView.write(
      view,
      {
        header: { code: 0x1234 },
        name: "zeno",
        scores: [10, 20, 30],
      },
      0,
      false,
    );

    const packet = new PacketView(view, 0, false) as GeneratedPacketView;
    expect(packet.headerView().code).toBe(0x1234);
    expect(packet.nameView().text()).toBe("zeno");
    expect(packet.scoresView().toArray()).toEqual([10, 20, 30]);
  });

  it("honors scan kernel emission modes", () => {
    const source = `import type { z } from "@exornea/zeno-types";

export interface Row {
  age: z.i32;
  active: z.bool;
}
`;

    const none = compileSchema(source, "little", "none");
    expect(none).not.toContain("sumAge");
    expect(none).not.toContain("countAgeWhereEq");

    const sum = compileSchema(source, "little", "sum");
    expect(sum).toContain("sumAge");
    expect(sum).not.toContain("minAge");
    expect(sum).not.toContain("countAgeWhereEq");

    const basic = compileSchema(source, "little", "basic");
    expect(basic).toContain("sumAge");
    expect(basic).toContain("minAge");
    expect(basic).not.toContain("countAgeWhereEq");

    const full = compileSchema(source, "little", "full");
    expect(full).toContain("sumAge");
    expect(full).toContain("minAge");
    expect(full).toContain("countAgeWhereEq");
    expect(full).toContain("countActiveWhereEq");
  });
});

interface GeneratedViewConstructor {
  readonly byteLength: number;
  new (view: DataView, baseOffset?: number, littleEndian?: boolean): Record<string, unknown>;
  [name: string]: any;
}

interface GeneratedPacketView {
  headerView(): { readonly code: number };
  nameView(): { text(): string };
  scoresView(): { toArray(): number[] };
}

function schemaForScalarFields(fields: readonly ScalarKind[]): string {
  const declarations = fields.map((kind, index) => `  f${index}: z.${kind};`).join("\n");

  return `import type { z } from "@exornea/zeno-types";

export interface Row {
${declarations}
}
`;
}

function compileSchema(
  sourceText: string,
  endianness: "little" | "big" = "little",
  scanKernels: "none" | "sum" | "basic" | "full" = "full",
): string {
  const sourceFile = ts.createSourceFile("generated.zeno.ts", sourceText, ts.ScriptTarget.ES2022);
  const result = analyzeProjectionSourceFile(sourceFile, { endianness });
  expect(result.diagnostics).toEqual([]);
  return emitProjectionFile(result.layouts, { scanKernels });
}

function typeCheckGenerated(sourceText: string): void {
  const directory = mkdtempSync(path.join(tmpdir(), "zeno-generated-e2e-"));
  const fileName = path.join(directory, "generated.view.ts");
  writeFileSync(fileName, sourceText);

  try {
    const program = ts.createProgram({
      rootNames: [fileName],
      options: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true,
        skipLibCheck: true,
        baseUrl: rootDir,
        paths: {
          "@exornea/zeno-runtime": [runtimeEntry],
        },
      },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(formatDiagnostics(diagnostics)).toEqual([]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runGeneratedModule(sourceText: string): GeneratedModule {
  const output = ts.transpileModule(sourceText, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} as GeneratedModule };

  vm.runInNewContext(output.outputText, {
    exports: module.exports,
    module,
    require: (id: string) => {
      if (id === "@exornea/zeno-runtime") {
        return runtime;
      }
      throw new Error(`Unexpected generated import: ${id}`);
    },
  });

  return module.exports;
}

function sampleValue(kind: ScalarKind, index: number): number | bigint | boolean {
  switch (kind) {
    case "i8":
      return -20 + index;
    case "u8":
      return 20 + index;
    case "i16":
      return -200 + index;
    case "u16":
      return 200 + index;
    case "i32":
      return -20_000 + index;
    case "u32":
      return 20_000 + index;
    case "f32":
      return 1.25 + index;
    case "f64":
      return 1.5 + index;
    case "i64":
      return BigInt(-20_000 - index);
    case "u64":
      return BigInt(20_000 + index);
    case "bool":
      return index % 2 === 0;
  }
}

function expectValue(actual: unknown, expected: number | bigint | boolean, kind: ScalarKind): void {
  if (kind === "f32" || kind === "f64") {
    expect(actual).toBeCloseTo(expected as number);
    return;
  }

  expect(actual).toBe(expected);
}

function expectGeneratedKernels(
  RowView: GeneratedViewConstructor,
  view: DataView,
  kind: ScalarKind,
  index: number,
  expected: number | bigint | boolean,
): void {
  const pascalName = `F${index}`;
  if (kind !== "i64" && kind !== "u64" && kind !== "f32" && kind !== "f64") {
    expect(RowView[`count${pascalName}WhereEq`](view, 1, expected)).toBe(1);
    expect(RowView[`findFirst${pascalName}WhereEq`](view, 1, expected)).toBe(0);
  }

  if (kind !== "i64" && kind !== "u64" && kind !== "bool") {
    expect(RowView[`min${pascalName}`](view, 1)).toBeCloseTo(expected as number);
    expect(RowView[`max${pascalName}`](view, 1)).toBeCloseTo(expected as number);
  }
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string[] {
  return diagnostics.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  );
}
