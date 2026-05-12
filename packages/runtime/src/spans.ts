import { SPAN32_BYTE_LENGTH, readSpan32Descriptor } from "./descriptor32.js";
import { decodeText, type TextEncoding } from "./fixed.js";
import { assertDataViewRange } from "./range.js";
import { ProjectionView } from "./view-base.js";

export class BytesSpanView extends ProjectionView {
  static readonly descriptorByteLength = SPAN32_BYTE_LENGTH;

  constructor(
    view: DataView,
    private readonly descriptorOffset: number,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, baseOffset, littleEndian);
  }

  get byteLength(): number {
    return readSpan32Descriptor(
      this.view,
      this.absoluteOffset(this.descriptorOffset),
      this.littleEndian,
    ).byteLength;
  }

  bytes(): Uint8Array {
    const descriptor = readSpan32Descriptor(
      this.view,
      this.absoluteOffset(this.descriptorOffset),
      this.littleEndian,
    );
    this.assertRange(descriptor.relOffset, descriptor.byteLength);
    return new Uint8Array(
      this.backingBuffer(),
      this.backingOffset(descriptor.relOffset),
      descriptor.byteLength,
    );
  }
}

export class Utf8SpanView extends BytesSpanView {
  constructor(
    view: DataView,
    descriptorOffset: number,
    baseOffset = 0,
    littleEndian = true,
    private readonly encoding: TextEncoding = "utf8",
  ) {
    super(view, descriptorOffset, baseOffset, littleEndian);
  }

  text(): string {
    return decodeText(this.bytes(), this.encoding);
  }
}

export function spanEqualsAscii(
  view: DataView,
  descriptorOffset: number,
  value: string,
  baseOffset = 0,
  littleEndian = true,
): boolean {
  const span = readCheckedSpan(view, descriptorOffset, baseOffset, littleEndian);
  if (span.byteLength !== value.length) {
    return false;
  }

  return spanMatchesAsciiAt(view, span.offset, value, 0);
}

export function spanStartsWithAscii(
  view: DataView,
  descriptorOffset: number,
  prefix: string,
  baseOffset = 0,
  littleEndian = true,
): boolean {
  const span = readCheckedSpan(view, descriptorOffset, baseOffset, littleEndian);
  if (prefix.length > span.byteLength) {
    return false;
  }

  return spanMatchesAsciiAt(view, span.offset, prefix, 0);
}

export function spanEndsWithAscii(
  view: DataView,
  descriptorOffset: number,
  suffix: string,
  baseOffset = 0,
  littleEndian = true,
): boolean {
  const span = readCheckedSpan(view, descriptorOffset, baseOffset, littleEndian);
  if (suffix.length > span.byteLength) {
    return false;
  }

  return spanMatchesAsciiAt(view, span.offset, suffix, span.byteLength - suffix.length);
}

export function spanIncludesAscii(
  view: DataView,
  descriptorOffset: number,
  needle: string,
  baseOffset = 0,
  littleEndian = true,
): boolean {
  const span = readCheckedSpan(view, descriptorOffset, baseOffset, littleEndian);
  if (needle.length === 0) {
    return true;
  }
  if (needle.length > span.byteLength) {
    return false;
  }

  const first = needle.charCodeAt(0);
  if (first > 0x7f) {
    return false;
  }

  const limit = span.byteLength - needle.length;
  for (let offset = 0; offset <= limit; offset += 1) {
    if (view.getUint8(span.offset + offset) !== first) {
      continue;
    }
    if (spanMatchesAsciiAt(view, span.offset, needle, offset)) {
      return true;
    }
  }

  return false;
}

export function spanHashBytes(
  view: DataView,
  descriptorOffset: number,
  baseOffset = 0,
  littleEndian = true,
  seed = 0,
): number {
  const span = readCheckedSpan(view, descriptorOffset, baseOffset, littleEndian);
  let hash = seed | 0;
  for (let index = 0; index < span.byteLength; index += 1) {
    hash = ((hash << 5) - hash + view.getUint8(span.offset + index)) | 0;
  }
  return hash;
}

interface CheckedSpan {
  readonly offset: number;
  readonly byteLength: number;
}

function readCheckedSpan(
  view: DataView,
  descriptorOffset: number,
  baseOffset: number,
  littleEndian: boolean,
): CheckedSpan {
  const descriptorAbsoluteOffset = baseOffset + descriptorOffset;
  assertDataViewRange(view, descriptorAbsoluteOffset, SPAN32_BYTE_LENGTH);
  const descriptor = readSpan32Descriptor(view, descriptorAbsoluteOffset, littleEndian);
  const payloadOffset = baseOffset + descriptor.relOffset;
  assertDataViewRange(view, payloadOffset, descriptor.byteLength);
  return { offset: payloadOffset, byteLength: descriptor.byteLength };
}

function spanMatchesAsciiAt(
  view: DataView,
  spanOffset: number,
  value: string,
  valueOffset: number,
): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    if (codePoint > 0x7f || view.getUint8(spanOffset + valueOffset + index) !== codePoint) {
      return false;
    }
  }

  return true;
}
