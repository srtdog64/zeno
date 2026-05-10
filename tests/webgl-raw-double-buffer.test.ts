import { describe, expect, it } from "vitest";

import {
  canWriteFrameBuffer,
  claimPublishedFrame,
  ControlCell,
  controlIndex,
  createControlBuffer,
  markFrameUploadComplete,
  markFrameUploadStart,
  publishFrameBuffer,
} from "../examples/webgl-raw-double-buffer/src/shared.js";

describe("raw WebGL double-buffer publication protocol", () => {
  it("allows the first writer before any frame is published", () => {
    const control = createControl();

    expect(canWriteFrameBuffer(control, 0)).toBe(true);
    expect(canWriteFrameBuffer(control, 1)).toBe(true);
  });

  it("blocks writes to the published read buffer until the renderer consumes it", () => {
    const control = createControl();
    publishFrameBuffer(control, 0);

    expect(canWriteFrameBuffer(control, 0)).toBe(false);
    expect(canWriteFrameBuffer(control, 1)).toBe(true);

    markFrameUploadComplete(control, 0);

    expect(canWriteFrameBuffer(control, 0)).toBe(true);
  });

  it("blocks writes to a buffer while the renderer is uploading it", () => {
    const control = createControl();
    publishFrameBuffer(control, 0);
    markFrameUploadStart(control, 0);

    expect(canWriteFrameBuffer(control, 0)).toBe(false);

    markFrameUploadComplete(control, 0);

    expect(canWriteFrameBuffer(control, 0)).toBe(true);
  });

  it("rejects invalid frame buffer indexes", () => {
    const control = createControl();

    expect(() => canWriteFrameBuffer(control, -1)).toThrow(RangeError);
    expect(() => canWriteFrameBuffer(control, 2)).toThrow(RangeError);
    expect(() => markFrameUploadStart(control, 2)).toThrow(RangeError);
    expect(() => markFrameUploadComplete(control, 2)).toThrow(RangeError);
  });

  it("claims a versioned frame snapshot before upload", () => {
    const control = createControl();
    const frameVersion = publishFrameBuffer(control, 0);

    expect(claimPublishedFrame(control, 0)).toEqual({
      readBuffer: 0,
      frameVersion,
    });
    expect(Atomics.load(control, controlIndex(ControlCell.uploadingBuffer))).toBe(0);

    markFrameUploadComplete(control, 0);

    expect(claimPublishedFrame(control, frameVersion)).toBeNull();
  });

  it("rejects a torn frame publication snapshot", () => {
    const control = createControl();
    Atomics.store(control, controlIndex(ControlCell.ready), 1);
    Atomics.store(control, controlIndex(ControlCell.readBuffer), 0);
    Atomics.store(control, controlIndex(ControlCell.frameVersion), 2);
    Atomics.store(control, controlIndex(ControlCell.buffer0Version), 1);

    expect(claimPublishedFrame(control, 1)).toBeNull();
    expect(Atomics.load(control, controlIndex(ControlCell.uploadingBuffer))).toBe(-1);
    expect(Atomics.load(control, controlIndex(ControlCell.tornFrames))).toBe(1);
  });
});

function createControl(): Int32Array {
  return new Int32Array(createControlBuffer());
}
