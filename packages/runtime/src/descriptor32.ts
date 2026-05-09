import { assertDataViewRange, assertUint32 } from "./range.js";

export const SPAN32_BYTE_LENGTH = 8;
export const VECTOR32_BYTE_LENGTH = 8;

export interface Span32Descriptor {
  readonly relOffset: number;
  readonly byteLength: number;
}

export interface Vector32Descriptor {
  readonly relOffset: number;
  readonly count: number;
}

export function readSpan32Descriptor(
  view: DataView,
  offset: number,
  littleEndian = true,
): Span32Descriptor {
  assertDataViewRange(view, offset, SPAN32_BYTE_LENGTH);

  return {
    relOffset: view.getUint32(offset, littleEndian),
    byteLength: view.getUint32(offset + 4, littleEndian),
  };
}

export function writeSpan32Descriptor(
  view: DataView,
  offset: number,
  descriptor: Span32Descriptor,
  littleEndian = true,
): void {
  assertDataViewRange(view, offset, SPAN32_BYTE_LENGTH);
  assertUint32(descriptor.relOffset, "Span32.relOffset");
  assertUint32(descriptor.byteLength, "Span32.byteLength");

  view.setUint32(offset, descriptor.relOffset, littleEndian);
  view.setUint32(offset + 4, descriptor.byteLength, littleEndian);
}

export function readVector32Descriptor(
  view: DataView,
  offset: number,
  littleEndian = true,
): Vector32Descriptor {
  assertDataViewRange(view, offset, VECTOR32_BYTE_LENGTH);

  return {
    relOffset: view.getUint32(offset, littleEndian),
    count: view.getUint32(offset + 4, littleEndian),
  };
}

export function writeVector32Descriptor(
  view: DataView,
  offset: number,
  descriptor: Vector32Descriptor,
  littleEndian = true,
): void {
  assertDataViewRange(view, offset, VECTOR32_BYTE_LENGTH);
  assertUint32(descriptor.relOffset, "Vector32.relOffset");
  assertUint32(descriptor.count, "Vector32.count");

  view.setUint32(offset, descriptor.relOffset, littleEndian);
  view.setUint32(offset + 4, descriptor.count, littleEndian);
}
