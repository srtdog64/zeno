import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  BytesSpanView,
  PointerVectorView,
  ProjectionView,
  ScalarVectorView,
  Utf8VectorView,
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

  it("rejects arbitrary malformed descriptor payload ranges", () => {
    fc.assert(
      fc.property(
        fc.record({
          relOffset: fc.integer({ min: 0, max: 0xffffffff }),
          byteLength: fc.integer({ min: 1, max: 0xffffffff }),
        }),
        (descriptor) => {
          fc.pre(descriptor.relOffset + descriptor.byteLength > 64);
          const buffer = new ArrayBuffer(64);
          const view = new DataView(buffer);

          writeSpan32Descriptor(view, 0, descriptor);

          expect(() => new BytesSpanView(view, 0).bytes()).toThrow(RangeError);
        },
      ),
      { numRuns: 128 },
    );
  });

  it("rejects arbitrary malformed vector table and pointer targets", () => {
    fc.assert(
      fc.property(
        fc.record({
          relOffset: fc.integer({ min: 61, max: 0xffffffff }),
          count: fc.integer({ min: 1, max: 0xffffffff }),
          pointerTarget: fc.integer({ min: 65, max: 0x7fffffff }),
        }),
        ({ relOffset, count, pointerTarget }) => {
          const scalarBuffer = new ArrayBuffer(64);
          const scalarView = new DataView(scalarBuffer);
          writeVector32Descriptor(scalarView, 0, { relOffset, count });

          expect(() => new ScalarVectorView<number>(scalarView, 0, "i32").at(0)).toThrow(
            RangeError,
          );

          const textBuffer = new ArrayBuffer(64);
          const textView = new DataView(textBuffer);
          writeVector32Descriptor(textView, 0, { relOffset, count });

          expect(() => new Utf8VectorView(textView, 0).textAt(0)).toThrow(RangeError);

          const pointerBuffer = new ArrayBuffer(64);
          const pointerView = new DataView(pointerBuffer);
          writeVector32Descriptor(pointerView, 0, {
            relOffset: 16,
            count: 1,
          });
          pointerView.setInt32(16, pointerTarget, true);

          expect(() =>
            new PointerVectorView(
              pointerView,
              0,
              8,
              (targetView, baseOffset, littleEndian) =>
                new ProjectionView(targetView, baseOffset, littleEndian),
            ).targetOffsetAt(0),
          ).toThrow(RangeError);
        },
      ),
      { numRuns: 128 },
    );
  });
});
