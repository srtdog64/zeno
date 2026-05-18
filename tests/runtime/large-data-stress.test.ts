import { describe, expect, it } from "vitest";

import {
  BytesSpanView,
  DynamicLayoutWriter,
  ProjectionView,
  ScalarVectorView,
  traversePointerChain,
  writeVector32Descriptor,
} from "../../packages/runtime/src/index.js";

const RECORD_COUNT = 1_000_000;
const RECORD_STRIDE = 16;
const VECTOR_COUNT = 1_000_000;
const DYNAMIC_RECORD_COUNT = 50_000;
const DYNAMIC_PAYLOAD_LENGTH = 32;
const POINTER_NODE_COUNT = 50_000;

class StressRowView extends ProjectionView {
  static readonly byteLength = RECORD_STRIDE;

  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  get value(): number {
    return this.view.getInt32(this.baseOffset, this.littleEndian);
  }
}

class StressNodeView extends ProjectionView {
  static readonly byteLength = 8;

  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  get value(): number {
    return this.view.getInt32(this.baseOffset, this.littleEndian);
  }

  nextInto(out: StressNodeView): boolean {
    const raw = this.view.getUint32(this.baseOffset + 4, this.littleEndian);
    if (raw === 0xffffffff) {
      return false;
    }

    const relativeOffset = this.view.getInt32(this.baseOffset + 4, this.littleEndian);
    out.moveToOffset(this.baseOffset + 4 + relativeOffset, StressNodeView.byteLength);
    return true;
  }
}

describe("large data runtime stress", () => {
  it("scans one million fixed records after one range proof", () => {
    const buffer = new ArrayBuffer(RECORD_COUNT * RECORD_STRIDE);
    const view = new DataView(buffer);

    for (let index = 0; index < RECORD_COUNT; index += 1) {
      view.setInt32(index * RECORD_STRIDE, index, true);
    }

    expect(RECORD_COUNT * RECORD_STRIDE).toBeLessThanOrEqual(view.byteLength);

    const row = new StressRowView(view);
    let checksum = 0;
    for (let index = 0; index < RECORD_COUNT; index += 1) {
      row.moveToOffsetUnchecked(index * RECORD_STRIDE, RECORD_STRIDE);
      checksum += row.value;
    }

    expect(checksum).toBe(499_999_500_000);
  });

  it("projects a one million element scalar vector as a native typed array", () => {
    const payloadOffset = 16;
    const buffer = new ArrayBuffer(payloadOffset + VECTOR_COUNT * Int32Array.BYTES_PER_ELEMENT);
    const view = new DataView(buffer);
    const payload = new Int32Array(buffer, payloadOffset, VECTOR_COUNT);

    writeVector32Descriptor(view, 0, { relOffset: payloadOffset, count: VECTOR_COUNT });
    for (let index = 0; index < VECTOR_COUNT; index += 1) {
      payload[index] = index % 1024;
    }

    const vector = new ScalarVectorView<number>(view, 0, "i32");
    const native = vector.nativeArray() as Int32Array;

    expect(native.length).toBe(VECTOR_COUNT);
    expect(native[0]).toBe(0);
    expect(native[1023]).toBe(1023);
    expect(native[1024]).toBe(0);
    expect(native[VECTOR_COUNT - 1]).toBe((VECTOR_COUNT - 1) % 1024);
  });

  it("writes a large dynamic tail without descriptor or cursor drift", () => {
    const descriptorByteLength = DYNAMIC_RECORD_COUNT * 8;
    const payloadByteLength = DYNAMIC_RECORD_COUNT * DYNAMIC_PAYLOAD_LENGTH;
    const buffer = new ArrayBuffer(descriptorByteLength + payloadByteLength);
    const view = new DataView(buffer);
    const writer = new DynamicLayoutWriter(view, descriptorByteLength);
    const payload = new Uint8Array(DYNAMIC_PAYLOAD_LENGTH);

    for (let index = 0; index < DYNAMIC_RECORD_COUNT; index += 1) {
      payload.fill(index & 0xff);
      writer.writeBytes(index * 8, payload);
    }

    expect(writer.tailOffset).toBe(descriptorByteLength + payloadByteLength);

    let checksum = 0;
    for (let index = 0; index < DYNAMIC_RECORD_COUNT; index += 1) {
      checksum += new BytesSpanView(view, index * 8).bytes()[0] ?? 0;
    }

    expect(checksum).toBe(6_367_960);
  });

  it("traverses a large pointer chain only within the caller budget", () => {
    const buffer = new ArrayBuffer(POINTER_NODE_COUNT * StressNodeView.byteLength);
    const view = new DataView(buffer);

    for (let index = 0; index < POINTER_NODE_COUNT; index += 1) {
      const baseOffset = index * StressNodeView.byteLength;
      view.setInt32(baseOffset, index, true);
      if (index === POINTER_NODE_COUNT - 1) {
        view.setUint32(baseOffset + 4, 0xffffffff, true);
      } else {
        const nextOffset = (index + 1) * StressNodeView.byteLength;
        view.setInt32(baseOffset + 4, nextOffset - (baseOffset + 4), true);
      }
    }

    const start = new StressNodeView(view);
    let checksum = 0;

    const steps = traversePointerChain(
      start,
      (current, out) => current.nextInto(out),
      (current) => {
        checksum += current.value;
      },
      POINTER_NODE_COUNT,
    );

    expect(steps).toBe(POINTER_NODE_COUNT);
    expect(checksum).toBe(1_249_975_000);

    start.moveToOffsetUnchecked(0, StressNodeView.byteLength);
    expect(() =>
      traversePointerChain(
        start,
        (current, out) => current.nextInto(out),
        () => undefined,
        POINTER_NODE_COUNT - 1,
      ),
    ).toThrow(/maxSteps/);
  });
});
