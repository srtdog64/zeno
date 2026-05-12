import {
  assertNonNegativeSafeInteger,
  assertOutputWriteCapacity,
  assertPositiveSafeInteger,
  assertRowRange,
  assertUint16,
  assertUint8,
} from "./range.js";
import type { F32PackPlan } from "./types.js";

export function createF32PackPlan(
  byteLength: number,
  fieldOffsets: readonly number[],
): F32PackPlan {
  assertPositiveSafeInteger(byteLength, "byteLength");
  assertPositiveSafeInteger(fieldOffsets.length, "fieldCount");

  let maxFieldEnd = 0;
  for (const fieldOffset of fieldOffsets) {
    assertNonNegativeSafeInteger(fieldOffset, "fieldOffset");
    const fieldEnd = fieldOffset + Float32Array.BYTES_PER_ELEMENT;
    assertNonNegativeSafeInteger(fieldEnd, "fieldEnd");
    if (fieldEnd > byteLength) {
      throw new RangeError(
        `f32 field range exceeds row byteLength: required=${fieldEnd}, actual=${byteLength}`,
      );
    }
    maxFieldEnd = Math.max(maxFieldEnd, fieldEnd);
  }

  return {
    byteLength,
    fieldOffsets: [...fieldOffsets],
    fieldCount: fieldOffsets.length,
    maxFieldEnd,
  };
}

export function packF32FieldsWhereU8Eq(
  view: DataView,
  count: number,
  byteLength: number,
  matchOffset: number,
  expected: number,
  fieldOffsets: readonly number[],
  out: Float32Array,
  littleEndian = true,
): number {
  return packF32PlanWhereU8Eq(
    view,
    count,
    matchOffset,
    expected,
    createF32PackPlan(byteLength, fieldOffsets),
    out,
    littleEndian,
  );
}

export function packF32FieldsWhereU16Eq(
  view: DataView,
  count: number,
  byteLength: number,
  matchOffset: number,
  expected: number,
  fieldOffsets: readonly number[],
  out: Float32Array,
  littleEndian = true,
): number {
  return packF32PlanWhereU16Eq(
    view,
    count,
    matchOffset,
    expected,
    createF32PackPlan(byteLength, fieldOffsets),
    out,
    littleEndian,
  );
}

export function packF32PlanWhereU8Eq(
  view: DataView,
  count: number,
  matchOffset: number,
  expected: number,
  plan: F32PackPlan,
  out: Float32Array,
  littleEndian = true,
): number {
  assertUint8(expected, "expected");
  assertPlanRange(view, count, matchOffset, 1, plan);
  const hasFullOutputCapacity = hasOutputCapacityForAll(out, count, plan.fieldCount);

  let outputIndex = 0;
  for (let index = 0; index < count; index += 1) {
    const rowOffset = index * plan.byteLength;
    if (view.getUint8(rowOffset + matchOffset) !== expected) {
      continue;
    }

    if (!hasFullOutputCapacity) {
      assertOutputWriteCapacity(out, outputIndex, plan.fieldCount);
    }
    writeF32Fields(view, rowOffset, plan.fieldOffsets, out, outputIndex, littleEndian);
    outputIndex += 1;
  }

  return outputIndex;
}

export function packF32PlanWhereU16Eq(
  view: DataView,
  count: number,
  matchOffset: number,
  expected: number,
  plan: F32PackPlan,
  out: Float32Array,
  littleEndian = true,
): number {
  assertUint16(expected, "expected");
  assertPlanRange(view, count, matchOffset, 2, plan);
  const hasFullOutputCapacity = hasOutputCapacityForAll(out, count, plan.fieldCount);

  let outputIndex = 0;
  for (let index = 0; index < count; index += 1) {
    const rowOffset = index * plan.byteLength;
    if (view.getUint16(rowOffset + matchOffset, littleEndian) !== expected) {
      continue;
    }

    if (!hasFullOutputCapacity) {
      assertOutputWriteCapacity(out, outputIndex, plan.fieldCount);
    }
    writeF32Fields(view, rowOffset, plan.fieldOffsets, out, outputIndex, littleEndian);
    outputIndex += 1;
  }

  return outputIndex;
}

function assertPlanRange(
  view: DataView,
  count: number,
  matchOffset: number,
  matchByteLength: number,
  plan: F32PackPlan,
): void {
  assertRowRange(view, count, plan.byteLength, matchOffset, matchByteLength);
  assertRowRange(view, count, plan.byteLength, 0, plan.maxFieldEnd);
}

function hasOutputCapacityForAll(
  out: { readonly length: number },
  count: number,
  fieldCount: number,
): boolean {
  const required = count * fieldCount;
  return Number.isSafeInteger(required) && out.length >= required;
}

function writeF32Fields(
  view: DataView,
  rowOffset: number,
  fieldOffsets: readonly number[],
  out: Float32Array,
  outputIndex: number,
  littleEndian: boolean,
): void {
  let targetIndex = outputIndex * fieldOffsets.length;

  for (const fieldOffset of fieldOffsets) {
    out[targetIndex] = view.getFloat32(rowOffset + fieldOffset, littleEndian);
    targetIndex += 1;
  }
}
