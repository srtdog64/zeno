import { performance } from "node:perf_hooks";

import {
  createF32PackPlan,
  createUintPackPlan,
  packF32PlanWhereU16Eq,
  packUintPlan,
  packUintPlanWhereU16Eq,
} from "../../packages/buffers/dist/index.js";

const VERTEX_COUNT = Number(process.env.ZENO_RENDERER_MESH_BENCH_RECORDS ?? 250_000);
const DRAW_BATCH_COUNT = Number(process.env.ZENO_RENDERER_MESH_BENCH_DRAWS ?? 100_000);
const WARMUP_RUNS = Number(process.env.ZENO_RENDERER_MESH_BENCH_WARMUP ?? 3);
const MEASURE_RUNS = Number(process.env.ZENO_RENDERER_MESH_BENCH_RUNS ?? 25);

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

const DRAW_BATCH_STRIDE = 32;
const OFFSET_DRAW_MESH_ID = 0;
const OFFSET_DRAW_MATERIAL_ID = 4;
const OFFSET_DRAW_FIRST_INDEX = 8;
const OFFSET_DRAW_INDEX_COUNT = 12;
const OFFSET_DRAW_FIRST_INSTANCE = 16;
const OFFSET_DRAW_INSTANCE_COUNT = 20;
const OFFSET_DRAW_FLAGS = 24;

const TARGET_MESH_ID = 7;
const TARGET_MATERIAL_ID = 2;

if (typeof globalThis.gc !== "function") {
  console.error("Run with --expose-gc so retained memory measurements are meaningful.");
  process.exit(1);
}

const vertexFloatPlan = createF32PackPlan(VERTEX_STRIDE, [
  OFFSET_X,
  OFFSET_Y,
  OFFSET_Z,
  OFFSET_NX,
  OFFSET_NY,
  OFFSET_NZ,
  OFFSET_U,
  OFFSET_V,
]);
const vertexUintPlan = createUintPackPlan(VERTEX_STRIDE, [
  { offset: OFFSET_MATERIAL_ID, kind: "u16" },
  { offset: OFFSET_FLAGS, kind: "u32" },
  { offset: OFFSET_COLOR, kind: "u32" },
]);
const drawCommandPlan = createUintPackPlan(DRAW_BATCH_STRIDE, [
  { offset: OFFSET_DRAW_MESH_ID, kind: "u32" },
  { offset: OFFSET_DRAW_MATERIAL_ID, kind: "u32" },
  { offset: OFFSET_DRAW_FIRST_INDEX, kind: "u32" },
  { offset: OFFSET_DRAW_INDEX_COUNT, kind: "u32" },
  { offset: OFFSET_DRAW_FIRST_INSTANCE, kind: "u32" },
  { offset: OFFSET_DRAW_INSTANCE_COUNT, kind: "u32" },
  { offset: OFFSET_DRAW_FLAGS, kind: "u32" },
]);

forceGc();
const baseMemory = process.memoryUsage();
const tsVertices = createTsVertexRows(VERTEX_COUNT);
const tsDrawBatches = createTsDrawBatchRows(DRAW_BATCH_COUNT);
forceGc();
const afterTsMemory = process.memoryUsage();
const binaryVertexView = createBinaryVertexRows(VERTEX_COUNT);
const binaryDrawBatchView = createBinaryDrawBatchRows(DRAW_BATCH_COUNT);
forceGc();
const afterBinaryMemory = process.memoryUsage();

console.log("Zeno renderer mesh TS-object comparison benchmark");
console.log(`vertex rows: ${VERTEX_COUNT.toLocaleString("en-US")}`);
console.log(`draw batches: ${DRAW_BATCH_COUNT.toLocaleString("en-US")}`);
console.log(`selected mesh id: ${TARGET_MESH_ID}`);
console.log(`selected material id: ${TARGET_MATERIAL_ID}`);
console.log(`warmup runs: ${WARMUP_RUNS}`);
console.log(`measured runs: ${MEASURE_RUNS}`);
console.log("");
console.log("Fixture retained memory");
console.log(`  TS object rows: ${formatMemoryDelta(baseMemory, afterTsMemory)}`);
console.log(`  binary buffers: ${formatMemoryDelta(afterTsMemory, afterBinaryMemory)}`);
console.log(`  binary vertex payload: ${formatBytes(binaryVertexView.byteLength)}`);
console.log(`  binary draw payload: ${formatBytes(binaryDrawBatchView.byteLength)}`);
console.log("");

