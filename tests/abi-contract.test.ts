import { describe, expect, it } from "vitest";

import * as runtime from "../packages/runtime/src/index.js";
import * as schema from "../packages/schema/src/index.js";

describe("ABI contract parity", () => {
  it("keeps runtime scalar widths in lockstep with schema scalar widths", () => {
    expect(runtime.SCALAR_KINDS).toEqual(schema.SCALAR_KINDS);

    for (const kind of schema.SCALAR_KINDS) {
      expect(runtime.scalarByteLength(kind)).toBe(schema.scalarByteLength(kind));
    }
  });

  it("keeps descriptor constants in lockstep between schema and runtime", () => {
    expect(runtime.SPAN32_BYTE_LENGTH).toBe(schema.SPAN32_BYTE_LENGTH);
    expect(runtime.VECTOR32_BYTE_LENGTH).toBe(schema.VECTOR32_BYTE_LENGTH);
    expect(runtime.POINTER32_BYTE_LENGTH).toBe(schema.POINTER32_BYTE_LENGTH);
    expect(runtime.POINTER32_NULL).toBe(schema.POINTER32_NULL);
  });

  it("reads a frozen v1 fixed-layout fixture with the v2 runtime", () => {
    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    view.setBigUint64(0, 7n, true);
    view.setInt32(8, 41, true);
    runtime.writeFixedUtf8(buffer, 12, 8, "handle");
    runtime.writeVector32Descriptor(view, 20, {
      relOffset: 40,
      count: 2,
    });
    bytes.set([1, 2, 3, 4], 40);
    bytes.set([5, 6, 7, 8], 44);

    expect(view.getBigUint64(0, true)).toBe(7n);
    expect(view.getInt32(8, true)).toBe(41);
    expect(runtime.decodeFixedText(buffer, 12, 8, "utf8").replaceAll("\u0000", "")).toBe("handle");

    const chunks = new runtime.FixedBytesVectorView(view, 20, 4);
    expect(chunks.length).toBe(2);
    expect(Array.from(chunks.at(0))).toEqual([1, 2, 3, 4]);
    expect(Array.from(chunks.at(1))).toEqual([5, 6, 7, 8]);
  });
});
