import { packF32FieldsWhereU8Eq, packUintFieldsWhereU8Eq } from "@exornea/zeno-buffers";

import { EntityTransformView } from "./model.view.js";

const KindCode = {
  player: 0,
  enemy: 1,
  projectile: 2,
  pickup: 3,
  effect: 4,
} as const;

const entityCount = 4096;
const buffer = new ArrayBuffer(EntityTransformView.byteLength * entityCount);
const view = new DataView(buffer);

writeEntities(view);

const visibleCount = EntityTransformView.countVisibleWhereEq(view, entityCount, true);
const firstProjectile = EntityTransformView.findFirstKindWhereEq(
  view,
  entityCount,
  KindCode.projectile,
);
const visibleQueue = new Uint32Array(visibleCount);
const transforms = new Float32Array(visibleCount * 8);
const identities = new Uint32Array(visibleCount * 3);

const packedVisible = packVisibleEntities(view, visibleQueue, transforms, identities);

console.log({
  entityCount,
  visibleCount,
  packedVisible,
  firstProjectile,
  transformFloats: transforms.length,
  identityWords: identities.length,
  visibleQueueWords: visibleQueue.length,
});

function writeEntities(target: DataView): void {
  for (let index = 0; index < entityCount; index += 1) {
    const kind = index === 0 ? KindCode.player : (index % 4) + 1;
    const angle = index * 0.01;
    const visible = index % 7 !== 0;

    EntityTransformView.setIdAt(target, index + 1, index);
    EntityTransformView.setKindAt(target, kind, index);
    EntityTransformView.setFlagsAt(target, kind === KindCode.projectile ? 0b010 : 0b001, index);
    EntityTransformView.setXAt(target, Math.cos(angle) * 64, index);
    EntityTransformView.setYAt(target, Math.sin(angle) * 64, index);
    EntityTransformView.setZAt(target, kind === KindCode.pickup ? 0.25 : 0, index);
    EntityTransformView.setQxAt(target, 0, index);
    EntityTransformView.setQyAt(target, 0, index);
    EntityTransformView.setQzAt(target, Math.sin(angle * 0.5), index);
    EntityTransformView.setQwAt(target, Math.cos(angle * 0.5), index);
    EntityTransformView.setScaleAt(target, kind === KindCode.player ? 1.25 : 1, index);
    EntityTransformView.setVisibleAt(target, visible, index);
  }
}

function packVisibleEntities(
  source: DataView,
  queue: Uint32Array,
  transformOutput: Float32Array,
  identityOutput: Uint32Array,
): number {
  let outputIndex = 0;

  for (let index = 0; index < entityCount; index += 1) {
    if (EntityTransformView.getVisibleAt(source, index)) {
      queue[outputIndex] = index;
      outputIndex += 1;
    }
  }

  const transformCount = packF32FieldsWhereU8Eq(
    source,
    entityCount,
    EntityTransformView.byteLength,
    EntityTransformView.visibleOffset,
    1,
    [
      EntityTransformView.xOffset,
      EntityTransformView.yOffset,
      EntityTransformView.zOffset,
      EntityTransformView.qxOffset,
      EntityTransformView.qyOffset,
      EntityTransformView.qzOffset,
      EntityTransformView.qwOffset,
      EntityTransformView.scaleOffset,
    ],
    transformOutput,
  );
  const identityCount = packUintFieldsWhereU8Eq(
    source,
    entityCount,
    EntityTransformView.byteLength,
    EntityTransformView.visibleOffset,
    1,
    [
      { offset: EntityTransformView.idOffset, kind: "u32" },
      { offset: EntityTransformView.kindOffset, kind: "u16" },
      { offset: EntityTransformView.flagsOffset, kind: "u32" },
    ],
    identityOutput,
  );

  if (transformCount !== outputIndex || identityCount !== outputIndex) {
    throw new Error("Visible entity pack counts diverged");
  }

  return transformCount;
}
