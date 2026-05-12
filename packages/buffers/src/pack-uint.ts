import {
  assertNonNegativeSafeInteger,
  assertOutputCapacityForAll,
  assertOutputWriteCapacity,
  assertPositiveSafeInteger,
  assertRowRange,
  assertUint16,
  assertUint8,
} from "./range.js";
import type { UintFieldKind, UintFieldSpec, UintPackPlan } from "./types.js";

export function createUintPackPlan(
  byteLength: number,
  fieldSpecs: readonly UintFieldSpec[],
): UintPackPlan {
  assertPositiveSafeInteger(byteLength, "byteLength");
  assertPositiveSafeInteger(fieldSpecs.length, "fieldCount");

  let maxFieldEnd = 0;
  for (const fieldSpec of fieldSpecs) {
    assertNonNegativeSafeInteger(fieldSpec.offset, "fieldOffset");
    const fieldEnd = fieldSpec.offset + uintFieldByteLength(fieldSpec.kind);
    assertNonNegativeSafeInteger(fieldEnd, "fieldEnd");
    if (fieldEnd > byteLength) {
      throw new RangeError(
        `uint field range exceeds row byteLength: required=${fieldEnd}, actual=${byteLength}`,
      );
    }
    maxFieldEnd = Math.max(maxFieldEnd, fieldEnd);
  }

  return {
    byteLength,
    fieldSpecs: fieldSpecs.map((fieldSpec) => ({ ...fieldSpec })),
    fieldCount: fieldSpecs.length,
    maxFieldEnd,
  };
}

export function packUintFields(
  view: DataView,
  count: number,
  byteLength: number,
  fieldSpecs: readonly UintFieldSpec[],
  out: Uint32Array,
  littleEndian = true,
): number {
  return packUintPlan(view, count, createUintPackPlan(byteLength, fieldSpecs), out, littleEndian);
}

export function packUintFieldsWhereU8Eq(
  view: DataView,
  count: number,
  byteLength: number,
  matchOffset: number,
  expected: number,
  fieldSpecs: readonly UintFieldSpec[],
  out: Uint32Array,
  littleEndian = true,
): number {
  return packUintPlanWhereU8Eq(
    view,
    count,
    matchOffset,
    expected,
    createUintPackPlan(byteLength, fieldSpecs),
    out,
    littleEndian,
  );
}

export function packUintFieldsWhereU16Eq(
  view: DataView,
  count: number,
  byteLength: number,
  matchOffset: number,
  expected: number,
  fieldSpecs: readonly UintFieldSpec[],
  out: Uint32Array,
  littleEndian = true,
): number {
  return packUintPlanWhereU16Eq(
    view,
    count,
    matchOffset,
    expected,
    createUintPackPlan(byteLength, fieldSpecs),
    out,
    littleEndian,
  );
}

export function packUintPlan(
  view: DataView,
  count: number,
  plan: UintPackPlan,
  out: Uint32Array,
  littleEndian = true,
): number {
  assertPlanRange(view, count, 0, 1, plan);
  assertOutputCapacityForAll(out, count, plan.fieldCount);

  for (let index = 0; index < count; index += 1) {
    writeUintFields(view, index * plan.byteLength, plan.fieldSpecs, out, index, littleEndian);
  }

  return count;
}

export function packUintPlanWhereU8Eq(
  view: DataView,
  count: number,
  matchOffset: number,
  expected: number,
  plan: UintPackPlan,
  out: Uint32Array,
  littleEndian = true,
): number {
  assertUint8(expected, "expected");
  assertPlanRange(view, count, matchOffset, 1, plan);

  let outputIndex = 0;
  for (let index = 0; index < count; index += 1) {
    const rowOffset = index * plan.byteLength;
    if (view.getUint8(rowOffset + matchOffset) !== expected) {
      continue;
    }

    assertOutputWriteCapacity(out, outputIndex, plan.fieldCount);
    writeUintFields(view, rowOffset, plan.fieldSpecs, out, outputIndex, littleEndian);
    outputIndex += 1;
  }

  return outputIndex;
}

export function packUintPlanWhereU16Eq(
  view: DataView,
  count: number,
  matchOffset: number,
  expected: number,
  plan: UintPackPlan,
  out: Uint32Array,
  littleEndian = true,
): number {
  assertUint16(expected, "expected");
  assertPlanRange(view, count, matchOffset, 2, plan);

  let outputIndex = 0;
  for (let index = 0; index < count; index += 1) {
    const rowOffset = index * plan.byteLength;
    if (view.getUint16(rowOffset + matchOffset, littleEndian) !== expected) {
      continue;
    }

    assertOutputWriteCapacity(out, outputIndex, plan.fieldCount);
    writeUintFields(view, rowOffset, plan.fieldSpecs, out, outputIndex, littleEndian);
    outputIndex += 1;
  }

  return outputIndex;
}

function assertPlanRange(
  view: DataView,
  count: number,
  matchOffset: number,
  matchByteLength: number,
  plan: UintPackPlan,
): void {
  assertRowRange(view, count, plan.byteLength, matchOffset, matchByteLength);
  assertRowRange(view, count, plan.byteLength, 0, plan.maxFieldEnd);
}

function writeUintFields(
  view: DataView,
  rowOffset: number,
  fieldSpecs: readonly UintFieldSpec[],
  out: Uint32Array,
  outputIndex: number,
  littleEndian: boolean,
): void {
  const base = outputIndex * fieldSpecs.length;

  for (let fieldIndex = 0; fieldIndex < fieldSpecs.length; fieldIndex += 1) {
    out[base + fieldIndex] = readUintField(view, rowOffset, fieldSpecs[fieldIndex], littleEndian);
  }
}

function readUintField(
  view: DataView,
  rowOffset: number,
  fieldSpec: UintFieldSpec | undefined,
  littleEndian: boolean,
): number {
  if (fieldSpec === undefined) {
    throw new RangeError("Missing uint field spec");
  }

  switch (fieldSpec.kind) {
    case "u8":
      return view.getUint8(rowOffset + fieldSpec.offset);
    case "u16":
      return view.getUint16(rowOffset + fieldSpec.offset, littleEndian);
    case "u32":
      return view.getUint32(rowOffset + fieldSpec.offset, littleEndian);
  }
}

function uintFieldByteLength(kind: UintFieldKind): number {
  switch (kind) {
    case "u8":
      return 1;
    case "u16":
      return 2;
    case "u32":
      return 4;
  }
}