const tsVertexPack = measure("TS object mesh vertex pack", VERTEX_COUNT, () =>
  packTsMeshVertices(tsVertices, TARGET_MESH_ID),
);
const binaryFusedVertexPack = measure("Handwritten binary mesh vertex pack", VERTEX_COUNT, () =>
  packBinaryMeshVerticesFused(binaryVertexView, VERTEX_COUNT, TARGET_MESH_ID),
);
const zenoVertexPack = measure("Zeno buffers planned mesh vertex pack", VERTEX_COUNT, () =>
  packBinaryMeshVertices(binaryVertexView, VERTEX_COUNT, TARGET_MESH_ID),
);
const tsDrawPack = measure("TS object draw command pack", DRAW_BATCH_COUNT, () =>
  packTsDrawCommands(tsDrawBatches),
);
const binaryFusedDrawPack = measure("Handwritten binary draw command pack", DRAW_BATCH_COUNT, () =>
  packBinaryDrawCommandsFused(binaryDrawBatchView, DRAW_BATCH_COUNT),
);
const zenoDrawPack = measure("Zeno buffers planned draw command pack", DRAW_BATCH_COUNT, () =>
  packBinaryDrawCommands(binaryDrawBatchView, DRAW_BATCH_COUNT),
);
const tsMaterialPack = measure("TS object draw command pack where material", DRAW_BATCH_COUNT, () =>
  packTsDrawCommandsWhereMaterial(tsDrawBatches, TARGET_MATERIAL_ID),
);
const binaryFusedMaterialPack = measure(
  "Handwritten binary draw command pack where material",
  DRAW_BATCH_COUNT,
  () =>
    packBinaryDrawCommandsWhereMaterialFused(
      binaryDrawBatchView,
      DRAW_BATCH_COUNT,
      TARGET_MATERIAL_ID,
    ),
);
const zenoMaterialPack = measure(
  "Zeno buffers planned draw command pack where material",
  DRAW_BATCH_COUNT,
  () =>
    packBinaryDrawCommandsWhereMaterial(binaryDrawBatchView, DRAW_BATCH_COUNT, TARGET_MATERIAL_ID),
);

assertSameChecksum("mesh vertex pack", tsVertexPack.checksum, zenoVertexPack.checksum);
assertSameChecksum(
  "handwritten mesh vertex pack",
  tsVertexPack.checksum,
  binaryFusedVertexPack.checksum,
);
assertSameChecksum("draw command pack", tsDrawPack.checksum, zenoDrawPack.checksum);
assertSameChecksum(
  "handwritten draw command pack",
  tsDrawPack.checksum,
  binaryFusedDrawPack.checksum,
);
assertSameChecksum(
  "material-filtered draw command pack",
  tsMaterialPack.checksum,
  zenoMaterialPack.checksum,
);
assertSameChecksum(
  "handwritten material-filtered draw command pack",
  tsMaterialPack.checksum,
  binaryFusedMaterialPack.checksum,
);

console.log("");
console.log("Deltas vs TS object loops");
compareToBaseline(
  "Handwritten binary mesh vertex pack",
  tsVertexPack.stats,
  binaryFusedVertexPack.stats,
);
compareToBaseline(
  "Zeno buffers planned mesh vertex pack",
  tsVertexPack.stats,
  zenoVertexPack.stats,
);
compareToBaseline(
  "Handwritten binary draw command pack",
  tsDrawPack.stats,
  binaryFusedDrawPack.stats,
);
compareToBaseline("Zeno buffers planned draw command pack", tsDrawPack.stats, zenoDrawPack.stats);
compareToBaseline(
  "Handwritten binary material-filtered draw command pack",
  tsMaterialPack.stats,
  binaryFusedMaterialPack.stats,
);
compareToBaseline(
  "Zeno buffers planned material-filtered draw command pack",
  tsMaterialPack.stats,
  zenoMaterialPack.stats,
);

console.log("");
console.log(
  "Methodological note: this compares plain TypeScript object rows against fixed-stride DataView rows with @exornea/zeno-buffers pack plans. It measures renderer-facing packing work, not full game simulation or GPU upload time.",
);

