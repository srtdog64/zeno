import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  analyzeProjectionFile,
  analyzeProjectionSourceFile,
  emitProjectionFile,
  emitStructView,
} from "../../packages/compiler/src/index.js";
import { createProgramFromRootNames } from "./helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

describe("analyzeProjectionFile", () => {
  it("lowers supported branded types into layout IR", () => {
    const fixturePath = path.join(fixturesDir, "valid-schema.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionFile(program, sourceFile!);

    expect(result.diagnostics).toEqual([]);
    expect(result.layouts).toEqual([
      {
        kind: "struct",
        name: "Stats",
        alignment: 4,
        byteLength: 8,
        endianness: "little",
        fields: [
          {
            kind: "scalar",
            name: "hp",
            scalar: "i32",
            offset: 0,
            alignment: 4,
            byteLength: 4,
          },
          {
            kind: "scalar",
            name: "mana",
            scalar: "i32",
            offset: 4,
            alignment: 4,
            byteLength: 4,
          },
        ],
      },
      {
        kind: "struct",
        name: "Player",
        alignment: 8,
        byteLength: 72,
        endianness: "little",
        fields: [
          {
            kind: "scalar",
            name: "id",
            scalar: "u64",
            offset: 0,
            alignment: 8,
            byteLength: 8,
          },
          {
            kind: "struct",
            name: "stats",
            typeName: "Stats",
            offset: 8,
            alignment: 4,
            byteLength: 8,
          },
          {
            kind: "fixed-string",
            name: "handle",
            encoding: "utf8",
            offset: 16,
            alignment: 1,
            byteLength: 16,
          },
          {
            kind: "dynamic-string",
            name: "bio",
            encoding: "utf8",
            descriptor: "span32",
            offset: 32,
            alignment: 4,
            byteLength: 8,
          },
          {
            kind: "vector",
            name: "tags",
            descriptor: "vector32",
            offset: 40,
            alignment: 4,
            byteLength: 8,
            element: {
              kind: "dynamic-string",
              encoding: "utf8",
              descriptor: "span32",
              byteLength: 8,
            },
          },
          {
            kind: "vector",
            name: "chunks",
            descriptor: "vector32",
            offset: 48,
            alignment: 4,
            byteLength: 8,
            element: {
              kind: "fixed-bytes",
              byteLength: 4,
            },
          },
          {
            kind: "vector",
            name: "codes",
            descriptor: "vector32",
            offset: 56,
            alignment: 4,
            byteLength: 8,
            element: {
              kind: "fixed-string",
              encoding: "utf8",
              byteLength: 4,
            },
          },
          {
            kind: "dynamic-bytes",
            name: "payload",
            descriptor: "span32",
            offset: 64,
            alignment: 4,
            byteLength: 8,
          },
        ],
      },
    ]);

    const playerViewSource = emitStructView(result.layouts[1]!);
    expect(playerViewSource).toContain("export const PlayerViewByteLength = 72");
    expect(playerViewSource).toContain("export interface PlayerViewInput");
    expect(playerViewSource).toContain("export const PlayerViewIdOffset = 0");
    expect(playerViewSource).toContain("class PlayerView extends ProjectionView");
    expect(playerViewSource).toContain("static readonly idOffset = 0");
    expect(playerViewSource).toContain("static write(view: DataView, value: PlayerViewInput");
    expect(playerViewSource).toContain("static getId(view: DataView");
    expect(playerViewSource).toContain("static getIdAt(view: DataView");
    expect(playerViewSource).toContain("return this.view.getBigUint64(this.baseOffset + 0");
    expect(playerViewSource).toContain("chunksView(): FixedBytesVectorView");
    expect(playerViewSource).toContain("codesView(): FixedStringVectorView");
    expect(playerViewSource).toContain("static createWriter(view: DataView");
    expect(playerViewSource).toContain("static writeBio(writer: DynamicLayoutWriter");
    expect(playerViewSource).toContain("static writeTags(writer: DynamicLayoutWriter");
    expect(playerViewSource).toContain("static writeChunks(writer: DynamicLayoutWriter");
    expect(playerViewSource).toContain("static writeCodes(writer: DynamicLayoutWriter");
    expect(playerViewSource).toContain("static writePayload(writer: DynamicLayoutWriter");
    expect(playerViewSource).toContain('writeFixedText(view.buffer');
    expect(playerViewSource).not.toContain("emitter is not implemented");
    expect(emitProjectionFile(result.layouts)).toContain("class StatsView extends ProjectionView");
    expect(emitProjectionFile(result.layouts)).toContain("statsView(): StatsView");

    const optimizedPlayerViewSource = emitStructView(result.layouts[1]!, {
      optimizeCursorOffsets: true,
    });
    expect(optimizedPlayerViewSource).toContain("private $idOffset = 0");
    expect(optimizedPlayerViewSource).toContain("private $refreshOffsets(): void");
    expect(optimizedPlayerViewSource).toContain("override rebase(baseOffset: number): this");
    expect(optimizedPlayerViewSource).toContain("this.$idOffset = this.baseOffset + 0");
    expect(optimizedPlayerViewSource).toContain("return this.view.getBigUint64(this.$idOffset");
  });

  it("analyzes a source file without requiring a TypeScript program", () => {
    const fixturePath = path.join(fixturesDir, "valid-schema.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionSourceFile(sourceFile!, {
      endianness: "big",
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.layouts[0]?.endianness).toBe("big");
  });

  it("reports ambiguous bare runtime types early", () => {
    const fixturePath = path.join(fixturesDir, "invalid-schema.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionFile(program, sourceFile!);

    expect(result.layouts).toEqual([
      {
        kind: "struct",
        name: "Broken",
        alignment: 4,
        byteLength: 8,
        endianness: "little",
        fields: [
          {
            kind: "dynamic-string",
            name: "name",
            encoding: "utf8",
            descriptor: "span32",
            offset: 0,
            alignment: 4,
            byteLength: 8,
          },
        ],
      },
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "UNSUPPORTED_NUMBER",
      "UNSUPPORTED_ARRAY",
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.error?.kind)).toEqual([
      "AmbiguousLayout",
      "InsufficientResolution",
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.measurement?.layer)).toEqual([
      "typescript-type",
      "typescript-syntax",
    ]);
  });

  it("rejects runtime imports and value exports in schema files", () => {
    const fixturePath = path.join(fixturesDir, "schema-hygiene.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionFile(program, sourceFile!);

    expect(result.layouts.map((layout) => layout.name)).toEqual(["User"]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "UNSUPPORTED_SCHEMA_STATEMENT",
      "UNSUPPORTED_SCHEMA_STATEMENT",
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.error?.kind)).toEqual([
      "UnsupportedAtPhase",
      "UnsupportedAtPhase",
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.measurement?.layer)).toEqual([
      "typescript-syntax",
      "typescript-syntax",
    ]);
  });

  it("honors big-endian analysis in emitted accessor defaults", () => {
    const fixturePath = path.join(fixturesDir, "valid-schema.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionFile(program, sourceFile!, {
      endianness: "big",
    });
    const playerViewSource = emitStructView(result.layouts[1]!);
    const statsViewSource = emitStructView(result.layouts[0]!);

    expect(result.diagnostics).toEqual([]);
    expect(result.layouts[1]?.endianness).toBe("big");
    expect(playerViewSource).toContain(
      "constructor(view: DataView, baseOffset = 0, littleEndian = false)",
    );
    expect(playerViewSource).toContain(
      "static getId(view: DataView, baseOffset = 0, littleEndian = false)",
    );
    expect(statsViewSource).toContain(
      "static sumHp(view: DataView, count: number, baseOffset = 0, littleEndian = false)",
    );
    expect(playerViewSource).not.toContain("static sumId");
  });

  it("preserves ascii string encoding in emitted views and writers", () => {
    const fixturePath = path.join(fixturesDir, "ascii-schema.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionFile(program, sourceFile!);
    const source = emitProjectionFile(result.layouts);

    expect(result.diagnostics).toEqual([]);
    expect(result.layouts[0]?.fields).toEqual([
      expect.objectContaining({ kind: "fixed-string", encoding: "ascii" }),
      expect.objectContaining({ kind: "dynamic-string", encoding: "ascii" }),
      expect.objectContaining({
        kind: "vector",
        element: expect.objectContaining({ kind: "fixed-string", encoding: "ascii" }),
      }),
      expect.objectContaining({
        kind: "vector",
        element: expect.objectContaining({ kind: "dynamic-string", encoding: "ascii" }),
      }),
    ]);
    expect(source).toContain("decodeFixedText");
    expect(source).toContain("writeFixedText");
    expect(source).toContain('writeText(LabelsView.dynamicOffset, value, "ascii")');
    expect(source).toContain('writeFixedTextVector(LabelsView.fixedCodesOffset, values, 4, "ascii")');
    expect(source).toContain('writeTextVector(LabelsView.dynamicCodesOffset, values, "ascii")');
    expect(source).toContain('new Utf8SpanView(this.view, 8, this.baseOffset, this.littleEndian, "ascii")');
    expect(source).toContain('new FixedStringVectorView(this.view, 16, 4, this.baseOffset, this.littleEndian, "ascii")');
    expect(source).toContain('new Utf8VectorView(this.view, 24, this.baseOffset, this.littleEndian, "ascii")');
  });

  it("emits object writers for fixed-size struct vectors", () => {
    const source = emitProjectionFile([
      {
        kind: "struct",
        name: "Stats",
        alignment: 4,
        byteLength: 8,
        endianness: "little",
        fields: [
          {
            kind: "scalar",
            name: "hp",
            scalar: "i32",
            offset: 0,
            alignment: 4,
            byteLength: 4,
          },
          {
            kind: "scalar",
            name: "mana",
            scalar: "i32",
            offset: 4,
            alignment: 4,
            byteLength: 4,
          },
        ],
      },
      {
        kind: "struct",
        name: "Party",
        alignment: 4,
        byteLength: 8,
        endianness: "little",
        fields: [
          {
            kind: "vector",
            name: "members",
            descriptor: "vector32",
            offset: 0,
            alignment: 4,
            byteLength: 8,
            element: {
              kind: "struct",
              typeName: "Stats",
              byteLength: 8,
            },
          },
        ],
      },
    ]);

    expect(source).toContain("export interface PartyViewInput");
    expect(source).toContain("readonly members: readonly StatsViewInput[]");
    expect(source).toContain("static writeMembers(writer: DynamicLayoutWriter");
    expect(source).toContain("writer.writeStructVector(PartyView.membersOffset, values, 8");
    expect(source).toContain("StatsView.write(view, value, baseOffset, littleEndian)");
    expect(source).toContain("static write(view: DataView, value: PartyViewInput");
  });

  it("rejects vector of structs with dynamic tail fields", () => {
    const fixturePath = path.join(fixturesDir, "dynamic-struct-vector-schema.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionFile(program, sourceFile!);

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "LAYOUT_INVARIANT",
    );
    expect(result.diagnostics.some((diagnostic) => diagnostic.message.includes("dynamic tail fields"))).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.message.includes("vector<pointer<T>>"))).toBe(true);
  });

  it("reports recursive struct references", () => {
    const fixturePath = path.join(fixturesDir, "recursive-schema.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionFile(program, sourceFile!);

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "RECURSIVE_STRUCT",
    );
    expect(result.diagnostics.map((diagnostic) => diagnostic.error?.kind)).toContain(
      "UnsupportedAtPhase",
    );
  });

  it("allows recursive structs through explicit ref fields", () => {
    const fixturePath = path.join(fixturesDir, "recursive-pointer-schema.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionFile(program, sourceFile!);
    const source = emitProjectionFile(result.layouts);

    expect(result.diagnostics).toEqual([]);
    expect(result.layouts).toEqual([
      {
        kind: "struct",
        name: "Node",
        alignment: 4,
        byteLength: 16,
        endianness: "little",
        fields: [
          {
            kind: "scalar",
            name: "value",
            scalar: "i32",
            offset: 0,
            alignment: 4,
            byteLength: 4,
          },
          {
            kind: "pointer",
            name: "next",
            descriptor: "pointer32",
            targetTypeName: "Node",
            nullValue: 0xffffffff,
            offsetBase: "field",
            offsetEncoding: "i32",
            offset: 4,
            alignment: 4,
            byteLength: 4,
          },
          {
            kind: "vector",
            name: "children",
            descriptor: "vector32",
            offset: 8,
            alignment: 4,
            byteLength: 8,
            element: {
              kind: "pointer",
              descriptor: "pointer32",
              targetTypeName: "Node",
              byteLength: 4,
              nullValue: 0xffffffff,
              offsetBase: "element",
              offsetEncoding: "i32",
            },
          },
        ],
      },
    ]);
    expect(source).toContain("readonly next: number | null");
    expect(source).toContain("readonly children: readonly (number | null)[]");
    expect(source).toContain("static getRawNextRelativeOffset(view: DataView");
    expect(source).toContain("static getNextRelativeOffset(view: DataView");
    expect(source).toContain("static getUncheckedNextTargetOffset(view: DataView");
    expect(source).toContain("static getNextTargetOffset(view: DataView");
    expect(source).toContain("static setUncheckedNextTargetOffset(view: DataView");
    expect(source).toContain("get rawNextRelativeOffset(): number");
    expect(source).toContain("get uncheckedNextTargetOffset(): number | null");
    expect(source).toContain("static writeChildren(writer: DynamicLayoutWriter");
    expect(source).toContain("writer.writePointerVector(NodeView.childrenOffset, values, NodeView.byteLength)");
    expect(source).toContain("childrenView(): PointerVectorView<NodeView>");
    expect(source).toContain("nextView(): NodeView | null");
    expect(source).toContain("nextInto(out: NodeView): boolean");
    expect(source).toContain("target.moveToOffset(targetOffset, NodeView.byteLength)");
    expect(source).toContain("out.moveToOffset(targetOffset, NodeView.byteLength)");
  });
});
