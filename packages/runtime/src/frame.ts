import { assertDataViewRange, assertUint32 } from "./range.js";

export const ZENO_FRAME_HEADER_BYTE_LENGTH = 24;
export const ZENO_FRAME_VERSION_MAJOR = 1;
export const ZENO_FRAME_LAYOUT_HASH_NONE = 0n;

const ZENO_FRAME_MAGIC_0 = 0x5a;
const ZENO_FRAME_MAGIC_1 = 0x45;
const ZENO_FRAME_MAGIC_2 = 0x4e;
const ZENO_FRAME_MAGIC_3 = 0x4f;
const ZENO_FRAME_ENDIAN_LITTLE = 1;
const ZENO_FRAME_ENDIAN_BIG = 2;
const MAX_UINT64 = 0xffffffffffffffffn;

export type ZenoFrameEndianness = "little" | "big";

export interface ZenoFrameHeader {
  readonly versionMajor: number;
  readonly versionMinor: number;
  readonly endianness: ZenoFrameEndianness;
  readonly flags: number;
  readonly layoutHash: bigint;
  readonly payloadOffset: number;
  readonly payloadByteLength: number;
}

export interface WriteZenoFrameHeaderOptions {
  readonly versionMinor?: number;
  readonly endianness: ZenoFrameEndianness;
  readonly flags?: number;
  readonly layoutHash?: bigint;
  readonly payloadOffset?: number;
  readonly payloadByteLength: number;
}

export interface ZenoFrameExpectation {
  readonly endianness?: ZenoFrameEndianness;
  readonly layoutHash?: bigint;
}

export function writeZenoFrameHeader(
  view: DataView,
  header: WriteZenoFrameHeaderOptions,
  offset = 0,
): ZenoFrameHeader {
  assertDataViewRange(view, offset, ZENO_FRAME_HEADER_BYTE_LENGTH);
  const versionMinor = header.versionMinor ?? 0;
  const flags = header.flags ?? 0;
  const layoutHash = header.layoutHash ?? ZENO_FRAME_LAYOUT_HASH_NONE;
  const payloadOffset = header.payloadOffset ?? ZENO_FRAME_HEADER_BYTE_LENGTH;

  assertUint8(versionMinor, "Zeno frame versionMinor");
  assertUint8(flags, "Zeno frame flags");
  if (flags !== 0) {
    throw new RangeError(`Unsupported Zeno frame flags: ${flags}`);
  }
  assertUint64(layoutHash, "Zeno frame layoutHash");
  assertUint32(payloadOffset, "Zeno frame payloadOffset");
  assertUint32(header.payloadByteLength, "Zeno frame payloadByteLength");
  assertPayloadRange(view, offset, payloadOffset, header.payloadByteLength);

  view.setUint8(offset + 0, ZENO_FRAME_MAGIC_0);
  view.setUint8(offset + 1, ZENO_FRAME_MAGIC_1);
  view.setUint8(offset + 2, ZENO_FRAME_MAGIC_2);
  view.setUint8(offset + 3, ZENO_FRAME_MAGIC_3);
  view.setUint8(offset + 4, ZENO_FRAME_VERSION_MAJOR);
  view.setUint8(offset + 5, versionMinor);
  view.setUint8(offset + 6, endianMarker(header.endianness));
  view.setUint8(offset + 7, flags);
  view.setBigUint64(offset + 8, layoutHash, true);
  view.setUint32(offset + 16, payloadOffset, true);
  view.setUint32(offset + 20, header.payloadByteLength, true);

  return {
    versionMajor: ZENO_FRAME_VERSION_MAJOR,
    versionMinor,
    endianness: header.endianness,
    flags,
    layoutHash,
    payloadOffset,
    payloadByteLength: header.payloadByteLength,
  };
}

