import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  BytesSpanView,
  ScalarVectorView,
  writeSpan32Descriptor,
  writeVector32Descriptor,
} from "../../packages/runtime/src/index.js";

describe("runtime ABI property checks", () => {
  it("round-trips arbitrary Span32 byte payloads without materializing objects", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 96 }), (values) => {
        const payload = Uint8Array.from(values);
        const payloadOffset = 16;
        const buffer = new ArrayBuffer(payloadOffset + payload.length);
        const view = new DataView(buffer);

        writeSpan32Descriptor(view, 0, {
          relOffset: payloadOffset,
          byteLength: payload.length,
        });
        new Uint8Array(buffer, payloadOffset, payload.length).set(payload);

        const span = new BytesSpanView(view, 0);
        expect(span.byteLength).toBe(payload.length);
        expect(Array.from(span.bytes())).toEqual(Array.from(payload));
      }),
      { numRuns: 128 },
    );
  });

  it("round-trips arbitrary i32 Vector32 payloads by index and array materialization", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -2_147_483_648, max: 2_147_483_647 }), { maxLength: 64 }),
        (values) => {
          const payloadOffset = 16;
          const buffer = new ArrayBuffer(payloadOffset + values.length * 4);
          const view = new DataView(buffer);

          writeVector32Descriptor(view, 0, {
            relOffset: payloadOffset,
            count: values.length,
          });
          values.forEach((value, index) => {
            view.setInt32(payloadOffset + index * 4, value, true);
          });

          const vector = new ScalarVectorView<number>(view, 0, "i32");
          expect(vector.length).toBe(values.length);
          expect(vector.toArray()).toEqual(values);
        },
      ),
      { numRuns: 128 },
    );
  });
});