function createTsVertexRows(count) {
  const rows = new Array(count);

  for (let index = 0; index < count; index += 1) {
    rows[index] = {
      meshId: index % 16,
      materialId: index % 4,
      flags: index & 0xff,
      x: Math.fround(index),
      y: Math.fround(index * 0.5),
      z: Math.fround(index * 0.25),
      nx: 0,
      ny: 1,
      nz: 0,
      u: Math.fround((index % 8) / 8),
      v: Math.fround((index % 16) / 16),
      color: (0xff000000 | (index & 0xffffff)) >>> 0,
    };
  }

  return rows;
}

function createBinaryVertexRows(count) {
  const buffer = new ArrayBuffer(count * VERTEX_STRIDE);
  const view = new DataView(buffer);

  for (let index = 0; index < count; index += 1) {
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

function createTsDrawBatchRows(count) {
  const rows = new Array(count);

  for (let index = 0; index < count; index += 1) {
    rows[index] = {
      meshId: index % 512,
      materialId: index % 4,
      firstIndex: index * 36,
      indexCount: 36,
      firstInstance: index,
      instanceCount: (index % 8) + 1,
      flags: index & 0xff,
    };
  }

  return rows;
}

function createBinaryDrawBatchRows(count) {
  const buffer = new ArrayBuffer(count * DRAW_BATCH_STRIDE);
  const view = new DataView(buffer);

  for (let index = 0; index < count; index += 1) {
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

function packTsMeshVertices(rows, meshId) {
  const selectedCount = countSelectedMeshRows(rows.length, meshId);
  const floats = new Float32Array(selectedCount * vertexFloatPlan.fieldCount);
  const words = new Uint32Array(selectedCount * vertexUintPlan.fieldCount);
  let packed = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    if (row.meshId !== meshId) {
      continue;
    }

    const floatOut = packed * vertexFloatPlan.fieldCount;
    floats[floatOut] = row.x;
    floats[floatOut + 1] = row.y;
    floats[floatOut + 2] = row.z;
    floats[floatOut + 3] = row.nx;
    floats[floatOut + 4] = row.ny;
    floats[floatOut + 5] = row.nz;
    floats[floatOut + 6] = row.u;
    floats[floatOut + 7] = row.v;

    const wordOut = packed * vertexUintPlan.fieldCount;
    words[wordOut] = row.materialId;
    words[wordOut + 1] = row.flags;
    words[wordOut + 2] = row.color;
    packed += 1;
  }

  return checksumPackedVertex(packed, floats, words);
}

function packBinaryMeshVertices(view, count, meshId) {
  const selectedCount = countSelectedMeshRows(count, meshId);
  const floats = new Float32Array(selectedCount * vertexFloatPlan.fieldCount);
  const words = new Uint32Array(selectedCount * vertexUintPlan.fieldCount);

  const floatCount = packF32PlanWhereU16Eq(
    view,
    count,
    OFFSET_MESH_ID,
    meshId,
    vertexFloatPlan,
    floats,
  );
  const wordCount = packUintPlanWhereU16Eq(
    view,
    count,
    OFFSET_MESH_ID,
    meshId,
    vertexUintPlan,
    words,
  );

  if (floatCount !== wordCount) {
    throw new Error(`Packed float/word count mismatch: ${floatCount} !== ${wordCount}`);
  }

  return checksumPackedVertex(floatCount, floats, words);
}

function packBinaryMeshVerticesFused(view, count, meshId) {
  const selectedCount = countSelectedMeshRows(count, meshId);
  const floats = new Float32Array(selectedCount * vertexFloatPlan.fieldCount);
  const words = new Uint32Array(selectedCount * vertexUintPlan.fieldCount);
  let packed = 0;

  for (let index = 0; index < count; index += 1) {
    const offset = index * VERTEX_STRIDE;

    if (view.getUint16(offset + OFFSET_MESH_ID, true) !== meshId) {
      continue;
    }

    const floatOut = packed * vertexFloatPlan.fieldCount;
    floats[floatOut] = view.getFloat32(offset + OFFSET_X, true);
    floats[floatOut + 1] = view.getFloat32(offset + OFFSET_Y, true);
    floats[floatOut + 2] = view.getFloat32(offset + OFFSET_Z, true);
    floats[floatOut + 3] = view.getFloat32(offset + OFFSET_NX, true);
    floats[floatOut + 4] = view.getFloat32(offset + OFFSET_NY, true);
    floats[floatOut + 5] = view.getFloat32(offset + OFFSET_NZ, true);
    floats[floatOut + 6] = view.getFloat32(offset + OFFSET_U, true);
    floats[floatOut + 7] = view.getFloat32(offset + OFFSET_V, true);

    const wordOut = packed * vertexUintPlan.fieldCount;
    words[wordOut] = view.getUint16(offset + OFFSET_MATERIAL_ID, true);
    words[wordOut + 1] = view.getUint32(offset + OFFSET_FLAGS, true);
    words[wordOut + 2] = view.getUint32(offset + OFFSET_COLOR, true);
    packed += 1;
  }

  return checksumPackedVertex(packed, floats, words);
}

function packTsDrawCommands(rows) {
  const output = new Uint32Array(rows.length * drawCommandPlan.fieldCount);

  for (let index = 0; index < rows.length; index += 1) {
    writeTsDrawCommand(output, index, rows[index]);
  }

  return checksumUintOutput(rows.length, output);
}

function packBinaryDrawCommands(view, count) {
  const output = new Uint32Array(count * drawCommandPlan.fieldCount);
  const packed = packUintPlan(view, count, drawCommandPlan, output);
  return checksumUintOutput(packed, output);
}

function packBinaryDrawCommandsFused(view, count) {
  const output = new Uint32Array(count * drawCommandPlan.fieldCount);

  for (let index = 0; index < count; index += 1) {
    writeBinaryDrawCommand(view, output, index, index);
  }

  return checksumUintOutput(count, output);
}

function packTsDrawCommandsWhereMaterial(rows, materialId) {
  const selectedCount = Math.ceil(rows.length / 4);
  const output = new Uint32Array(selectedCount * drawCommandPlan.fieldCount);
  let packed = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    if (row.materialId !== materialId) {
      continue;
    }

    writeTsDrawCommand(output, packed, row);
    packed += 1;
  }

  return checksumUintOutput(packed, output);
}

function packBinaryDrawCommandsWhereMaterial(view, count, materialId) {
  const selectedCount = Math.ceil(count / 4);
  const output = new Uint32Array(selectedCount * drawCommandPlan.fieldCount);
  const packed = packUintPlanWhereU16Eq(
    view,
    count,
    OFFSET_DRAW_MATERIAL_ID,
    materialId,
    drawCommandPlan,
    output,
  );
  return checksumUintOutput(packed, output);
}

function packBinaryDrawCommandsWhereMaterialFused(view, count, materialId) {
  const selectedCount = Math.ceil(count / 4);
  const output = new Uint32Array(selectedCount * drawCommandPlan.fieldCount);
  let packed = 0;

  for (let index = 0; index < count; index += 1) {
    const offset = index * DRAW_BATCH_STRIDE;

    if (view.getUint32(offset + OFFSET_DRAW_MATERIAL_ID, true) !== materialId) {
      continue;
    }

    writeBinaryDrawCommand(view, output, packed, index);
    packed += 1;
  }

  return checksumUintOutput(packed, output);
}

function writeTsDrawCommand(output, index, row) {
  const out = index * drawCommandPlan.fieldCount;
  output[out] = row.meshId;
  output[out + 1] = row.materialId;
  output[out + 2] = row.firstIndex;
  output[out + 3] = row.indexCount;
  output[out + 4] = row.firstInstance;
  output[out + 5] = row.instanceCount;
  output[out + 6] = row.flags;
}

function writeBinaryDrawCommand(view, output, outputIndex, sourceIndex) {
  const offset = sourceIndex * DRAW_BATCH_STRIDE;
  const out = outputIndex * drawCommandPlan.fieldCount;
  output[out] = view.getUint32(offset + OFFSET_DRAW_MESH_ID, true);
  output[out + 1] = view.getUint32(offset + OFFSET_DRAW_MATERIAL_ID, true);
  output[out + 2] = view.getUint32(offset + OFFSET_DRAW_FIRST_INDEX, true);
  output[out + 3] = view.getUint32(offset + OFFSET_DRAW_INDEX_COUNT, true);
  output[out + 4] = view.getUint32(offset + OFFSET_DRAW_FIRST_INSTANCE, true);
  output[out + 5] = view.getUint32(offset + OFFSET_DRAW_INSTANCE_COUNT, true);
  output[out + 6] = view.getUint32(offset + OFFSET_DRAW_FLAGS, true);
}

function countSelectedMeshRows(count, meshId) {
  if (meshId >= count) {
    return 0;
  }

  return Math.floor((count - 1 - meshId) / 16) + 1;
}

function checksumPackedVertex(packed, floats, words) {
  let checksum = mix32(0, packed);
  checksum = mixFloatOutput(checksum, floats);
  return mixUintOutput(checksum, words);
}

function checksumUintOutput(packed, output) {
  return mixUintOutput(mix32(0, packed), output);
}

function mixFloatOutput(checksum, output) {
  const stride = Math.max(1, Math.floor(output.length / 64));

  for (let index = 0; index < output.length; index += stride) {
    checksum = mix32(checksum, Math.fround(output[index]) * 1000);
  }

  return checksum;
}

function mixUintOutput(checksum, output) {
  const stride = Math.max(1, Math.floor(output.length / 64));

  for (let index = 0; index < output.length; index += stride) {
    checksum = mix32(checksum, output[index] ?? 0);
  }

  return checksum;
}

function measure(label, recordCount, run) {
  let checksum = 0;
  for (let index = 0; index < WARMUP_RUNS; index += 1) {
    checksum = Number(run());
  }

  forceGc();
  const samples = [];
  for (let index = 0; index < MEASURE_RUNS; index += 1) {
    const started = performance.now();
    checksum = Number(run());
    samples.push(performance.now() - started);
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const median = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const std = standardDeviation(samples);
  const stats = {
    median,
    p95,
    p99,
    std,
    recordCount,
    medianNsPerRecord: nsPerRecord(median, recordCount),
  };

  console.log(
    `${label}: median=${median.toFixed(2)} ms p95=${p95.toFixed(2)} ms p99=${p99.toFixed(2)} ms std=${std.toFixed(2)} ms median=${stats.medianNsPerRecord.toFixed(2)} ns/row checksum=${checksum}`,
  );

  return { checksum, stats };
}

function compareToBaseline(label, baseline, comparison) {
  const delta = comparison.median - baseline.median;
  const pooledStd = Math.sqrt(baseline.std ** 2 + comparison.std ** 2);
  const status = Math.abs(delta) <= pooledStd ? "within-noise" : "above-noise";
  const percent = baseline.median === 0 ? 0 : (delta / baseline.median) * 100;
  console.log(
    `  ${label}: delta=${delta.toFixed(2)} ms (${percent.toFixed(1)}%), pooled-std=${pooledStd.toFixed(2)} ms, ${status}`,
  );
}

function assertSameChecksum(label, left, right) {
  if (left !== right) {
    throw new Error(`${label} checksum mismatch: ${left} !== ${right}`);
  }
}

function forceGc() {
  globalThis.gc();
  globalThis.gc();
}

function percentile(sortedValues, percentileValue) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil((percentileValue / 100) * sortedValues.length) - 1,
  );
  return sortedValues[index] ?? 0;
}

function mean(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function nsPerRecord(milliseconds, recordCount) {
  return (milliseconds * 1_000_000) / recordCount;
}

function mix32(checksum, value) {
  checksum ^= Number(value) | 0;
  return Math.imul(checksum, 0x45d9f3b) >>> 0;
}

function formatMemoryDelta(before, after) {
  const heap = after.heapUsed - before.heapUsed;
  const external = after.external - before.external;
  const arrayBuffers = after.arrayBuffers - before.arrayBuffers;
  return `heap=${formatBytes(heap)}, external=${formatBytes(external)}, arrayBuffers=${formatBytes(arrayBuffers)}`;
}

function formatBytes(bytes) {
  const sign = bytes < 0 ? "-" : "";
  let value = Math.abs(bytes);

  if (value < 1024) {
    return `${sign}${value} B`;
  }

  const units = ["KiB", "MiB", "GiB"];
  value /= 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${sign}${value.toFixed(2)} ${units[unitIndex]}`;
}
