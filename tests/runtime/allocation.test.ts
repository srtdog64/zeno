import { describe, expect, it } from "vitest";

import {
  ProjectionView,
  readScalar,
} from "../../packages/runtime/src/index.js";

const RECORD_COUNT = 100_000;
const RECORD_STRIDE = 16;
const HEAP_NOISE_BUDGET_BYTES = 1024 * 1024;

type GcGlobal = typeof globalThis & {
  gc?: () => void;
};

function forceGc(): void {
  const gc = (globalThis as GcGlobal).gc;
  if (gc === undefined) {
    return;
  }

  gc();
  gc();
}

function retainedHeapDelta(run: () => void): number {
  forceGc();
  const before = process.memoryUsage().heapUsed;
  run();
  forceGc();
  return process.memoryUsage().heapUsed - before;
}

function makeScalarFixture(): DataView {
  const buffer = new ArrayBuffer(RECORD_COUNT * RECORD_STRIDE);
  const view = new DataView(buffer);

  for (let index = 0; index < RECORD_COUNT; index += 1) {
    view.setInt32(index * RECORD_STRIDE, index, true);
  }

  return view;
}

class ScalarCursor extends ProjectionView {
  static readonly byteLength = RECORD_STRIDE;

  get value(): number {
    return this.view.getInt32(this.baseOffset, this.littleEndian);
  }
}

describe("runtime allocation regression", () => {
  it("keeps scalar helper reads within the retained heap noise budget", () => {
    const view = makeScalarFixture();
    let checksum = 0;
    for (let index = 0; index < RECORD_COUNT; index += 1) {
      checksum += readScalar(view, "i32", index * RECORD_STRIDE, true) as number;
    }
    checksum = 0;

    const retainedHeap = retainedHeapDelta(() => {
      for (let index = 0; index < RECORD_COUNT; index += 1) {
        checksum += readScalar(view, "i32", index * RECORD_STRIDE, true) as number;
      }
    });

    expect(checksum).toBe(4_999_950_000);
    expect(retainedHeap).toBeLessThanOrEqual(HEAP_NOISE_BUDGET_BYTES);
  });

  it("keeps cursor rebase scans within the retained heap noise budget", () => {
    const view = makeScalarFixture();
    const cursor = new ScalarCursor(view);
    let checksum = 0;
    for (let index = 0; index < RECORD_COUNT; index += 1) {
      cursor.moveToOffset(index * ScalarCursor.byteLength, ScalarCursor.byteLength);
      checksum += cursor.value;
    }
    checksum = 0;

    const retainedHeap = retainedHeapDelta(() => {
      for (let index = 0; index < RECORD_COUNT; index += 1) {
        cursor.moveToOffset(index * ScalarCursor.byteLength, ScalarCursor.byteLength);
        checksum += cursor.value;
      }
    });

    expect(checksum).toBe(4_999_950_000);
    expect(retainedHeap).toBeLessThanOrEqual(HEAP_NOISE_BUDGET_BYTES);
  });
});
