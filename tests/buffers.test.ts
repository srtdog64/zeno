import { describe, expect, it } from "vitest";

import {
  createF32PackPlan,
  createUintPackPlan,
  histogramU16Field,
  histogramU8Field,
  packF32FieldsWhereU8Eq,
  packF32PlanWhereU8Eq,
  packUintFields,
  packUintFieldsWhereU16Eq,
  packUintFieldsWhereU8Eq,
  packUintPlan,
  packUintPlanWhereU8Eq,
} from "../packages/buffers/src/index.js";

const STRIDE = 24;
const OFFSET_KIND = 0;
const OFFSET_VISIBLE = 2;
const OFFSET_ID = 4;
const OFFSET_FLAGS = 8;
const OFFSET_X = 12;
const OFFSET_Y = 16;
const OFFSET_Z = 20;

describe("zeno-buffers", () => {
  it("counts u8 and u16 fields into caller-owned buckets", () => {
    const view = sampleRows();
    const kindCounts = new Uint32Array(4);
    const visibleCounts = new Uint32Array(2);

    histogramU16Field(view, 4, STRIDE, OFFSET_KIND, kindCounts);
    histogramU8Field(view, 4, STRIDE, OFFSET_VISIBLE, visibleCounts);

    expect(Array.from(kindCounts)).toEqual([0, 2, 1, 1]);
    expect(Array.from(visibleCounts)).toEqual([1, 3]);
  });

  it("packs f32 fields matching a u8 predicate", () => {
    const view = sampleRows();
    const out = new Float32Array(9);
    const packed = packF32FieldsWhereU8Eq(
      view,
      4,
      STRIDE,
      OFFSET_VISIBLE,
      1,
      [OFFSET_X, OFFSET_Y, OFFSET_Z],
      out,
    );

    expect(packed).toBe(3);
    expect(Array.from(out)).toEqual([1, 2, 3, 7, 8, 9, 10, 11, 12]);
  });

  it("reuses f32 pack plans across frame loops", () => {
    const view = sampleRows();
    const out = new Float32Array(9);
    const plan = createF32PackPlan(STRIDE, [OFFSET_X, OFFSET_Y, OFFSET_Z]);
    const packed = packF32PlanWhereU8Eq(view, 4, OFFSET_VISIBLE, 1, plan, out);

    expect(plan.fieldCount).toBe(3);
    expect(plan.maxFieldEnd).toBe(24);
    expect(packed).toBe(3);
    expect(Array.from(out)).toEqual([1, 2, 3, 7, 8, 9, 10, 11, 12]);
  });

  it("packs mixed-width uint fields matching u8 and u16 predicates", () => {
    const view = sampleRows();
    const visibleOut = new Uint32Array(9);
    const kindOut = new Uint32Array(4);

    const visiblePacked = packUintFieldsWhereU8Eq(
      view,
      4,
      STRIDE,
      OFFSET_VISIBLE,
      1,
      [
        { offset: OFFSET_ID, kind: "u32" },
        { offset: OFFSET_KIND, kind: "u16" },
        { offset: OFFSET_FLAGS, kind: "u32" },
      ],
      visibleOut,
    );
    const kindPacked = packUintFieldsWhereU16Eq(
      view,
      4,
      STRIDE,
      OFFSET_KIND,
      1,
      [
        { offset: OFFSET_ID, kind: "u32" },
        { offset: OFFSET_FLAGS, kind: "u32" },
      ],
      kindOut,
    );

    expect(visiblePacked).toBe(3);
    expect(Array.from(visibleOut)).toEqual([101, 1, 1, 103, 3, 4, 104, 1, 8]);
    expect(kindPacked).toBe(2);
    expect(Array.from(kindOut)).toEqual([101, 1, 104, 8]);
  });

  it("packs all rows into command words", () => {
    const view = sampleRows();
    const out = new Uint32Array(8);
    const packed = packUintFields(
      view,
      4,
      STRIDE,
      [
        { offset: OFFSET_ID, kind: "u32" },
        { offset: OFFSET_FLAGS, kind: "u32" },
      ],
      out,
    );

    expect(packed).toBe(4);
    expect(Array.from(out)).toEqual([101, 1, 102, 2, 103, 4, 104, 8]);
  });

  it("reuses uint pack plans for filtered and unfiltered command words", () => {
    const view = sampleRows();
    const allOut = new Uint32Array(8);
    const visibleOut = new Uint32Array(6);
    const plan = createUintPackPlan(STRIDE, [
      { offset: OFFSET_ID, kind: "u32" },
      { offset: OFFSET_FLAGS, kind: "u32" },
    ]);

    expect(packUintPlan(view, 4, plan, allOut)).toBe(4);
    expect(packUintPlanWhereU8Eq(view, 4, OFFSET_VISIBLE, 1, plan, visibleOut)).toBe(3);
    expect(Array.from(allOut)).toEqual([101, 1, 102, 2, 103, 4, 104, 8]);
    expect(Array.from(visibleOut)).toEqual([101, 1, 103, 4, 104, 8]);
  });

  it("fails closed on short outputs, missing ranges, and invalid buckets", () => {
    const view = sampleRows();

    expect(() =>
      packF32FieldsWhereU8Eq(
        view,
        4,
        STRIDE,
        OFFSET_VISIBLE,
        1,
        [OFFSET_X, OFFSET_Y],
        new Float32Array(1),
      ),
    ).toThrow(RangeError);
    expect(() => histogramU16Field(view, 4, STRIDE, OFFSET_KIND, new Uint32Array(2))).toThrow(
      RangeError,
    );
    expect(() =>
      packUintFields(view, 5, STRIDE, [{ offset: OFFSET_ID, kind: "u32" }], new Uint32Array(5)),
    ).toThrow(RangeError);
    expect(() => createF32PackPlan(STRIDE, [Number.MAX_SAFE_INTEGER])).toThrow(RangeError);
    expect(() => createUintPackPlan(STRIDE, [{ offset: OFFSET_Z + 1, kind: "u32" }])).toThrow(
      RangeError,
    );
  });
});

function sampleRows(): DataView {
  const buffer = new ArrayBuffer(STRIDE * 4);
  const view = new DataView(buffer);

  writeRow(view, 0, 1, true, 101, 1, 1, 2, 3);
  writeRow(view, 1, 2, false, 102, 2, 4, 5, 6);
  writeRow(view, 2, 3, true, 103, 4, 7, 8, 9);
  writeRow(view, 3, 1, true, 104, 8, 10, 11, 12);

  return view;
}

function writeRow(
  view: DataView,
  index: number,
  kind: number,
  visible: boolean,
  id: number,
  flags: number,
  x: number,
  y: number,
  z: number,
): void {
  const offset = index * STRIDE;

  view.setUint16(offset + OFFSET_KIND, kind, true);
  view.setUint8(offset + OFFSET_VISIBLE, visible ? 1 : 0);
  view.setUint32(offset + OFFSET_ID, id, true);
  view.setUint32(offset + OFFSET_FLAGS, flags, true);
  view.setFloat32(offset + OFFSET_X, x, true);
  view.setFloat32(offset + OFFSET_Y, y, true);
  view.setFloat32(offset + OFFSET_Z, z, true);
}
