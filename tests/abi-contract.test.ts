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
});
