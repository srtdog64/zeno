import { describe, expect, it } from "vitest";

import {
  createF32PackPlan,
  createUintPackPlan,
  packF32PlanWhereU16Eq,
  packUintPlan,
  packUintPlanWhereU16Eq,
} from "../packages/buffers/src/index.js";

const VERTEX_COUNT = 250_000;
const VERTEX_STRIDE = 48;
const OFFSET_MESH_ID = 0;
const OFFSET_MATERIAL_ID = 2;
const OFFSET_FLAGS = 4;
const OFFSET_X = 8;
const OFFSET_Y = 12;
const OFFSET_Z = 16;
const OFFSET_NX = 20;
const OFFSET_NY = 24;
const OFFSET_NZ = 28;
const OFFSET_U = 32;
const OFFSET_V = 36;
const OFFSET_COLOR = 40;

const DRAW_BATCH_COUNT = 100_000;
const DRAW_BATCH_STRIDE = 32;
const OFFSET_DRAW_MESH_ID = 0;
const OFFSET_DRAW_MATERIAL_ID = 4;
const OFFSET_DRAW_FIRST_INDEX = 8;
const OFFSET_DRAW_INDEX_COUNT = 12;
const OFFSET_DRAW_FIRST_INSTANCE = 16;
const OFFSET_DRAW_INSTANCE_COUNT = 20;
const OFFSET_DRAW_FLAGS = 24;

describe("renderer mesh buffer stress", () => {
  it("packs large mesh vertex rows into GPU-facing float and uint arrays", () => {
    const view = createVertexRows();
    const meshId = 7;
    const selectedCount = Math.floor((VERTEX_COUNT + 8) / 16);
    const floatPlan = createF32PackPlan(VERTEX_STRIDE, [
      OFFSET_X,
      OFFSET_Y,
      OFFSET_Z,
      OFFSET_NX,
      OFFSET_NY,
      OFFSET_NZ,
      OFFSET_U,
      OFFSET_V,
    ]);
    const uintPlan = createUintPackPlan(VERTEX_STRIDE, [
      { offset: OFFSET_MATERIAL_ID, kind: "u16" },
      { offset: OFFSET_FLAGS, kind: "u32" },
      { offset: OFFSET_COLOR, kind: "u32" },
    ]);
    const floats = new Float32Array(selectedCount * floatPlan.fieldCount);
    const words = new Uint32Array(selectedCount * uintPlan.fieldCount);

    const packedFloats = packF32PlanWhereU16Eq(
      view,
      VERTEX_COUNT,
      OFFSET_MESH_ID,
      meshId,
      floatPlan,
      floats,
    );
    const packedWords = packUintPlanWhereU16Eq(
      view,
      VERTEX_COUNT,
      OFFSET_MESH_ID,
      meshId,
      uintPlan,
      words,
    );

    expect(packedFloats).toBe(selectedCount);
    expect(packedWords).toBe(selectedCount);
    expect(Array.from(floats.slice(0, 8))).toEqual([7, 3.5, 1.75, 0, 1, 0, 0.875, 0.4375]);
    expect(Array.from(words.slice(0, 3))).toEqual([3, 7, 0xff000007]);

    const lastSourceIndex = 249_991;
    const lastFloatOffset = (selectedCount - 1) * floatPlan.fieldCount;
    const lastWordOffset = (selectedCount - 1) * uintPlan.fieldCount;

    expect(Array.from(floats.slice(lastFloatOffset, lastFloatOffset + 3))).toEqual([
      lastSourceIndex,
      lastSourceIndex * 0.5,
      lastSourceIndex * 0.25,
    ]);
    expect(Array.from(words.slice(lastWordOffset, lastWordOffset + 3))).toEqual([
      lastSourceIndex % 4,
      lastSourceIndex & 0xff,
      (0xff000000 | (lastSourceIndex & 0xffffff)) >>> 0,
    ]);
  });

  it("packs large draw-batch rows into command words", () => {
    const view = createDrawBatchRows();
    const commandPlan = createUintPackPlan(DRAW_BATCH_STRIDE, [
      { offset: OFFSET_DRAW_MESH_ID, kind: "u32" },
      { offset: OFFSET_DRAW_MATERIAL_ID, kind: "u32" },
      { offset: OFFSET_DRAW_FIRST_INDEX, kind: "u32" },
      { offset: OFFSET_DRAW_INDEX_COUNT, kind: "u32" },
      { offset: OFFSET_DRAW_FIRST_INSTANCE, kind: "u32" },
      { offset: OFFSET_DRAW_INSTANCE_COUNT, kind: "u32" },
      { offset: OFFSET_DRAW_FLAGS, kind: "u32" },
    ]);
    const allCommands = new Uint32Array(DRAW_BATCH_COUNT * commandPlan.fieldCount);
    const shadowCommands = new Uint32Array(
      Math.ceil(DRAW_BATCH_COUNT / 4) * commandPlan.fieldCount,
    );

    expect(packUintPlan(view, DRAW_BATCH_COUNT, commandPlan, allCommands)).toBe(DRAW_BATCH_COUNT);
    expect(
      packUintPlanWhereU16Eq(
        view,
        DRAW_BATCH_COUNT,
        OFFSET_DRAW_MATERIAL_ID,
        2,
        commandPlan,
        shadowCommands,
      ),
    ).toBe(25_000);

    expect(Array.from(allCommands.slice(0, 7))).toEqual([0, 0, 0, 36, 0, 1, 0]);
    expect(Array.from(shadowCommands.slice(0, 7))).toEqual([2, 2, 72, 36, 2, 3, 2]);

    const lastOffset = (DRAW_BATCH_COUNT - 1) * commandPlan.fieldCount;
    expect(Array.from(allCommands.slice(lastOffset, lastOffset + 7))).toEqual([
      99999 % 512,
      99999 % 4,
      99999 * 36,
      36,
      99999,
      (99999 % 8) + 1,
      99999 & 0xff,
    ]);
  });
});

