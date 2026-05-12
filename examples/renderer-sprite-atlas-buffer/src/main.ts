import {
  createF32PackPlan,
  createUintPackPlan,
  packF32PlanWhereU8Eq,
  packUintPlanWhereU8Eq,
} from "@exornea/zeno-buffers";

import { SpriteInstanceView } from "./model.view.js";

const spriteCount = 8192;
const atlasCount = 8;
const buffer = new ArrayBuffer(SpriteInstanceView.byteLength * spriteCount);
const view = new DataView(buffer);
const positionPackPlan = createF32PackPlan(SpriteInstanceView.byteLength, [
  SpriteInstanceView.xOffset,
  SpriteInstanceView.yOffset,
  SpriteInstanceView.zOffset,
]);
const uvPackPlan = createF32PackPlan(SpriteInstanceView.byteLength, [
  SpriteInstanceView.u0Offset,
  SpriteInstanceView.v0Offset,
  SpriteInstanceView.u1Offset,
  SpriteInstanceView.v1Offset,
]);
const colorPackPlan = createUintPackPlan(SpriteInstanceView.byteLength, [
  { offset: SpriteInstanceView.colorOffset, kind: "u32" },
]);

writeSprites(view);

const visibleCount = SpriteInstanceView.countVisibleWhereEq(view, spriteCount, true);
const firstAtlasThree = SpriteInstanceView.findFirstAtlasIdWhereEq(view, spriteCount, 3);
const positions = new Float32Array(visibleCount * 3);
const uvs = new Float32Array(visibleCount * 4);
const colors = new Uint32Array(visibleCount);
const atlasCounts = new Uint32Array(atlasCount);

countVisibleByAtlas(view, atlasCounts);
const packedSprites = packVisibleSprites(view, positions, uvs, colors);

console.log({
  spriteCount,
  visibleCount,
  packedSprites,
  firstAtlasThree,
  atlasCounts: Array.from(atlasCounts),
  positionFloats: positions.length,
  uvFloats: uvs.length,
  colorWords: colors.length,
});

function writeSprites(target: DataView): void {
  for (let index = 0; index < spriteCount; index += 1) {
    const atlasId = index % atlasCount;
    const tileId = (index * 17) % 1024;
    const x = index % 128;
    const y = Math.floor(index / 128);
    const u = (tileId % 32) / 32;
    const v = Math.floor(tileId / 32) / 32;
    const visible = index % 11 !== 0;

    SpriteInstanceView.setAtlasIdAt(target, atlasId, index);
    SpriteInstanceView.setTileIdAt(target, tileId, index);
    SpriteInstanceView.setFlagsAt(target, visible ? 0b001 : 0, index);
    SpriteInstanceView.setXAt(target, x, index);
    SpriteInstanceView.setYAt(target, y, index);
    SpriteInstanceView.setZAt(target, atlasId * 0.01, index);
    SpriteInstanceView.setU0At(target, u, index);
    SpriteInstanceView.setV0At(target, v, index);
    SpriteInstanceView.setU1At(target, u + 1 / 32, index);
    SpriteInstanceView.setV1At(target, v + 1 / 32, index);
    SpriteInstanceView.setColorAt(target, 0xff000000 | ((tileId * 2654435761) >>> 8), index);
    SpriteInstanceView.setVisibleAt(target, visible, index);
  }
}

function countVisibleByAtlas(source: DataView, output: Uint32Array): void {
  for (let index = 0; index < spriteCount; index += 1) {
    if (!SpriteInstanceView.getVisibleAt(source, index)) {
      continue;
    }

    const atlasId = SpriteInstanceView.getAtlasIdAt(source, index);
    output[atlasId] = (output[atlasId] ?? 0) + 1;
  }
}

function packVisibleSprites(
  source: DataView,
  positionOutput: Float32Array,
  uvOutput: Float32Array,
  colorOutput: Uint32Array,
): number {
  const positionCount = packF32PlanWhereU8Eq(
    source,
    spriteCount,
    SpriteInstanceView.visibleOffset,
    1,
    positionPackPlan,
    positionOutput,
  );
  const uvCount = packF32PlanWhereU8Eq(
    source,
    spriteCount,
    SpriteInstanceView.visibleOffset,
    1,
    uvPackPlan,
    uvOutput,
  );
  const colorCount = packUintPlanWhereU8Eq(
    source,
    spriteCount,
    SpriteInstanceView.visibleOffset,
    1,
    colorPackPlan,
    colorOutput,
  );

  if (positionCount !== uvCount || positionCount !== colorCount) {
    throw new Error("Visible sprite pack counts diverged");
  }

  return positionCount;
}
