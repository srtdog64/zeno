import { createUintPackPlan, histogramU16Field, packUintPlan } from "@exornea/zeno-buffers";

import { DrawBatchView } from "./model.view.js";

const PassCode = {
  opaque: 0,
  alpha: 1,
  shadow: 2,
  ui: 3,
} as const;

const batchCount = 2048;
const buffer = new ArrayBuffer(DrawBatchView.byteLength * batchCount);
const view = new DataView(buffer);
const drawCommandPackPlan = createUintPackPlan(DrawBatchView.byteLength, [
  { offset: DrawBatchView.meshIdOffset, kind: "u32" },
  { offset: DrawBatchView.materialIdOffset, kind: "u32" },
  { offset: DrawBatchView.firstIndexOffset, kind: "u32" },
  { offset: DrawBatchView.indexCountOffset, kind: "u32" },
  { offset: DrawBatchView.firstInstanceOffset, kind: "u32" },
  { offset: DrawBatchView.instanceCountOffset, kind: "u32" },
]);

writeBatches(view);

const opaqueCount = DrawBatchView.countPassWhereEq(view, batchCount, PassCode.opaque);
const shadowCount = DrawBatchView.countPassWhereEq(view, batchCount, PassCode.shadow);
const firstUiBatch = DrawBatchView.findFirstPassWhereEq(view, batchCount, PassCode.ui);
const totalInstances = DrawBatchView.sumInstanceCount(view, batchCount);
const commandWords = new Uint32Array(batchCount * 6);
const passCounts = new Uint32Array(4);

const packedCommands = packDrawCommands(view, commandWords, passCounts);

console.log({
  batchCount,
  opaqueCount,
  shadowCount,
  firstUiBatch,
  totalInstances,
  packedCommands,
  passCounts: Array.from(passCounts),
  commandWords: commandWords.length,
});

function writeBatches(target: DataView): void {
  for (let index = 0; index < batchCount; index += 1) {
    const pass =
      index % 17 === 0
        ? PassCode.ui
        : index % 5 === 0
          ? PassCode.alpha
          : index % 3 === 0
            ? PassCode.shadow
            : PassCode.opaque;
    const meshId = (index * 13) % 257;
    const materialId = (index * 7) % 97;
    const instanceCount = 1 + (index % 32);

    DrawBatchView.setMeshIdAt(target, meshId, index);
    DrawBatchView.setMaterialIdAt(target, materialId, index);
    DrawBatchView.setPassAt(target, pass, index);
    DrawBatchView.setFlagsAt(target, pass === PassCode.alpha ? 0b010 : 0b001, index);
    DrawBatchView.setFirstIndexAt(target, meshId * 96, index);
    DrawBatchView.setIndexCountAt(target, 96 + (meshId % 5) * 12, index);
    DrawBatchView.setFirstInstanceAt(target, index * 32, index);
    DrawBatchView.setInstanceCountAt(target, instanceCount, index);
  }
}

function packDrawCommands(source: DataView, commands: Uint32Array, counts: Uint32Array): number {
  histogramU16Field(source, batchCount, DrawBatchView.byteLength, DrawBatchView.passOffset, counts);
  return packUintPlan(source, batchCount, drawCommandPackPlan, commands);
}
