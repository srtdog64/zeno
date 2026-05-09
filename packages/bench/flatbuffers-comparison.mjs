import { performance } from "node:perf_hooks";

import { Builder, ByteBuffer } from "flatbuffers";

import {
  UserView,
  UserViewAgeOffset,
  UserViewByteLength,
  UserViewIdOffset,
  UserViewRatioOffset,
  UserViewScoreOffset,
} from "../../examples/basic/dist/model.view.js";

const RECORD_COUNT = Number(process.env.ZENO_BENCH_RECORDS ?? 200_000);
const WARMUP_RUNS = Number(process.env.ZENO_BENCH_WARMUP ?? 3);
const MEASURE_RUNS = Number(process.env.ZENO_BENCH_RUNS ?? 30);
const STRIDE = UserViewByteLength;

if (typeof globalThis.gc !== "function") {
  console.error("Run with --expose-gc so retained memory measurements are meaningful.");
  process.exit(1);
}

function forceGc() {
  globalThis.gc();
  globalThis.gc();
}

function memorySnapshot() {
  forceGc();
  const memory = process.memoryUsage();
  return {
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
  };
}

function diffMemory(after, before) {
  return {
    rss: after.rss - before.rss,
    heapUsed: after.heapUsed - before.heapUsed,
    external: after.external - before.external,
    arrayBuffers: after.arrayBuffers - before.arrayBuffers,
  };
}

