import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  analyzeProjectionFile,
  emitProjectionFile,
  type LayoutDiagnostic,
} from "../../packages/compiler/src/index.js";
import { createProgramFromRootNames } from "./helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

function snapshotDiagnostics(diagnostics: readonly LayoutDiagnostic[]) {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    message: diagnostic.message,
    source:
      diagnostic.source.kind === "source"
        ? {
            kind: diagnostic.source.kind,
            fileName: path.basename(diagnostic.source.fileName),
            line: diagnostic.source.line,
            character: diagnostic.source.character,
          }
        : diagnostic.source,
    measurement: diagnostic.measurement,
    error: diagnostic.error,
  }));
}

function stripSourceLocations(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, nestedValue) => (key === "source" ? undefined : nestedValue)),
  );
}

describe("compiler snapshots", () => {
  it("matches the Layout IR snapshot for a representative schema", () => {
    const fixturePath = path.join(fixturesDir, "snapshot-schema.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionFile(program, sourceFile!);

    expect(result.diagnostics).toEqual([]);
    expect(Object.keys(result.layouts[0]!)).toContain("source");
    expect(Object.keys(result.layouts[0]!.fields[0]!)).toContain("source");
    expect(JSON.stringify(stripSourceLocations(result.layouts), null, 2)).toMatchInlineSnapshot(`
      "[
        {
          "kind": "struct",
          "name": "Mini",
          "fields": [
            {
              "kind": "scalar",
              "name": "id",
              "scalar": "u64",
              "offset": 0,
              "alignment": 8,
              "byteLength": 8
            },
            {
              "kind": "scalar",
              "name": "age",
              "scalar": "i32",
              "offset": 8,
              "alignment": 4,
              "byteLength": 4
            },
            {
              "kind": "fixed-string",
              "name": "handle",
              "offset": 12,
              "alignment": 1,
              "byteLength": 8,
              "encoding": "utf8"
            },
            {
              "kind": "vector",
              "name": "chunks",
              "offset": 20,
              "alignment": 4,
              "byteLength": 8,
              "descriptor": "vector32",
              "element": {
                "kind": "fixed-bytes",
                "byteLength": 4
              }
            }
          ],
          "alignment": 8,
          "byteLength": 32,
          "endianness": "little"
        }
      ]"
    `);
  });

  it("matches the emitted view golden snapshot for a representative schema", () => {
    const fixturePath = path.join(fixturesDir, "snapshot-schema.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionFile(program, sourceFile!);

    expect(result.diagnostics).toEqual([]);
    const emitted = emitProjectionFile(result.layouts);
    expect(emitted.indexOf("Invalid base offset: ${baseOffset}")).toBeLessThan(
      emitted.indexOf("const start = baseOffset + 8"),
    );
    expect(emitted).toMatchInlineSnapshot(`
      "import { DynamicLayoutWriter, FixedBytesVectorView, ProjectionView, decodeFixedText, fixedBytesView, writeFixedText } from "@exornea/zeno-runtime";

      export interface MiniViewInput {
        readonly id: bigint;
        readonly age: number;
        readonly handle: string;
        readonly chunks: readonly (ArrayLike<number> | Uint8Array)[];
      }

      export const MiniViewByteLength = 32;
      export const MiniViewAlignment = 8;
      export const MiniViewIdOffset = 0;
      export const MiniViewAgeOffset = 8;
      export const MiniViewHandleOffset = 12;
      export const MiniViewChunksOffset = 20;

      export class MiniView extends ProjectionView {
        static readonly byteLength = 32;
        static readonly alignment = 8;
        static readonly idOffset = 0;
        static readonly ageOffset = 8;
        static readonly handleOffset = 12;
        static readonly chunksOffset = 20;

        private static assertScanRange(
          view: DataView,
          count: number,
          baseOffset: number,
          fieldOffset: number,
          fieldByteLength: number,
        ): void {
          if (!Number.isInteger(count) || count < 0) {
            throw new RangeError(\`Invalid record count: \${count}\`);
          }
          if (!Number.isFinite(baseOffset) || !Number.isInteger(baseOffset) || baseOffset < 0) {
            throw new RangeError(\`Invalid base offset: \${baseOffset}\`);
          }
          if (count === 0) {
            return;
          }
          const lastByte = baseOffset + fieldOffset + (count - 1) * MiniView.byteLength + fieldByteLength;
          if (lastByte > view.byteLength) {
            throw new RangeError(\`scan range exceeds DataView length \${view.byteLength}\`);
          }
        }

        constructor(view: DataView, baseOffset = 0, littleEndian = true) {
          super(view, baseOffset, littleEndian);
        }

        static at(view: DataView, baseOffset = 0, littleEndian = true): MiniView {
          return new MiniView(view, baseOffset, littleEndian);
        }

        moveTo(index: number): this {
          return this.moveToIndex(index, MiniView.byteLength);
        }

        moveToUnchecked(index: number): this {
          return this.rebaseUnchecked(index * 32);
        }

        static createWriter(view: DataView, baseOffset = 0, tailOffset = MiniView.byteLength, littleEndian = true): DynamicLayoutWriter {
          return new DynamicLayoutWriter(view, tailOffset, baseOffset, littleEndian);
        }

        static writeChunks(writer: DynamicLayoutWriter, values: readonly (ArrayLike<number> | Uint8Array)[]) {
          return writer.writeFixedBytesVector(MiniView.chunksOffset, values, 4);
        }

        static write(view: DataView, value: MiniViewInput, baseOffset = 0, littleEndian = true): DynamicLayoutWriter {
          const writer = MiniView.createWriter(view, baseOffset, MiniView.byteLength, littleEndian);
          MiniView.writeInto(view, writer, value, baseOffset, littleEndian);
          return writer;
        }

        static writeInto(view: DataView, writer: DynamicLayoutWriter, value: MiniViewInput, baseOffset = 0, littleEndian = true): void {
          MiniView.setId(view, value.id, baseOffset, littleEndian);
          MiniView.setAge(view, value.age, baseOffset, littleEndian);
          writeFixedText(view.buffer, view.byteOffset + baseOffset + 12, 8, value.handle, "utf8");
          writer.writeFixedBytesVectorAtBase(baseOffset, MiniView.chunksOffset, value.chunks, 4);
        }

        static getId(view: DataView, baseOffset = 0, littleEndian = true): bigint {
          return view.getBigUint64(baseOffset + 0, littleEndian);
        }
        static setId(view: DataView, value: bigint, baseOffset = 0, littleEndian = true): void {
          view.setBigUint64(baseOffset + 0, value, littleEndian);
        }
        static getIdAt(view: DataView, index: number, littleEndian = true): bigint {
          return view.getBigUint64(index * 32 + 0, littleEndian);
        }
        static setIdAt(view: DataView, value: bigint, index: number, littleEndian = true): void {
          view.setBigUint64(index * 32 + 0, value, littleEndian);
        }

        get id(): bigint {
          return this.view.getBigUint64(this.baseOffset + 0, this.littleEndian);
        }
        set id(value: bigint) {
          this.view.setBigUint64(this.baseOffset + 0, value, this.littleEndian);
        }

        static getAge(view: DataView, baseOffset = 0, littleEndian = true): number {
          return view.getInt32(baseOffset + 8, littleEndian);
        }
        static setAge(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
          view.setInt32(baseOffset + 8, value, littleEndian);
        }
        static getAgeAt(view: DataView, index: number, littleEndian = true): number {
          return view.getInt32(index * 32 + 8, littleEndian);
        }
        static setAgeAt(view: DataView, value: number, index: number, littleEndian = true): void {
          view.setInt32(index * 32 + 8, value, littleEndian);
        }
        static sumAge(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
          MiniView.assertScanRange(view, count, baseOffset, 8, 4);
          if (count === 0) {
            return 0;
          }
          const start = baseOffset + 8;
          const limit = start + count * 32;
          let sum = 0;
          for (let offset = start; offset < limit; offset += 32) {
            sum += view.getInt32(offset, littleEndian);
          }
          return sum;
        }
        static minAge(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
          MiniView.assertScanRange(view, count, baseOffset, 8, 4);
          if (count === 0) {
            return Number.POSITIVE_INFINITY;
          }
          const start = baseOffset + 8;
          const limit = start + count * 32;
          let minimum = Number.POSITIVE_INFINITY;
          for (let offset = start; offset < limit; offset += 32) {
            const value = view.getInt32(offset, littleEndian);
            if (value < minimum) {
              minimum = value;
            }
          }
          return minimum;
        }
        static maxAge(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
          MiniView.assertScanRange(view, count, baseOffset, 8, 4);
          if (count === 0) {
            return Number.NEGATIVE_INFINITY;
          }
          const start = baseOffset + 8;
          const limit = start + count * 32;
          let maximum = Number.NEGATIVE_INFINITY;
          for (let offset = start; offset < limit; offset += 32) {
            const value = view.getInt32(offset, littleEndian);
            if (value > maximum) {
              maximum = value;
            }
          }
          return maximum;
        }
        static countAgeWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
          MiniView.assertScanRange(view, count, baseOffset, 8, 4);
          let matched = 0;
          const start = baseOffset + 8;
          const limit = start + count * 32;
          for (let offset = start; offset < limit; offset += 32) {
            if (view.getInt32(offset, littleEndian) === expected) {
              matched += 1;
            }
          }
          return matched;
        }
        static findFirstAgeWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
          MiniView.assertScanRange(view, count, baseOffset, 8, 4);
          const start = baseOffset + 8;
          const limit = start + count * 32;
          let index = 0;
          for (let offset = start; offset < limit; offset += 32) {
            if (view.getInt32(offset, littleEndian) === expected) {
              return index;
            }
            index += 1;
          }
          return -1;
        }

        get age(): number {
          return this.view.getInt32(this.baseOffset + 8, this.littleEndian);
        }
        set age(value: number) {
          this.view.setInt32(this.baseOffset + 8, value, this.littleEndian);
        }

        handleText(): string {
          return decodeFixedText(this.backingBuffer(), this.backingOffset(12), 8, "utf8");
        }
        handleBytes(): Uint8Array {
          return fixedBytesView(this.backingBuffer(), this.backingOffset(12), 8);
        }

        chunksView(): FixedBytesVectorView {
          return new FixedBytesVectorView(this.view, 20, 4, this.baseOffset, this.littleEndian);
        }

      }
      "
    `);
  });

  it("matches the emitted pointer view golden snapshot", () => {
    const fixturePath = path.join(fixturesDir, "recursive-pointer-schema.ts");
    const program = createProgramFromRootNames([fixturePath]);
    const sourceFile = program.getSourceFile(fixturePath);

    expect(sourceFile).toBeDefined();

    const result = analyzeProjectionFile(program, sourceFile!);

    expect(result.diagnostics).toEqual([]);
    expect(emitProjectionFile(result.layouts)).toMatchInlineSnapshot(`
      "import { DynamicLayoutWriter, PointerVectorView, ProjectionView } from "@exornea/zeno-runtime";

      export interface NodeViewInput {
        readonly value: number;
        readonly next: number | null;
        readonly children: readonly (number | null)[];
      }

      export const NodeViewByteLength = 16;
      export const NodeViewAlignment = 4;
      export const NodeViewValueOffset = 0;
      export const NodeViewNextOffset = 4;
      export const NodeViewChildrenOffset = 8;

      export class NodeView extends ProjectionView {
        static readonly byteLength = 16;
        static readonly alignment = 4;
        static readonly valueOffset = 0;
        static readonly nextOffset = 4;
        static readonly childrenOffset = 8;

        private static assertPointer32Payload(value: number): void {
          if (!Number.isInteger(value) || value < -0x80000000 || value > 0x7fffffff || value === -1) {
            throw new RangeError(\`pointer32 target offset must encode to signed i32 except -1: \${value}\`);
          }
        }

        private static assertPointerTargetRange(view: DataView, targetOffset: number, byteLength: number): void {
          if (!Number.isSafeInteger(targetOffset) || targetOffset < 0) {
            throw new RangeError(\`pointer32 target offset must be a non-negative safe integer: \${targetOffset}\`);
          }
          if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
            throw new RangeError(\`pointer32 target byteLength must be a non-negative safe integer: \${byteLength}\`);
          }
          if (byteLength > view.byteLength - targetOffset) {
            throw new RangeError(\`pointer32 target \${targetOffset}..\${targetOffset + byteLength} exceeds DataView length \${view.byteLength}\`);
          }
        }

        private static assertScanRange(
          view: DataView,
          count: number,
          baseOffset: number,
          fieldOffset: number,
          fieldByteLength: number,
        ): void {
          if (!Number.isInteger(count) || count < 0) {
            throw new RangeError(\`Invalid record count: \${count}\`);
          }
          if (!Number.isFinite(baseOffset) || !Number.isInteger(baseOffset) || baseOffset < 0) {
            throw new RangeError(\`Invalid base offset: \${baseOffset}\`);
          }
          if (count === 0) {
            return;
          }
          const lastByte = baseOffset + fieldOffset + (count - 1) * NodeView.byteLength + fieldByteLength;
          if (lastByte > view.byteLength) {
            throw new RangeError(\`scan range exceeds DataView length \${view.byteLength}\`);
          }
        }

        constructor(view: DataView, baseOffset = 0, littleEndian = true) {
          super(view, baseOffset, littleEndian);
        }

        static at(view: DataView, baseOffset = 0, littleEndian = true): NodeView {
          return new NodeView(view, baseOffset, littleEndian);
        }

        moveTo(index: number): this {
          return this.moveToIndex(index, NodeView.byteLength);
        }

        moveToUnchecked(index: number): this {
          return this.rebaseUnchecked(index * 16);
        }

        static createWriter(view: DataView, baseOffset = 0, tailOffset = NodeView.byteLength, littleEndian = true): DynamicLayoutWriter {
          return new DynamicLayoutWriter(view, tailOffset, baseOffset, littleEndian);
        }

        static writeChildren(writer: DynamicLayoutWriter, values: readonly (number | null)[]) {
          return writer.writePointerVector(NodeView.childrenOffset, values, NodeView.byteLength);
        }

        static write(view: DataView, value: NodeViewInput, baseOffset = 0, littleEndian = true): DynamicLayoutWriter {
          const writer = NodeView.createWriter(view, baseOffset, NodeView.byteLength, littleEndian);
          NodeView.writeInto(view, writer, value, baseOffset, littleEndian);
          return writer;
        }

        static writeInto(view: DataView, writer: DynamicLayoutWriter, value: NodeViewInput, baseOffset = 0, littleEndian = true): void {
          NodeView.setValue(view, value.value, baseOffset, littleEndian);
          NodeView.setNextTargetOffset(view, value.next, baseOffset, littleEndian);
          writer.writePointerVectorAtBase(baseOffset, NodeView.childrenOffset, value.children, NodeView.byteLength);
        }

        static getValue(view: DataView, baseOffset = 0, littleEndian = true): number {
          return view.getInt32(baseOffset + 0, littleEndian);
        }
        static setValue(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
          view.setInt32(baseOffset + 0, value, littleEndian);
        }
        static getValueAt(view: DataView, index: number, littleEndian = true): number {
          return view.getInt32(index * 16 + 0, littleEndian);
        }
        static setValueAt(view: DataView, value: number, index: number, littleEndian = true): void {
          view.setInt32(index * 16 + 0, value, littleEndian);
        }
        static sumValue(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
          NodeView.assertScanRange(view, count, baseOffset, 0, 4);
          if (count === 0) {
            return 0;
          }
          const start = baseOffset + 0;
          const limit = start + count * 16;
          let sum = 0;
          for (let offset = start; offset < limit; offset += 16) {
            sum += view.getInt32(offset, littleEndian);
          }
          return sum;
        }
        static minValue(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
          NodeView.assertScanRange(view, count, baseOffset, 0, 4);
          if (count === 0) {
            return Number.POSITIVE_INFINITY;
          }
          const start = baseOffset + 0;
          const limit = start + count * 16;
          let minimum = Number.POSITIVE_INFINITY;
          for (let offset = start; offset < limit; offset += 16) {
            const value = view.getInt32(offset, littleEndian);
            if (value < minimum) {
              minimum = value;
            }
          }
          return minimum;
        }
        static maxValue(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
          NodeView.assertScanRange(view, count, baseOffset, 0, 4);
          if (count === 0) {
            return Number.NEGATIVE_INFINITY;
          }
          const start = baseOffset + 0;
          const limit = start + count * 16;
          let maximum = Number.NEGATIVE_INFINITY;
          for (let offset = start; offset < limit; offset += 16) {
            const value = view.getInt32(offset, littleEndian);
            if (value > maximum) {
              maximum = value;
            }
          }
          return maximum;
        }
        static countValueWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
          NodeView.assertScanRange(view, count, baseOffset, 0, 4);
          let matched = 0;
          const start = baseOffset + 0;
          const limit = start + count * 16;
          for (let offset = start; offset < limit; offset += 16) {
            if (view.getInt32(offset, littleEndian) === expected) {
              matched += 1;
            }
          }
          return matched;
        }
        static findFirstValueWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
          NodeView.assertScanRange(view, count, baseOffset, 0, 4);
          const start = baseOffset + 0;
          const limit = start + count * 16;
          let index = 0;
          for (let offset = start; offset < limit; offset += 16) {
            if (view.getInt32(offset, littleEndian) === expected) {
              return index;
            }
            index += 1;
          }
          return -1;
        }

        get value(): number {
          return this.view.getInt32(this.baseOffset + 0, this.littleEndian);
        }
        set value(value: number) {
          this.view.setInt32(this.baseOffset + 0, value, this.littleEndian);
        }

        static getRawNextRelativeOffset(view: DataView, baseOffset = 0, littleEndian = true): number {
          return view.getUint32(baseOffset + 4, littleEndian);
        }
        static getNextRelativeOffset(view: DataView, baseOffset = 0, littleEndian = true): number | null {
          const rawValue = NodeView.getRawNextRelativeOffset(view, baseOffset, littleEndian);
          if (rawValue === 0xffffffff) {
            return null;
          }
          return view.getInt32(baseOffset + 4, littleEndian);
        }
        static setNextRelativeOffset(view: DataView, value: number | null, baseOffset = 0, littleEndian = true): void {
          if (value === null) {
            view.setUint32(baseOffset + 4, 0xffffffff, littleEndian);
            return;
          }
          NodeView.assertPointer32Payload(value);
          view.setInt32(baseOffset + 4, value, littleEndian);
        }
        static getUncheckedNextTargetOffset(view: DataView, baseOffset = 0, littleEndian = true): number | null {
          const relativeOffset = NodeView.getNextRelativeOffset(view, baseOffset, littleEndian);
          if (relativeOffset === null) {
            return null;
          }
          return baseOffset + 4 + relativeOffset;
        }
        static getNextTargetOffset(view: DataView, baseOffset = 0, littleEndian = true): number | null {
          const targetOffset = NodeView.getUncheckedNextTargetOffset(view, baseOffset, littleEndian);
          if (targetOffset === null) {
            return null;
          }
          NodeView.assertPointerTargetRange(view, targetOffset, NodeView.byteLength);
          return targetOffset;
        }
        static setUncheckedNextTargetOffset(view: DataView, targetOffset: number | null, baseOffset = 0, littleEndian = true): void {
          if (targetOffset === null) {
            NodeView.setNextRelativeOffset(view, null, baseOffset, littleEndian);
            return;
          }
          const relativeOffset = targetOffset - (baseOffset + 4);
          NodeView.setNextRelativeOffset(view, relativeOffset, baseOffset, littleEndian);
        }
        static setNextTargetOffset(view: DataView, targetOffset: number | null, baseOffset = 0, littleEndian = true): void {
          if (targetOffset !== null) {
            NodeView.assertPointerTargetRange(view, targetOffset, NodeView.byteLength);
          }
          NodeView.setUncheckedNextTargetOffset(view, targetOffset, baseOffset, littleEndian);
        }
        static getNextRelativeOffsetAt(view: DataView, index: number, littleEndian = true): number | null {
          const rawValue = NodeView.getRawNextRelativeOffset(view, index * 16, littleEndian);
          if (rawValue === 0xffffffff) {
            return null;
          }
          return view.getInt32(index * 16 + 4, littleEndian);
        }
        static setNextRelativeOffsetAt(view: DataView, value: number | null, index: number, littleEndian = true): void {
          if (value === null) {
            view.setUint32(index * 16 + 4, 0xffffffff, littleEndian);
            return;
          }
          NodeView.assertPointer32Payload(value);
          view.setInt32(index * 16 + 4, value, littleEndian);
        }

        get rawNextRelativeOffset(): number {
          return this.view.getUint32(this.baseOffset + 4, this.littleEndian);
        }
        get nextRelativeOffset(): number | null {
          const rawValue = this.rawNextRelativeOffset;
          if (rawValue === 0xffffffff) {
            return null;
          }
          return this.view.getInt32(this.baseOffset + 4, this.littleEndian);
        }
        set nextRelativeOffset(value: number | null) {
          if (value === null) {
            this.view.setUint32(this.baseOffset + 4, 0xffffffff, this.littleEndian);
            return;
          }
          if (!Number.isInteger(value) || value < -0x80000000 || value > 0x7fffffff || value === -1) {
            throw new RangeError(\`pointer32 target offset must encode to signed i32 except -1: \${value}\`);
          }
          this.view.setInt32(this.baseOffset + 4, value, this.littleEndian);
        }
        get uncheckedNextTargetOffset(): number | null {
          const relativeOffset = this.nextRelativeOffset;
          if (relativeOffset === null) {
            return null;
          }
          return this.baseOffset + 4 + relativeOffset;
        }
        get nextTargetOffset(): number | null {
          const targetOffset = this.uncheckedNextTargetOffset;
          if (targetOffset === null) {
            return null;
          }
          NodeView.assertPointerTargetRange(this.view, targetOffset, NodeView.byteLength);
          return targetOffset;
        }
        set uncheckedNextTargetOffset(targetOffset: number | null) {
          if (targetOffset === null) {
            this.nextRelativeOffset = null;
            return;
          }
          const relativeOffset = targetOffset - (this.baseOffset + 4);
          this.nextRelativeOffset = relativeOffset;
        }
        set nextTargetOffset(targetOffset: number | null) {
          if (targetOffset !== null) {
            NodeView.assertPointerTargetRange(this.view, targetOffset, NodeView.byteLength);
          }
          this.uncheckedNextTargetOffset = targetOffset;
        }
        nextView(): NodeView | null {
          const targetOffset = this.nextTargetOffset;
          if (targetOffset === null) {
            return null;
          }
          const target = new NodeView(this.view, 0, this.littleEndian);
          target.moveToOffset(targetOffset, NodeView.byteLength);
          return target;
        }
        nextInto(out: NodeView): boolean {
          const targetOffset = this.nextTargetOffset;
          if (targetOffset === null) {
            return false;
          }
          out.moveToOffset(targetOffset, NodeView.byteLength);
          return true;
        }

        childrenView(): PointerVectorView<NodeView> {
          return new PointerVectorView(this.view, 8, NodeView.byteLength, (view, baseOffset, littleEndian) => new NodeView(view, baseOffset, littleEndian), this.baseOffset, this.littleEndian);
        }

      }
      "
    `);
  });

  it("matches diagnostics snapshots for rejected source schemas", () => {
    const invalidFixturePath = path.join(fixturesDir, "invalid-schema.ts");
    const invalidProgram = createProgramFromRootNames([invalidFixturePath]);
    const invalidSourceFile = invalidProgram.getSourceFile(invalidFixturePath);

    expect(invalidSourceFile).toBeDefined();

    const invalidResult = analyzeProjectionFile(invalidProgram, invalidSourceFile!);

    expect(snapshotDiagnostics(invalidResult.diagnostics)).toMatchInlineSnapshot(`
      [
        {
          "code": "UNSUPPORTED_NUMBER",
          "error": {
            "candidates": [
              "i8",
              "u8",
              "i16",
              "u16",
              "i32",
              "u32",
              "f32",
              "f64",
            ],
            "construct": "number",
            "kind": "AmbiguousLayout",
          },
          "measurement": {
            "construct": "number",
            "layer": "typescript-type",
            "phase": "phase-0",
          },
          "message": "Field "id" uses bare "number". Use a branded scalar alias such as i32 or f64.",
          "source": {
            "character": 7,
            "fileName": "invalid-schema.ts",
            "kind": "source",
            "line": 2,
          },
        },
        {
          "code": "UNSUPPORTED_ARRAY",
          "error": {
            "construct": "bare array syntax",
            "given": "layout-ir-fixed",
            "kind": "InsufficientResolution",
            "phase": "phase-0",
            "required": "layout-ir-dynamic",
          },
          "measurement": {
            "construct": "bare array syntax",
            "layer": "typescript-syntax",
            "phase": "phase-0",
          },
          "message": "Field "tags" uses bare array syntax. Use vector<T> instead.",
          "source": {
            "character": 9,
            "fileName": "invalid-schema.ts",
            "kind": "source",
            "line": 4,
          },
        },
      ]
    `);

    const recursiveFixturePath = path.join(fixturesDir, "recursive-schema.ts");
    const recursiveProgram = createProgramFromRootNames([recursiveFixturePath]);
    const recursiveSourceFile = recursiveProgram.getSourceFile(recursiveFixturePath);

    expect(recursiveSourceFile).toBeDefined();

    const recursiveResult = analyzeProjectionFile(recursiveProgram, recursiveSourceFile!);

    expect(snapshotDiagnostics(recursiveResult.diagnostics)).toMatchInlineSnapshot(`
      [
        {
          "code": "RECURSIVE_STRUCT",
          "error": {
            "construct": "recursive struct "Node"",
            "kind": "UnsupportedAtPhase",
            "phase": "phase-0",
          },
          "measurement": undefined,
          "message": "Recursive struct "Node" is not supported yet.",
          "source": {
            "character": 18,
            "fileName": "recursive-schema.ts",
            "kind": "source",
            "line": 3,
          },
        },
      ]
    `);
  });
});
