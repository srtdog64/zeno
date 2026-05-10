import { DirtyRangeView, DungeonCellView, VisibleEntityView } from "./model.view.js";

const width = 80;
const height = 45;
const cellCount = width * height;
const entityCount = 512;
const dirtyRangeCount = 12;

const cellBuffer = new ArrayBuffer(DungeonCellView.byteLength * cellCount);
const entityBuffer = new ArrayBuffer(VisibleEntityView.byteLength * entityCount);
const dirtyRangeBuffer = new ArrayBuffer(DirtyRangeView.byteLength * dirtyRangeCount);

const cellView = new DataView(cellBuffer);
const entityView = new DataView(entityBuffer);
const dirtyRangeView = new DataView(dirtyRangeBuffer);

writeDungeonCells(cellView);
writeVisibleEntities(entityView);
writeDirtyRanges(dirtyRangeView);

const visibleCellCount = DungeonCellView.countSeenWhereEq(cellView, cellCount, true);
const firstLitCell = DungeonCellView.findFirstLightWhereEq(cellView, cellCount, 8);
const totalLight = DungeonCellView.sumLight(cellView, cellCount);
const cellPositions = new Float32Array(visibleCellCount * 2);
const cellColors = new Float32Array(visibleCellCount * 4);
const entityTransforms = new Float32Array(entityCount * 4);
const dirtyUploads = new Uint32Array(dirtyRangeCount * 2);

const packedCells = packVisibleCells(cellView, cellPositions, cellColors);
packVisibleEntities(entityView, entityTransforms);
packDirtyRanges(dirtyRangeView, dirtyUploads);

console.log({
  grid: `${width}x${height}`,
  cellCount,
  visibleCellCount,
  packedCells,
  firstLitCell,
  averageLight: totalLight / cellCount,
  entityCount,
  dirtyRangeCount,
  cellPositionFloats: cellPositions.length,
  entityTransformFloats: entityTransforms.length,
  dirtyUploadWords: dirtyUploads.length,
});

function writeDungeonCells(view: DataView): void {
  for (let index = 0; index < cellCount; index += 1) {
    const x = index % width;
    const y = Math.floor(index / width);
    const wall = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const room = x > 8 && x < 30 && y > 6 && y < 20;
    const corridor = y === 24 || x === 42;
    const seen = room || corridor || wall;
    const light = room ? 8 : corridor ? 5 : wall ? 2 : 0;
    const tileId = wall ? 1 : room ? 2 : corridor ? 3 : 0;
    const glyphId = seen ? 100 + tileId : 0;
    const flags = (wall ? 0b001 : 0) | (room ? 0b010 : 0) | (corridor ? 0b100 : 0);

    DungeonCellView.setTileIdAt(view, tileId, index);
    DungeonCellView.setGlyphIdAt(view, glyphId, index);
    DungeonCellView.setFlagsAt(view, flags, index);
    DungeonCellView.setLightAt(view, light, index);
    DungeonCellView.setSeenAt(view, seen, index);
  }
}

function writeVisibleEntities(view: DataView): void {
  for (let index = 0; index < entityCount; index += 1) {
    const kind = index === 0 ? 0 : (index % 3) + 1;
    const x = 4 + ((index * 7) % (width - 8));
    const y = 4 + ((index * 13) % (height - 8));
    const z = kind === 2 ? 0.15 : 0;
    const glyphId = 200 + kind;
    const flags = kind === 1 ? 0b001 : kind === 2 ? 0b010 : 0b100;

    VisibleEntityView.setIdAt(view, index + 1, index);
    VisibleEntityView.setKindAt(view, kind, index);
    VisibleEntityView.setXAt(view, x, index);
    VisibleEntityView.setYAt(view, y, index);
    VisibleEntityView.setZAt(view, z, index);
    VisibleEntityView.setGlyphIdAt(view, glyphId, index);
    VisibleEntityView.setFlagsAt(view, flags, index);
  }
}

function writeDirtyRanges(view: DataView): void {
  for (let index = 0; index < dirtyRangeCount; index += 1) {
    const start = index * Math.floor(cellCount / dirtyRangeCount);
    const count = index % 2 === 0 ? 96 : 32;

    DirtyRangeView.setStartAt(view, start, index);
    DirtyRangeView.setCountAt(view, count, index);
  }
}

function packVisibleCells(view: DataView, positions: Float32Array, colors: Float32Array): number {
  let outputIndex = 0;

  for (let index = 0; index < cellCount; index += 1) {
    if (!DungeonCellView.getSeenAt(view, index)) {
      continue;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    const light = DungeonCellView.getLightAt(view, index) / 8;
    const tileId = DungeonCellView.getTileIdAt(view, index);

    positions[outputIndex * 2] = x;
    positions[outputIndex * 2 + 1] = y;
    colors[outputIndex * 4] = tileId === 1 ? 0.35 : 0.1;
    colors[outputIndex * 4 + 1] = tileId === 2 ? 0.65 : 0.2;
    colors[outputIndex * 4 + 2] = tileId === 3 ? 0.75 : 0.25;
    colors[outputIndex * 4 + 3] = light;
    outputIndex += 1;
  }

  return outputIndex;
}

function packVisibleEntities(view: DataView, transforms: Float32Array): void {
  for (let index = 0; index < entityCount; index += 1) {
    const out = index * 4;

    transforms[out] = VisibleEntityView.getXAt(view, index);
    transforms[out + 1] = VisibleEntityView.getYAt(view, index);
    transforms[out + 2] = VisibleEntityView.getZAt(view, index);
    transforms[out + 3] = VisibleEntityView.getKindAt(view, index) === 0 ? 1.3 : 1;
  }
}

function packDirtyRanges(view: DataView, ranges: Uint32Array): void {
  for (let index = 0; index < dirtyRangeCount; index += 1) {
    ranges[index * 2] = DirtyRangeView.getStartAt(view, index);
    ranges[index * 2 + 1] = DirtyRangeView.getCountAt(view, index);
  }
}
