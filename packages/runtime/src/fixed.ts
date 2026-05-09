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
    throw new RangeError(
      `Fixed bytes value length ${value.length} exceeds field length ${length}`,
    );
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
