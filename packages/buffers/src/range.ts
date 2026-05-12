export function assertRowRange(
  view: DataView,
  count: number,
  byteLength: number,
  fieldOffset: number,
  fieldByteLength: number,
): void {
  assertNonNegativeSafeInteger(count, "count");
  assertPositiveSafeInteger(byteLength, "byteLength");
  assertNonNegativeSafeInteger(fieldOffset, "fieldOffset");
  assertPositiveSafeInteger(fieldByteLength, "fieldByteLength");

  const fieldEnd = fieldOffset + fieldByteLength;
  assertNonNegativeSafeInteger(fieldEnd, "fieldEnd");

  if (count === 0) {
    return;
  }

  const lastByte = (count - 1) * byteLength + fieldEnd;
  assertNonNegativeSafeInteger(lastByte, "lastByte");

  if (lastByte > view.byteLength) {
    throw new RangeError(
      `Row field range exceeds DataView length: required=${lastByte}, actual=${view.byteLength}`,
    );
  }
}

export function assertOutputCapacityForAll(
  out: { readonly length: number },
  count: number,
  fieldCount: number,
): void {
  assertNonNegativeSafeInteger(count, "count");
  assertPositiveSafeInteger(fieldCount, "fieldCount");

  const required = count * fieldCount;
  assertNonNegativeSafeInteger(required, "required");
  if (out.length < required) {
    throw new RangeError(`Output is too small: required=${required}, actual=${out.length}`);
  }
}

export function assertOutputWriteCapacity(
  out: { readonly length: number },
  outputIndex: number,
  fieldCount: number,
): void {
  assertNonNegativeSafeInteger(outputIndex, "outputIndex");
  assertPositiveSafeInteger(fieldCount, "fieldCount");

  const required = (outputIndex + 1) * fieldCount;
  assertNonNegativeSafeInteger(required, "required");
  if (out.length < required) {
    throw new RangeError(`Output is too small: required=${required}, actual=${out.length}`);
  }
}

export function assertUint8(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${label} must be an unsigned 8-bit integer: ${value}`);
  }
}

export function assertUint16(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`${label} must be an unsigned 16-bit integer: ${value}`);
  }
}

export function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer: ${value}`);
  }
}

export function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer: ${value}`);
  }
}

export function checkedOffset(value: number | undefined): number {
  if (value === undefined) {
    throw new RangeError("Missing field offset");
  }

  return value;
}