function createVertexRows(): DataView {
  const buffer = new ArrayBuffer(VERTEX_COUNT * VERTEX_STRIDE);
  const view = new DataView(buffer);

  for (let index = 0; index < VERTEX_COUNT; index += 1) {
    const offset = index * VERTEX_STRIDE;
    view.setUint16(offset + OFFSET_MESH_ID, index % 16, true);
    view.setUint16(offset + OFFSET_MATERIAL_ID, index % 4, true);
    view.setUint32(offset + OFFSET_FLAGS, index & 0xff, true);
    view.setFloat32(offset + OFFSET_X, index, true);
    view.setFloat32(offset + OFFSET_Y, index * 0.5, true);
    view.setFloat32(offset + OFFSET_Z, index * 0.25, true);
    view.setFloat32(offset + OFFSET_NX, 0, true);
    view.setFloat32(offset + OFFSET_NY, 1, true);
    view.setFloat32(offset + OFFSET_NZ, 0, true);
    view.setFloat32(offset + OFFSET_U, (index % 8) / 8, true);
    view.setFloat32(offset + OFFSET_V, (index % 16) / 16, true);
    view.setUint32(offset + OFFSET_COLOR, 0xff000000 | (index & 0xffffff), true);
  }

  return view;
}

function createDrawBatchRows(): DataView {
  const buffer = new ArrayBuffer(DRAW_BATCH_COUNT * DRAW_BATCH_STRIDE);
  const view = new DataView(buffer);

  for (let index = 0; index < DRAW_BATCH_COUNT; index += 1) {
    const offset = index * DRAW_BATCH_STRIDE;
    view.setUint32(offset + OFFSET_DRAW_MESH_ID, index % 512, true);
    view.setUint32(offset + OFFSET_DRAW_MATERIAL_ID, index % 4, true);
    view.setUint32(offset + OFFSET_DRAW_FIRST_INDEX, index * 36, true);
    view.setUint32(offset + OFFSET_DRAW_INDEX_COUNT, 36, true);
    view.setUint32(offset + OFFSET_DRAW_FIRST_INSTANCE, index, true);
    view.setUint32(offset + OFFSET_DRAW_INSTANCE_COUNT, (index % 8) + 1, true);
    view.setUint32(offset + OFFSET_DRAW_FLAGS, index & 0xff, true);
  }

  return view;
}
