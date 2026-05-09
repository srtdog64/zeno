export function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer: ${value}`);
  }
}

export function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError(`${label} must be a uint32 value: ${value}`);
  }
}

export function assertDataViewRange(
  view: DataView,
  offset: number,
  byteLength: number,
): void {
  assertNonNegativeInteger(offset, "offset");
  assertNonNegativeInteger(byteLength, "byteLength");

  if (byteLength > view.byteLength - offset) {
    throw new RangeError(
      `Out of bounds DataView access at ${offset}..${offset + byteLength} for view length ${view.byteLength}`,
    );
  }
}

export function assertBufferRange(
  buffer: ArrayBufferLike,
  offset: number,
  byteLength: number,
): void {
  assertNonNegativeInteger(offset, "offset");
  assertNonNegativeInteger(byteLength, "byteLength");

  if (byteLength > buffer.byteLength - offset) {
    throw new RangeError(
      `Out of bounds buffer access at ${offset}..${offset + byteLength} for buffer length ${buffer.byteLength}`,
    );
  }
}

export function alignOffset(offset: number, alignment: number): number {
  assertNonNegativeInteger(offset, "offset");
  assertNonNegativeInteger(alignment, "alignment");

  if (alignment === 0) {
    throw new RangeError("alignment must be greater than zero");
  }

  return Math.ceil(offset / alignment) * alignment;
}
