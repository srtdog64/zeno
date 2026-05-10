export type UintFieldKind = "u8" | "u16" | "u32";

export interface UintFieldSpec {
  readonly offset: number;
  readonly kind: UintFieldKind;
}

export function histogramU8Field(
  view: DataView,
  count: number,
  byteLength: number,
  fieldOffset: number,
  out: Uint32Array,
): void {
  assertRowRange(view, count, byteLength, fieldOffset, 1);
  out.fill(0);

  for (let index = 0; index < count; index += 1) {
    const value = view.getUint8(index * byteLength + fieldOffset);
    incrementBucket(out, value);
  }
}

export function histogramU16Field(
  view: DataView,
  count: number,
  byteLength: number,
  fieldOffset: number,
  out: Uint32Array,
  littleEndian = true,
): void {
  assertRowRange(view, count, byteLength, fieldOffset, 2);
  out.fill(0);

  for (let index = 0; index < count; index += 1) {
    const value = view.getUint16(index * byteLength + fieldOffset, littleEndian);
    incrementBucket(out, value);
  }
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
  assertUint8(expected, "expected");
  assertPositiveInteger(fieldOffsets.length, "fieldCount");
  assertRowRange(view, count, byteLength, matchOffset, 1);
  assertFieldOffsets(view, count, byteLength, fieldOffsets, 4);

  let outputIndex = 0;

  for (let index = 0; index < count; index += 1) {
    const rowOffset = index * byteLength;
    if (view.getUint8(rowOffset + matchOffset) !== expected) {
      continue;
    }

    assertOutputWriteCapacity(out, outputIndex, fieldOffsets.length);
    writeF32Fields(view, rowOffset, fieldOffsets, out, outputIndex, littleEndian);
    outputIndex += 1;
  }

  return outputIndex;
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
  assertUint16(expected, "expected");
  assertPositiveInteger(fieldOffsets.length, "fieldCount");
  assertRowRange(view, count, byteLength, matchOffset, 2);
  assertFieldOffsets(view, count, byteLength, fieldOffsets, 4);

  let outputIndex = 0;

  for (let index = 0; index < count; index += 1) {
    const rowOffset = index * byteLength;
    if (view.getUint16(rowOffset + matchOffset, littleEndian) !== expected) {
      continue;
    }

    assertOutputWriteCapacity(out, outputIndex, fieldOffsets.length);
    writeF32Fields(view, rowOffset, fieldOffsets, out, outputIndex, littleEndian);
    outputIndex += 1;
  }

  return outputIndex;
}

export function packUintFields(
  view: DataView,
  count: number,
  byteLength: number,
  fieldSpecs: readonly UintFieldSpec[],
  out: Uint32Array,
  littleEndian = true,
): number {
  assertOutputCapacityForAll(out, count, fieldSpecs.length);
  assertUintFieldSpecs(view, count, byteLength, fieldSpecs);

  for (let index = 0; index < count; index += 1) {
    writeUintFields(view, index * byteLength, fieldSpecs, out, index, littleEndian);
  }

  return count;
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
  assertUint8(expected, "expected");
  assertPositiveInteger(fieldSpecs.length, "fieldCount");
  assertRowRange(view, count, byteLength, matchOffset, 1);
  assertUintFieldSpecs(view, count, byteLength, fieldSpecs);

  let outputIndex = 0;

  for (let index = 0; index < count; index += 1) {
    const rowOffset = index * byteLength;
    if (view.getUint8(rowOffset + matchOffset) !== expected) {
      continue;
    }

    assertOutputWriteCapacity(out, outputIndex, fieldSpecs.length);
    writeUintFields(view, rowOffset, fieldSpecs, out, outputIndex, littleEndian);
    outputIndex += 1;
  }

  return outputIndex;
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
  assertUint16(expected, "expected");
  assertPositiveInteger(fieldSpecs.length, "fieldCount");
  assertRowRange(view, count, byteLength, matchOffset, 2);
  assertUintFieldSpecs(view, count, byteLength, fieldSpecs);

  let outputIndex = 0;

  for (let index = 0; index < count; index += 1) {
    const rowOffset = index * byteLength;
    if (view.getUint16(rowOffset + matchOffset, littleEndian) !== expected) {
      continue;
    }

    assertOutputWriteCapacity(out, outputIndex, fieldSpecs.length);
    writeUintFields(view, rowOffset, fieldSpecs, out, outputIndex, littleEndian);
    outputIndex += 1;
  }

  return outputIndex;
}

function writeF32Fields(
  view: DataView,
  rowOffset: number,
  fieldOffsets: readonly number[],
  out: Float32Array,
  outputIndex: number,
  littleEndian: boolean,
): void {
  const base = outputIndex * fieldOffsets.length;

  for (let fieldIndex = 0; fieldIndex < fieldOffsets.length; fieldIndex += 1) {
    out[base + fieldIndex] = view.getFloat32(
      rowOffset + checkedOffset(fieldOffsets[fieldIndex]),
      littleEndian,
    );
  }
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

function assertUintFieldSpecs(
  view: DataView,
  count: number,
  byteLength: number,
  fieldSpecs: readonly UintFieldSpec[],
): void {
  for (const fieldSpec of fieldSpecs) {
    assertRowRange(view, count, byteLength, fieldSpec.offset, uintFieldByteLength(fieldSpec.kind));
  }
}

function assertFieldOffsets(
  view: DataView,
  count: number,
  byteLength: number,
  fieldOffsets: readonly number[],
  fieldByteLength: number,
): void {
  for (const fieldOffset of fieldOffsets) {
    assertRowRange(view, count, byteLength, fieldOffset, fieldByteLength);
  }
}

function assertRowRange(
  view: DataView,
  count: number,
  byteLength: number,
  fieldOffset: number,
  fieldByteLength: number,
): void {
  assertNonNegativeInteger(count, "count");
  assertPositiveInteger(byteLength, "byteLength");
  assertNonNegativeInteger(fieldOffset, "fieldOffset");
  assertPositiveInteger(fieldByteLength, "fieldByteLength");

  if (count === 0) {
    return;
  }

  const lastByte = (count - 1) * byteLength + fieldOffset + fieldByteLength;
  if (lastByte > view.byteLength) {
    throw new RangeError(
      `Row field range exceeds DataView length: required=${lastByte}, actual=${view.byteLength}`,
    );
  }
}

function assertOutputCapacityForAll(
  out: { readonly length: number },
  count: number,
  fieldCount: number,
): void {
  assertNonNegativeInteger(count, "count");
  assertPositiveInteger(fieldCount, "fieldCount");

  const required = count * fieldCount;
  if (out.length < required) {
    throw new RangeError(`Output is too small: required=${required}, actual=${out.length}`);
  }
}

function assertOutputWriteCapacity(
  out: { readonly length: number },
  outputIndex: number,
  fieldCount: number,
): void {
  const required = (outputIndex + 1) * fieldCount;
  if (out.length < required) {
    throw new RangeError(`Output is too small: required=${required}, actual=${out.length}`);
  }
}

function incrementBucket(out: Uint32Array, value: number): void {
  if (value >= out.length) {
    throw new RangeError(`Bucket value ${value} exceeds output bucket count ${out.length}`);
  }

  out[value] = (out[value] ?? 0) + 1;
}

function checkedOffset(value: number | undefined): number {
  if (value === undefined) {
    throw new RangeError("Missing field offset");
  }

  return value;
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

function assertUint8(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${label} must be an unsigned 8-bit integer: ${value}`);
  }
}

function assertUint16(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`${label} must be an unsigned 16-bit integer: ${value}`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer: ${value}`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer: ${value}`);
  }
}
