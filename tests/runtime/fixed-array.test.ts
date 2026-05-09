import { describe, expect, it } from "vitest";

import {
  FixedBytesArrayView,
  FixedScalarArrayView,
  FixedStringArrayView,
  FixedStructArrayView,
  ProjectionView,
} from "../../packages/runtime/src/index.js";

class PointView extends ProjectionView {
  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  get x(): number {
    return this.view.getFloat32(this.baseOffset, this.littleEndian);
  }
}

describe("fixed inline array views", () => {
  it("reads and writes scalar fixed arrays", () => {
    const view = new DataView(new ArrayBuffer(16));
    const values = new FixedScalarArrayView<number>(view, 4, 3, "i32");

    values.set(0, 10);
    values.set(1, 20);
    values.set(2, 30);

    expect(values.length).toBe(3);
    expect(values.toArray()).toEqual([10, 20, 30]);
    expect(() => values.at(3)).toThrow(RangeError);
  });

  it("reads and writes fixed byte and string arrays", () => {
    const view = new DataView(new ArrayBuffer(16));
    const bytes = new FixedBytesArrayView(view, 0, 2, 4);
    const labels = new FixedStringArrayView(view, 8, 2, 4, 0, true, "ascii");

    bytes.set(0, new Uint8Array([1, 2]));
    bytes.set(1, new Uint8Array([3, 4, 5, 6]));
    labels.setText(0, "ab");
    labels.setText(1, "cd");

    expect(Array.from(bytes.bytesAt(0))).toEqual([1, 2, 0, 0]);
    expect(Array.from(bytes.bytesAt(1))).toEqual([3, 4, 5, 6]);
    expect(labels.textAt(0).replace(/\0+$/, "")).toBe("ab");
    expect(labels.textAt(1).replace(/\0+$/, "")).toBe("cd");
  });

  it("projects fixed struct arrays without descriptors", () => {
    const view = new DataView(new ArrayBuffer(16));
    view.setFloat32(0, 1.5, true);
    view.setFloat32(8, 2.5, true);

    const points = new FixedStructArrayView(
      view,
      0,
      2,
      8,
      (nestedView, baseOffset, littleEndian) =>
        new PointView(nestedView, baseOffset, littleEndian),
    );

    expect(points.at(0).x).toBe(1.5);
    expect(points.at(1).x).toBe(2.5);
  });
});