function formatBytes(bytes) {
  const sign = bytes < 0 ? "-" : "";
  const abs = Math.abs(bytes);
  if (abs < 1024) {
    return `${sign}${abs} B`;
  }

  const units = ["KiB", "MiB", "GiB"];
  let value = abs / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${sign}${value.toFixed(2)} ${units[unitIndex]}`;
}

function printMemoryDelta(label, after, before) {
  const delta = diffMemory(after, before);
  console.log(label);
  console.log(`  heapUsed:     ${formatBytes(delta.heapUsed)}`);
  console.log(`  external:     ${formatBytes(delta.external)}`);
  console.log(`  arrayBuffers: ${formatBytes(delta.arrayBuffers)}`);
  console.log(`  rss:          ${formatBytes(delta.rss)}`);
}

function percentile(sortedValues, percentileValue) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil((percentileValue / 100) * sortedValues.length) - 1,
  );
  return sortedValues[index] ?? 0;
}

function mean(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function nsPerRecord(milliseconds) {
  return (milliseconds * 1_000_000) / RECORD_COUNT;
}

function measure(label, run) {
  let checksum = 0;
  for (let index = 0; index < WARMUP_RUNS; index += 1) {
    checksum = Number(run());
  }

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
    medianNsPerRecord: nsPerRecord(median),
  };

  console.log(
    `${label}: median=${median.toFixed(2)} ms p95=${p95.toFixed(2)} ms p99=${p99.toFixed(2)} ms std=${std.toFixed(2)} ms median=${stats.medianNsPerRecord.toFixed(2)} ns/record`,
  );
  return { checksum, stats };
}

function compareToBaseline(label, baseline, candidate) {
  const delta = candidate.median - baseline.median;
  const pooledStd = Math.sqrt(baseline.std ** 2 + candidate.std ** 2);
  const deltaNs = nsPerRecord(delta);
  const noiseNs = nsPerRecord(pooledStd);
  const ratio = pooledStd === 0 ? Number.POSITIVE_INFINITY : Math.abs(delta) / pooledStd;
  const status = Math.abs(delta) > pooledStd ? "above-noise" : "within-noise";

  console.log(
    `  ${label}: delta=${delta.toFixed(2)} ms (${deltaNs.toFixed(2)} ns/record), pooled-std=${pooledStd.toFixed(2)} ms (${noiseNs.toFixed(2)} ns/record), ratio=${ratio.toFixed(2)}x, ${status}`,
  );
}

function makeZenoFixture(count) {
  const buffer = new ArrayBuffer(count * STRIDE);
  const view = new DataView(buffer);

  for (let index = 0; index < count; index += 1) {
    const offset = index * STRIDE;
    view.setBigUint64(offset + UserViewIdOffset, BigInt(index), true);
    view.setInt32(offset + UserViewAgeOffset, index % 120, true);
    view.setFloat64(offset + UserViewScoreOffset, index * 0.5, true);
    view.setFloat32(offset + UserViewRatioOffset, (index % 1000) / 1000, true);
  }

  return { buffer, view };
}

function buildFlatBufferFixture(count) {
  const builder = new Builder(Math.max(1024, count * 48));
  builder.forceDefaults(true);
  const userOffsets = new Array(count);

  for (let index = 0; index < count; index += 1) {
    builder.startObject(4);
    builder.addFieldInt64(0, BigInt(index), 0n);
    builder.addFieldInt32(1, index % 120, 0);
    builder.addFieldFloat64(2, index * 0.5, 0);
    builder.addFieldFloat32(3, (index % 1000) / 1000, 0);
    userOffsets[index] = builder.endObject();
  }

  builder.startVector(4, count, 4);
  for (let index = count - 1; index >= 0; index -= 1) {
    builder.addOffset(userOffsets[index]);
  }
  const usersVector = builder.endVector();

  builder.startObject(1);
  builder.addFieldOffset(0, usersVector, 0);
  const batch = builder.endObject();
  builder.finish(batch);

  const bytes = builder.asUint8Array();
  const stableBytes = new Uint8Array(bytes);
  const buffer = new ByteBuffer(stableBytes);
  return {
    buffer,
    bytes: stableBytes,
    root: FbUserBatch.getRootAsUserBatch(buffer),
  };
}

class FbUser {
  __init(position, buffer) {
    this.bb_pos = position;
    this.bb = buffer;
    return this;
  }

  id() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset === 0 ? 0n : this.bb.readUint64(this.bb_pos + offset);
  }

  age() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset === 0 ? 0 : this.bb.readInt32(this.bb_pos + offset);
  }

  score() {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset === 0 ? 0 : this.bb.readFloat64(this.bb_pos + offset);
  }

  ratio() {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset === 0 ? 0 : this.bb.readFloat32(this.bb_pos + offset);
  }
}

class FbUserBatch {
  static getRootAsUserBatch(buffer, out = new FbUserBatch()) {
    const root = buffer.position() + buffer.readInt32(buffer.position());
    return out.__init(root, buffer);
  }

  __init(position, buffer) {
    this.bb_pos = position;
    this.bb = buffer;
    return this;
  }

  users(index, out = new FbUser()) {
    const offset = this.bb.__offset(this.bb_pos, 4);
    if (offset === 0) {
      return null;
    }

    const vector = this.bb.__vector(this.bb_pos + offset);
    return out.__init(this.bb.__indirect(vector + index * 4), this.bb);
  }

  usersLength() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset === 0 ? 0 : this.bb.__vector_len(this.bb_pos + offset);
  }
}

function directDataViewAgePass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    sum += view.getInt32(index * STRIDE + UserViewAgeOffset, true);
  }
  return sum;
}

function directDataViewScalarMixPass(view, count) {
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = index * STRIDE;
    checksum += Number(view.getBigUint64(offset + UserViewIdOffset, true) & 0xffffn);
    checksum += view.getInt32(offset + UserViewAgeOffset, true);
    checksum += view.getFloat64(offset + UserViewScoreOffset, true);
    checksum += view.getFloat32(offset + UserViewRatioOffset, true);
  }
  return checksum;
}

function zenoStaticAgePass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    sum += UserView.getAge(view, index * STRIDE);
  }
  return sum;
}

function zenoAgeAtPass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    sum += UserView.getAgeAt(view, index);
  }
  return sum;
}

function zenoSumAgePass(view, count) {
  return UserView.sumAge(view, count);
}

function zenoStaticScalarMixPass(view, count) {
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = index * STRIDE;
    checksum += Number(UserView.getId(view, offset) & 0xffffn);
    checksum += UserView.getAge(view, offset);
    checksum += UserView.getScore(view, offset);
    checksum += UserView.getRatio(view, offset);
  }
  return checksum;
}

function flatBuffersAgePass(root, count) {
  let sum = 0;
  const user = new FbUser();
  for (let index = 0; index < count; index += 1) {
    sum += root.users(index, user).age();
  }
  return sum;
}

function flatBuffersScalarMixPass(root, count) {
  let checksum = 0;
  const user = new FbUser();
  for (let index = 0; index < count; index += 1) {
    root.users(index, user);
    checksum += Number(user.id() & 0xffffn);
    checksum += user.age();
    checksum += user.score();
    checksum += user.ratio();
  }
  return checksum;
}

function assertSameChecksum(label, left, right) {
  if (left !== right) {
    throw new Error(`${label} checksum mismatch: ${left} !== ${right}`);
  }
}

console.log("Zeno vs FlatBuffers JS projection bench");
console.log(`records: ${RECORD_COUNT.toLocaleString("en-US")}`);
console.log(`warmup runs: ${WARMUP_RUNS}`);
console.log(`measured runs: ${MEASURE_RUNS}`);
console.log("");
console.log("Schema model:");
console.log("  Zeno: fixed-stride inline record array generated from TypeScript interfaces.");
console.log("  FlatBuffers: table User + root vector<User>; manual JS generated-class equivalent.");
console.log("  Payload bytes are diagnostic only: this Zeno fixture uses the existing 88-byte example view, including non-scalar fields not present in the FlatBuffers table.");
console.log("");

const baseline = memorySnapshot();
const zenoFixture = makeZenoFixture(RECORD_COUNT);
const afterZeno = memorySnapshot();
const flatFixture = buildFlatBufferFixture(RECORD_COUNT);
const afterFlatBuffers = memorySnapshot();

console.log(`Zeno payload bytes: ${formatBytes(zenoFixture.buffer.byteLength)}`);
console.log(`FlatBuffers payload bytes: ${formatBytes(flatFixture.bytes.byteLength)}`);
console.log(`FlatBuffers users length: ${flatFixture.root.usersLength().toLocaleString("en-US")}`);
console.log("");
printMemoryDelta("Zeno fixture retained over baseline", afterZeno, baseline);
printMemoryDelta("FlatBuffers fixture retained over Zeno fixture", afterFlatBuffers, afterZeno);
console.log("");

const directAge = measure("direct DataView age pass", () =>
  directDataViewAgePass(zenoFixture.view, RECORD_COUNT),
);
const zenoStaticAge = measure("Zeno static age pass", () =>
  zenoStaticAgePass(zenoFixture.view, RECORD_COUNT),
);
const zenoAgeAt = measure("Zeno static ageAt pass", () =>
  zenoAgeAtPass(zenoFixture.view, RECORD_COUNT),
);
const zenoSumAge = measure("Zeno sumAge scan kernel pass", () =>
  zenoSumAgePass(zenoFixture.view, RECORD_COUNT),
);
const flatAge = measure("FlatBuffers table vector age pass", () =>
  flatBuffersAgePass(flatFixture.root, RECORD_COUNT),
);

assertSameChecksum("age direct/static", directAge.checksum, zenoStaticAge.checksum);
assertSameChecksum("age direct/ageAt", directAge.checksum, zenoAgeAt.checksum);
assertSameChecksum("age direct/sumAge", directAge.checksum, zenoSumAge.checksum);
assertSameChecksum("age direct/flatbuffers", directAge.checksum, flatAge.checksum);

console.log("age delta vs direct DataView");
compareToBaseline("Zeno static age", directAge.stats, zenoStaticAge.stats);
compareToBaseline("Zeno static ageAt", directAge.stats, zenoAgeAt.stats);
compareToBaseline("Zeno sumAge scan kernel", directAge.stats, zenoSumAge.stats);
compareToBaseline("FlatBuffers table vector", directAge.stats, flatAge.stats);
console.log("");

const directMix = measure("direct DataView scalar mix pass", () =>
  directDataViewScalarMixPass(zenoFixture.view, RECORD_COUNT),
);
const zenoMix = measure("Zeno static scalar mix pass", () =>
  zenoStaticScalarMixPass(zenoFixture.view, RECORD_COUNT),
);
const flatMix = measure("FlatBuffers table vector scalar mix pass", () =>
  flatBuffersScalarMixPass(flatFixture.root, RECORD_COUNT),
);

assertSameChecksum("mix direct/static", directMix.checksum, zenoMix.checksum);
assertSameChecksum("mix direct/flatbuffers", directMix.checksum, flatMix.checksum);

console.log("scalar mix delta vs direct DataView");
compareToBaseline("Zeno static scalar mix", directMix.stats, zenoMix.stats);
compareToBaseline("FlatBuffers table vector", directMix.stats, flatMix.stats);
console.log("");
console.log("Interpretation:");
console.log("  Raw DataView is the lower-level baseline; beating it consistently is not the contract.");
console.log("  The useful question is whether Zeno keeps named TS-schema access near DataView while avoiding FlatBuffers table indirection and per-record object materialization.");