export function readZenoFrameHeader(
  view: DataView,
  offset = 0,
): ZenoFrameHeader {
  assertDataViewRange(view, offset, ZENO_FRAME_HEADER_BYTE_LENGTH);
  assertMagic(view, offset);

  const versionMajor = view.getUint8(offset + 4);
  if (versionMajor !== ZENO_FRAME_VERSION_MAJOR) {
    throw new RangeError(`Unsupported Zeno frame major version: ${versionMajor}`);
  }

  const versionMinor = view.getUint8(offset + 5);
  const endianness = markerEndianness(view.getUint8(offset + 6));
  const flags = view.getUint8(offset + 7);
  if (flags !== 0) {
    throw new RangeError(`Unsupported Zeno frame flags: ${flags}`);
  }

  const layoutHash = view.getBigUint64(offset + 8, true);
  const payloadOffset = view.getUint32(offset + 16, true);
  const payloadByteLength = view.getUint32(offset + 20, true);
  assertPayloadRange(view, offset, payloadOffset, payloadByteLength);

  return {
    versionMajor,
    versionMinor,
    endianness,
    flags,
    layoutHash,
    payloadOffset,
    payloadByteLength,
  };
}

export function assertZenoFrameHeader(
  view: DataView,
  expectation: ZenoFrameExpectation = {},
  offset = 0,
): ZenoFrameHeader {
  const header = readZenoFrameHeader(view, offset);

  if (
    expectation.endianness !== undefined &&
    header.endianness !== expectation.endianness
  ) {
    throw new RangeError(
      `Zeno frame endianness mismatch: expected ${expectation.endianness}, got ${header.endianness}`,
    );
  }

  if (
    expectation.layoutHash !== undefined &&
    header.layoutHash !== expectation.layoutHash
  ) {
    throw new RangeError(
      `Zeno frame layout hash mismatch: expected ${expectation.layoutHash}, got ${header.layoutHash}`,
    );
  }

  return header;
}

export function zenoFramePayloadView(view: DataView, offset = 0): DataView {
  const header = readZenoFrameHeader(view, offset);
  return new DataView(
    view.buffer,
    view.byteOffset + offset + header.payloadOffset,
    header.payloadByteLength,
  );
}

function assertMagic(view: DataView, offset: number): void {
  if (
    view.getUint8(offset + 0) !== ZENO_FRAME_MAGIC_0 ||
    view.getUint8(offset + 1) !== ZENO_FRAME_MAGIC_1 ||
    view.getUint8(offset + 2) !== ZENO_FRAME_MAGIC_2 ||
    view.getUint8(offset + 3) !== ZENO_FRAME_MAGIC_3
  ) {
    throw new RangeError("Invalid Zeno frame magic");
  }
}

function assertPayloadRange(
  view: DataView,
  frameOffset: number,
  payloadOffset: number,
  payloadByteLength: number,
): void {
  if (payloadOffset < ZENO_FRAME_HEADER_BYTE_LENGTH) {
    throw new RangeError(
      `Zeno frame payloadOffset must be at least ${ZENO_FRAME_HEADER_BYTE_LENGTH}: ${payloadOffset}`,
    );
  }
  assertDataViewRange(view, frameOffset + payloadOffset, payloadByteLength);
}

function assertUint8(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new RangeError(`${label} must be a uint8 value: ${value}`);
  }
}

function assertUint64(value: bigint, label: string): void {
  if (typeof value !== "bigint" || value < 0n || value > MAX_UINT64) {
    throw new RangeError(`${label} must be a uint64 value: ${value}`);
  }
}

function endianMarker(endianness: ZenoFrameEndianness): number {
  switch (endianness) {
    case "little":
      return ZENO_FRAME_ENDIAN_LITTLE;
    case "big":
      return ZENO_FRAME_ENDIAN_BIG;
    default:
      throw new RangeError(`Invalid Zeno frame endianness: ${endianness}`);
  }
}

function markerEndianness(marker: number): ZenoFrameEndianness {
  switch (marker) {
    case ZENO_FRAME_ENDIAN_LITTLE:
      return "little";
    case ZENO_FRAME_ENDIAN_BIG:
      return "big";
    default:
      throw new RangeError(`Invalid Zeno frame endianness marker: ${marker}`);
  }
}
