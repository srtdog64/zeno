import { assertRowRange } from "./range.js";

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

function incrementBucket(out: Uint32Array, value: number): void {
  if (value >= out.length) {
    throw new RangeError(`Bucket value ${value} exceeds output bucket count ${out.length}`);
  }

  out[value] = (out[value] ?? 0) + 1;
}
