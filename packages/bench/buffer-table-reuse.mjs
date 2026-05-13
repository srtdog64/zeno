import { performance } from "node:perf_hooks";

import { createFixedRecordTable } from "../../packages/buffers/dist/index.js";

const WARMUP_RUNS = Number(process.env.ZENO_TABLE_REUSE_BENCH_WARMUP ?? 3);
const MEASURE_RUNS = Number(process.env.ZENO_TABLE_REUSE_BENCH_RUNS ?? 25);
const ITERATIONS = Number(process.env.ZENO_TABLE_REUSE_BENCH_ITERATIONS ?? 5_000);

const CELL_STRIDE = 12;
const ENTITY_STRIDE = 28;
const AGENT_STRIDE = 56;
const CELL_COUNT = 616;
const ENTITY_COUNT = 1_364;
const AGENT_COUNT = 1_364;

if (typeof globalThis.gc !== "function") {
  console.error("Run with --expose-gc so retained memory measurements are meaningful.");
  process.exit(1);
}

console.log("Zeno fixed-record table reuse benchmark");
console.log(`iterations=${ITERATIONS} warmup=${WARMUP_RUNS} runs=${MEASURE_RUNS}`);
console.log(
  `tables: cells=${CELL_COUNT}x${CELL_STRIDE}, entities=${ENTITY_COUNT}x${ENTITY_STRIDE}, agents=${AGENT_COUNT}x${AGENT_STRIDE}`,
);
console.log("");

const fresh = measure("fresh ArrayBuffer/DataView tables", freshTablesPass);
const reused = measure("createFixedRecordTable reset reuse", reusableTablesPass());

console.log("");
compareToBaseline("createFixedRecordTable reset reuse", fresh.stats, reused.stats);

function freshTablesPass() {
  let checksum = 0;

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const cellView = new DataView(new ArrayBuffer(CELL_STRIDE * CELL_COUNT));
    const entityView = new DataView(new ArrayBuffer(ENTITY_STRIDE * ENTITY_COUNT));
    const agentView = new DataView(new ArrayBuffer(AGENT_STRIDE * AGENT_COUNT));

    checksum = writeFixtureTables(cellView, entityView, agentView, checksum);
  }

  return checksum;
}

function reusableTablesPass() {
  const cells = createFixedRecordTable(CELL_STRIDE, CELL_COUNT);
  const entities = createFixedRecordTable(ENTITY_STRIDE, ENTITY_COUNT);
  const agents = createFixedRecordTable(AGENT_STRIDE, AGENT_COUNT);

  return () => {
    let checksum = 0;

    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const cellView = cells.reset(CELL_COUNT);
      const entityView = entities.reset(ENTITY_COUNT);
      const agentView = agents.reset(AGENT_COUNT);

      checksum = writeFixtureTables(cellView, entityView, agentView, checksum);
    }

    return checksum;
  };
}

function writeFixtureTables(cellView, entityView, agentView, seed) {
  let checksum = seed;

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const offset = index * CELL_STRIDE;
    cellView.setUint16(offset, index & 0xffff, true);
    cellView.setUint8(offset + 8, index & 0xff);
    checksum = mix32(checksum, cellView.getUint16(offset, true));
  }

  for (let index = 0; index < ENTITY_COUNT; index += 1) {
    const offset = index * ENTITY_STRIDE;
    entityView.setUint32(offset, index + 1, true);
    entityView.setFloat32(offset + 8, index * 0.25, true);
    entityView.setFloat32(offset + 12, index * 0.5, true);
    entityView.setFloat32(offset + 16, index * 0.75, true);
    checksum = mix32(checksum, entityView.getUint32(offset, true));
  }

  for (let index = 0; index < AGENT_COUNT; index += 1) {
    const offset = index * AGENT_STRIDE;
    agentView.setUint32(offset, index + 1, true);
    agentView.setFloat32(offset + 24, 100 - (index % 100), true);
    agentView.setFloat32(offset + 28, index % 64, true);
    checksum = mix32(checksum, agentView.getUint32(offset, true));
  }

  return checksum;
}

function measure(label, run) {
  let checksum = 0;
  for (let index = 0; index < WARMUP_RUNS; index += 1) {
    checksum = Number(run());
  }

  forceGc();
  const before = process.memoryUsage();
  const samples = [];
  for (let index = 0; index < MEASURE_RUNS; index += 1) {
    const started = performance.now();
    checksum = Number(run());
    samples.push(performance.now() - started);
  }
  forceGc();
  const after = process.memoryUsage();

  const sorted = [...samples].sort((left, right) => left - right);
  const median = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const std = standardDeviation(samples);
  const stats = { median, p95, p99, std, samples };

  console.log(
    `${label}: median=${median.toFixed(2)} ms p95=${p95.toFixed(2)} ms p99=${p99.toFixed(2)} ms std=${std.toFixed(2)} ms heapDelta=${formatBytes(after.heapUsed - before.heapUsed)} arrayBufferDelta=${formatBytes(after.arrayBuffers - before.arrayBuffers)} checksum=${checksum}`,
  );

  return { checksum, stats };
}

function compareToBaseline(label, baseline, comparison) {
  const delta = comparison.median - baseline.median;
  const pooledStd = Math.sqrt(baseline.std ** 2 + comparison.std ** 2);
  const status = Math.abs(delta) <= pooledStd ? "within-noise" : "above-noise";

  console.log(
    `  ${label}: delta=${delta.toFixed(2)} ms, pooled-std=${pooledStd.toFixed(2)} ms, ${status}`,
  );
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

function mix32(checksum, value) {
  checksum ^= value;
  return Math.imul(checksum, 0x45d9f3b) >>> 0;
}

function formatBytes(bytes) {
  if (Math.abs(bytes) < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(2)} KiB`;
}
