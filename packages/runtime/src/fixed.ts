import { assertBufferRange } from "./range.js";

export type TextEncoding = "ascii" | "utf8";

export const UTF8_DECODER = new TextDecoder();
export const UTF8_ENCODER = new TextEncoder();

export function fixedBytesView(
  buffer: ArrayBufferLike,
  offset: number,
  length: number,
): Uint8Array {
  assertBufferRange(buffer, offset, length);
  return new Uint8Array(buffer, offset, length);
}

export function writeFixedBytes(
  buffer: ArrayBufferLike,
  offset: number,
  length: number,
  value: ArrayLike<number> | Uint8Array,
): void {
  assertBufferRange(buffer, offset, length);

  if (value.length > length) {
    throw new RangeError(`Fixed bytes value length ${value.length} exceeds field length ${length}`);
  }

  const target = new Uint8Array(buffer, offset, length);
  target.fill(0);
  target.set(value);
}

export function decodeFixedUtf8(
  buffer: ArrayBufferLike,
  offset: number,
  length: number,
  decoder = UTF8_DECODER,
): string {
  assertBufferRange(buffer, offset, length);
  return decoder.decode(new Uint8Array(buffer, offset, length));
}

export function decodeText(bytes: Uint8Array, encoding: TextEncoding = "utf8"): string {
  if (encoding === "utf8") {
    return UTF8_DECODER.decode(bytes);
  }

  for (const byte of bytes) {
    if (byte > 0x7f) {
      throw new RangeError(`ASCII text contains non-ASCII byte: ${byte}`);
    }
  }

  return UTF8_DECODER.decode(bytes);
}

export function bytesEqual(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export function equalsAscii(bytes: ArrayLike<number>, value: string): boolean {
  if (bytes.length !== value.length) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    if (codePoint > 0x7f || bytes[index] !== codePoint) {
      return false;
    }
  }

  return true;
}

export function startsWithAscii(bytes: ArrayLike<number>, prefix: string): boolean {
  if (prefix.length > bytes.length) {
    return false;
  }

  for (let index = 0; index < prefix.length; index += 1) {
    const codePoint = prefix.charCodeAt(index);
    if (codePoint > 0x7f || bytes[index] !== codePoint) {
      return false;
    }
  }

  return true;
}

export function endsWithAscii(bytes: ArrayLike<number>, suffix: string): boolean {
  if (suffix.length > bytes.length) {
    return false;
  }

  const offset = bytes.length - suffix.length;
  for (let index = 0; index < suffix.length; index += 1) {
    const codePoint = suffix.charCodeAt(index);
    if (codePoint > 0x7f || bytes[offset + index] !== codePoint) {
      return false;
    }
  }

  return true;
}

export function includesAscii(bytes: ArrayLike<number>, needle: string): boolean {
  if (needle.length === 0) {
    return true;
  }
  if (needle.length > bytes.length) {
    return false;
  }

  const first = needle.charCodeAt(0);
  if (first > 0x7f) {
    return false;
  }

  const limit = bytes.length - needle.length;
  for (let offset = 0; offset <= limit; offset += 1) {
    if (bytes[offset] !== first) {
      continue;
    }

    let matched = true;
    for (let index = 1; index < needle.length; index += 1) {
      const codePoint = needle.charCodeAt(index);
      if (codePoint > 0x7f || bytes[offset + index] !== codePoint) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return true;
    }
  }

  return false;
}

export function hashBytes(bytes: ArrayLike<number>, seed = 0): number {
  let hash = seed | 0;
  for (let index = 0; index < bytes.length; index += 1) {
    hash = ((hash << 5) - hash + (bytes[index] ?? 0)) | 0;
  }
  return hash;
}

export function encodeText(value: string, encoding: TextEncoding = "utf8"): Uint8Array {
  if (encoding === "utf8") {
    return UTF8_ENCODER.encode(value);
  }

  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    if (codePoint > 0x7f) {
      throw new RangeError(`ASCII text contains non-ASCII code point: ${codePoint}`);
    }
    bytes[index] = codePoint;
  }
  return bytes;
}

export function decodeFixedText(
  buffer: ArrayBufferLike,
  offset: number,
  length: number,
  encoding: TextEncoding = "utf8",
): string {
  assertBufferRange(buffer, offset, length);
  return decodeText(new Uint8Array(buffer, offset, length), encoding);
}

export function writeFixedUtf8(
  buffer: ArrayBufferLike,
  offset: number,
  length: number,
  value: string,
  encoder = UTF8_ENCODER,
): void {
  writeFixedBytes(buffer, offset, length, encoder.encode(value));
}

export function writeFixedText(
  buffer: ArrayBufferLike,
  offset: number,
  length: number,
  value: string,
  encoding: TextEncoding = "utf8",
): void {
  writeFixedBytes(buffer, offset, length, encodeText(value, encoding));
}
