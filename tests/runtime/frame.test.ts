import { describe, expect, it } from "vitest";

import {
  ZENO_FRAME_HEADER_BYTE_LENGTH,
  assertZenoFrameHeader,
  assertZenoFramePayload,
  checkedZenoFramePayloadView,
  readZenoFrameHeader,
  writeZenoFrameHeader,
  zenoFramePayloadView,
} from "../../packages/runtime/src/index.js";

describe("Zeno frame header", () => {
  it("writes and reads an optional container header", () => {
    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);
    view.setUint8(ZENO_FRAME_HEADER_BYTE_LENGTH, 0xab);

    const written = writeZenoFrameHeader(view, {
      versionMinor: 1,
      endianness: "big",
      layoutHash: 0x1234n,
      payloadByteLength: 16,
    });

    expect(written).toEqual({
      versionMajor: 1,
      versionMinor: 1,
      endianness: "big",
      flags: 0,
      layoutHash: 0x1234n,
      payloadOffset: ZENO_FRAME_HEADER_BYTE_LENGTH,
      payloadByteLength: 16,
    });
    expect(readZenoFrameHeader(view)).toEqual(written);
    expect(assertZenoFrameHeader(view, {
      endianness: "big",
      layoutHash: 0x1234n,
    })).toEqual(written);

    const payload = zenoFramePayloadView(view);
    expect(payload.byteLength).toBe(16);
    expect(payload.getUint8(0)).toBe(0xab);
  });

  it("rejects malformed frame boundaries and identity fields", () => {
    const view = new DataView(new ArrayBuffer(32));

    expect(() => readZenoFrameHeader(view)).toThrow(RangeError);
    expect(() =>
      writeZenoFrameHeader(view, {
        endianness: "little",
        payloadOffset: 8,
        payloadByteLength: 1,
      }),
    ).toThrow(RangeError);
    expect(() =>
      writeZenoFrameHeader(view, {
        endianness: "little",
        flags: 1,
        payloadByteLength: 1,
      }),
    ).toThrow(RangeError);
    expect(() =>
      writeZenoFrameHeader(view, {
        endianness: "little",
        payloadByteLength: 16,
      }),
    ).toThrow(RangeError);
  });

  it("rejects expectation mismatches", () => {
    const view = new DataView(new ArrayBuffer(48));
    writeZenoFrameHeader(view, {
      endianness: "little",
      layoutHash: 7n,
      payloadByteLength: 8,
    });

    expect(() =>
      assertZenoFrameHeader(view, { endianness: "big" }),
    ).toThrow(RangeError);
    expect(() =>
      assertZenoFrameHeader(view, { layoutHash: 8n }),
    ).toThrow(RangeError);
  });

  it("checks payload expectations before constructing boundary payload views", () => {
    const view = new DataView(new ArrayBuffer(64));
    writeZenoFrameHeader(view, {
      endianness: "little",
      layoutHash: 7n,
      payloadByteLength: 16,
    });

    expect(assertZenoFramePayload(view, {
      endianness: "little",
      layoutHash: 7n,
      minPayloadByteLength: 12,
    }).payloadByteLength).toBe(16);

    const payload = checkedZenoFramePayloadView(view, {
      payloadByteLength: 16,
    });
    expect(payload.byteLength).toBe(16);

    expect(() =>
      assertZenoFramePayload(view, { payloadByteLength: 12 }),
    ).toThrow(RangeError);
    expect(() =>
      checkedZenoFramePayloadView(view, { minPayloadByteLength: 24 }),
    ).toThrow(RangeError);
  });
});
