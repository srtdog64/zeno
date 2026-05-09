import { performance } from "node:perf_hooks";

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
const INCLUDE_CURSOR_DIAGNOSTICS = false;
const STRIDE = UserView.byteLength;
const POINTER_NODE_STRIDE = 8;
const POINTER_NODE_VALUE_OFFSET = 0;
const POINTER_NODE_NEXT_OFFSET = 4;
const POINTER32_NULL = 0xffffffff;

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
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
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
    samples,
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

function timeOnce(label, run) {
  const started = performance.now();
  const result = run();
  const elapsed = performance.now() - started;
  console.log(`${label}: ${elapsed.toFixed(2)} ms`);
  return result;
}

function optimizedUserViewClass() {
  throw new Error("optimized cursor diagnostics were removed in Zeno v2.");
}

function makeFixture(count) {
  const buffer = new ArrayBuffer(count * STRIDE);
  const view = new DataView(buffer);

  for (let index = 0; index < count; index += 1) {
    const offset = index * STRIDE;
    view.setBigUint64(offset, BigInt(index), true);
    view.setInt32(offset + 8, index % 120, true);
    view.setFloat64(offset + 16, index * 0.5, true);
    view.setFloat32(offset + 24, (index % 1000) / 1000, true);
  }

  return { buffer, view };
}

function makePointerFixture(count) {
  const buffer = new ArrayBuffer(count * POINTER_NODE_STRIDE);
  const view = new DataView(buffer);

  for (let index = 0; index < count; index += 1) {
    const offset = index * POINTER_NODE_STRIDE;
    view.setInt32(offset + POINTER_NODE_VALUE_OFFSET, index % 120, true);

    if (index + 1 === count) {
      view.setUint32(offset + POINTER_NODE_NEXT_OFFSET, POINTER32_NULL, true);
    } else {
      const pointerPosition = offset + POINTER_NODE_NEXT_OFFSET;
      const targetOffset = (index + 1) * POINTER_NODE_STRIDE;
      view.setUint32(pointerPosition, targetOffset - pointerPosition, true);
    }
  }

  return { buffer, view };
}

function directAgePass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    sum += view.getInt32(index * STRIDE + 8, true);
  }
  return sum;
}

function directAgeOffsetLoopPass(view, count) {
  let sum = 0;
  for (let offset = 8, end = count * STRIDE; offset < end; offset += STRIDE) {
    sum += view.getInt32(offset, true);
  }
  return sum;
}

function boundDataViewAgePass(view, count) {
  let sum = 0;
  const getInt32 = view.getInt32.bind(view);
  for (let index = 0; index < count; index += 1) {
    sum += getInt32(index * STRIDE + 8, true);
  }
  return sum;
}

function staticAgePass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    sum += UserView.getAge(view, index * STRIDE);
  }
  return sum;
}

function staticAgeAtPass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    sum += UserView.getAgeAt(view, index);
  }
  return sum;
}

function staticSumAgeKernelPass(view, count) {
  return UserView.sumAge(view, count);
}

function cursorAgePass(view, count) {
  let sum = 0;
  const user = new UserView(view);
  for (let index = 0; index < count; index += 1) {
    sum += user.rebase(index * STRIDE).age;
  }
  return sum;
}

function cursorAgeUncheckedPass(view, count) {
  let sum = 0;
  const user = new UserView(view);
  for (let index = 0; index < count; index += 1) {
    sum += user.rebaseUnchecked(index * STRIDE).age;
  }
  return sum;
}

function cursorAgeAtPass(view, count) {
  let sum = 0;
  const user = new UserView(view);
  for (let index = 0; index < count; index += 1) {
    sum += user.moveTo(index).age;
  }
  return sum;
}

function cursorAgeAtUncheckedPass(view, count) {
  let sum = 0;
  const user = new UserView(view);
  for (let index = 0; index < count; index += 1) {
    sum += user.moveToUnchecked(index).age;
  }
  return sum;
}

function optimizedCursorAgePass(view, count) {
  let sum = 0;
  const user = new (optimizedUserViewClass())(view);
  for (let index = 0; index < count; index += 1) {
    sum += user.rebase(index * STRIDE).age;
  }
  return sum;
}

function optimizedCursorAgeUncheckedPass(view, count) {
  let sum = 0;
  const user = new (optimizedUserViewClass())(view);
  for (let index = 0; index < count; index += 1) {
    sum += user.rebaseUnchecked(index * STRIDE).age;
  }
  return sum;
}

function optimizedCursorAgeAtPass(view, count) {
  let sum = 0;
  const user = new (optimizedUserViewClass())(view);
  for (let index = 0; index < count; index += 1) {
    sum += user.moveTo(index).age;
  }
  return sum;
}

function optimizedCursorAgeAtUncheckedPass(view, count) {
  let sum = 0;
  const user = new (optimizedUserViewClass())(view);
  for (let index = 0; index < count; index += 1) {
    sum += user.moveToUnchecked(index).age;
  }
  return sum;
}

class BoundAgeView {
  constructor(view, baseOffset = 0) {
    this.getInt32 = view.getInt32.bind(view);
    this.baseOffset = baseOffset;
  }

  rebase(baseOffset) {
    this.baseOffset = baseOffset;
    return this;
  }

  get age() {
    return this.getInt32(this.baseOffset + 8, true);
  }
}

function boundCursorAgePass(view, count) {
  let sum = 0;
  const user = new BoundAgeView(view);
  for (let index = 0; index < count; index += 1) {
    sum += user.rebase(index * STRIDE).age;
  }
  return sum;
}

class PrecomputedAgeOffsetView {
  constructor(view, baseOffset = 0) {
    this.view = view;
    this.ageOffset = baseOffset + 8;
  }

  rebase(baseOffset) {
    this.ageOffset = baseOffset + 8;
    return this;
  }

  get age() {
    return this.view.getInt32(this.ageOffset, true);
  }
}

function precomputedCursorAgePass(view, count) {
  let sum = 0;
  const user = new PrecomputedAgeOffsetView(view);
  for (let index = 0; index < count; index += 1) {
    sum += user.rebase(index * STRIDE).age;
  }
  return sum;
}

function perRecordViewAgePass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    sum += new UserView(view, index * STRIDE).age;
  }
  return sum;
}

function directScalarMixPass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = index * STRIDE;
    sum += Number(view.getBigUint64(offset, true) & 0xffffn);
    sum += view.getInt32(offset + 8, true);
    sum += view.getFloat64(offset + 16, true);
    sum += view.getFloat32(offset + 24, true);
  }
  return sum;
}

function directScalarMixOffsetLoopPass(view, count) {
  let sum = 0;
  for (let offset = 0, end = count * STRIDE; offset < end; offset += STRIDE) {
    sum += Number(view.getBigUint64(offset, true) & 0xffffn);
    sum += view.getInt32(offset + 8, true);
    sum += view.getFloat64(offset + 16, true);
    sum += view.getFloat32(offset + 24, true);
  }
  return sum;
}

function zenoOffsetConstantScalarMixPass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = index * STRIDE;
    sum += Number(view.getBigUint64(offset + UserView.idOffset, true) & 0xffffn);
    sum += view.getInt32(offset + UserView.ageOffset, true);
    sum += view.getFloat64(offset + UserView.scoreOffset, true);
    sum += view.getFloat32(offset + UserView.ratioOffset, true);
  }
  return sum;
}

function zenoTopLevelOffsetConstantScalarMixPass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = index * UserViewByteLength;
    sum += Number(view.getBigUint64(offset + UserViewIdOffset, true) & 0xffffn);
    sum += view.getInt32(offset + UserViewAgeOffset, true);
    sum += view.getFloat64(offset + UserViewScoreOffset, true);
    sum += view.getFloat32(offset + UserViewRatioOffset, true);
  }
  return sum;
}

function zenoHoistedOffsetConstantScalarMixPass(view, count) {
  let sum = 0;
  const stride = UserView.byteLength;
  const idOffset = UserView.idOffset;
  const ageOffset = UserView.ageOffset;
  const scoreOffset = UserView.scoreOffset;
  const ratioOffset = UserView.ratioOffset;
  for (let index = 0; index < count; index += 1) {
    const offset = index * stride;
    sum += Number(view.getBigUint64(offset + idOffset, true) & 0xffffn);
    sum += view.getInt32(offset + ageOffset, true);
    sum += view.getFloat64(offset + scoreOffset, true);
    sum += view.getFloat32(offset + ratioOffset, true);
  }
  return sum;
}

function staticScalarMixPass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = index * STRIDE;
    sum += Number(UserView.getId(view, offset) & 0xffffn);
    sum += UserView.getAge(view, offset);
    sum += UserView.getScore(view, offset);
    sum += UserView.getRatio(view, offset);
  }
  return sum;
}

function staticScalarMixOffsetLoopPass(view, count) {
  let sum = 0;
  for (let offset = 0, end = count * STRIDE; offset < end; offset += STRIDE) {
    sum += Number(UserView.getId(view, offset) & 0xffffn);
    sum += UserView.getAge(view, offset);
    sum += UserView.getScore(view, offset);
    sum += UserView.getRatio(view, offset);
  }
  return sum;
}

function staticScalarMixAtPass(view, count) {
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    sum += Number(UserView.getIdAt(view, index) & 0xffffn);
    sum += UserView.getAgeAt(view, index);
    sum += UserView.getScoreAt(view, index);
    sum += UserView.getRatioAt(view, index);
  }
  return sum;
}

function cursorScalarMixPass(view, count) {
  let sum = 0;
  const user = new UserView(view);
  for (let index = 0; index < count; index += 1) {
    user.rebase(index * STRIDE);
    sum += Number(user.id & 0xffffn);
    sum += user.age;
    sum += user.score;
    sum += user.ratio;
  }
  return sum;
}

function cursorScalarMixUncheckedPass(view, count) {
  let sum = 0;
  const user = new UserView(view);
  for (let index = 0; index < count; index += 1) {
    user.rebaseUnchecked(index * STRIDE);
    sum += Number(user.id & 0xffffn);
    sum += user.age;
    sum += user.score;
    sum += user.ratio;
  }
  return sum;
}

function optimizedCursorScalarMixPass(view, count) {
  let sum = 0;
  const user = new (optimizedUserViewClass())(view);
  for (let index = 0; index < count; index += 1) {
    user.rebase(index * STRIDE);
    sum += Number(user.id & 0xffffn);
    sum += user.age;
    sum += user.score;
    sum += user.ratio;
  }
  return sum;
}

function optimizedCursorScalarMixUncheckedPass(view, count) {
  let sum = 0;
  const user = new (optimizedUserViewClass())(view);
  for (let index = 0; index < count; index += 1) {
    user.rebaseUnchecked(index * STRIDE);
    sum += Number(user.id & 0xffffn);
    sum += user.age;
    sum += user.score;
    sum += user.ratio;
  }
  return sum;
}

function optimizedCursorScalarMixAtPass(view, count) {
  let sum = 0;
  const user = new (optimizedUserViewClass())(view);
  for (let index = 0; index < count; index += 1) {
    user.moveTo(index);
    sum += Number(user.id & 0xffffn);
    sum += user.age;
    sum += user.score;
    sum += user.ratio;
  }
  return sum;
}

function optimizedCursorScalarMixAtUncheckedPass(view, count) {
  let sum = 0;
  const user = new (optimizedUserViewClass())(view);
  for (let index = 0; index < count; index += 1) {
    user.moveToUnchecked(index);
    sum += Number(user.id & 0xffffn);
    sum += user.age;
    sum += user.score;
    sum += user.ratio;
  }
  return sum;
}

class PrecomputedScalarMixView {
  constructor(view, baseOffset = 0) {
    this.view = view;
    this.rebase(baseOffset);
  }

  rebase(baseOffset) {
    this.idOffset = baseOffset;
    this.ageOffset = baseOffset + 8;
    this.scoreOffset = baseOffset + 16;
    this.ratioOffset = baseOffset + 24;
    return this;
  }

  get id() {
    return this.view.getBigUint64(this.idOffset, true);
  }

  get age() {
    return this.view.getInt32(this.ageOffset, true);
  }

  get score() {
    return this.view.getFloat64(this.scoreOffset, true);
  }

  get ratio() {
    return this.view.getFloat32(this.ratioOffset, true);
  }
}

function precomputedCursorScalarMixPass(view, count) {
  let sum = 0;
  const user = new PrecomputedScalarMixView(view);
  for (let index = 0; index < count; index += 1) {
    user.rebase(index * STRIDE);
    sum += Number(user.id & 0xffffn);
    sum += user.age;
    sum += user.score;
    sum += user.ratio;
  }
  return sum;
}

function cursorScalarMixAtPass(view, count) {
  let sum = 0;
  const user = new UserView(view);
  for (let index = 0; index < count; index += 1) {
    user.moveTo(index);
    sum += Number(user.id & 0xffffn);
    sum += user.age;
    sum += user.score;
    sum += user.ratio;
  }
  return sum;
}

function cursorScalarMixAtUncheckedPass(view, count) {
  let sum = 0;
  const user = new UserView(view);
  for (let index = 0; index < count; index += 1) {
    user.moveToUnchecked(index);
    sum += Number(user.id & 0xffffn);
    sum += user.age;
    sum += user.score;
    sum += user.ratio;
  }
  return sum;
}

function directPointerDerefPass(view, count) {
  let sum = 0;
  let offset = 0;

  for (let steps = 0; steps < count; steps += 1) {
    sum += view.getInt32(offset + POINTER_NODE_VALUE_OFFSET, true);
    const pointerPosition = offset + POINTER_NODE_NEXT_OFFSET;
    const relativeOffset = view.getUint32(pointerPosition, true);
    if (relativeOffset === POINTER32_NULL) {
      break;
    }
    offset = pointerPosition + relativeOffset;
  }

  return sum;
}

class PointerNodeCursor {
  constructor(view, baseOffset = 0) {
    this.view = view;
    this.baseOffset = baseOffset;
  }

  moveToOffset(baseOffset) {
    if (baseOffset < 0 || baseOffset + POINTER_NODE_STRIDE > this.view.byteLength) {
      throw new RangeError(`Pointer target out of bounds: ${baseOffset}`);
    }
    this.baseOffset = baseOffset;
    return this;
  }

  get value() {
    return this.view.getInt32(this.baseOffset + POINTER_NODE_VALUE_OFFSET, true);
  }

  get nextTargetOffset() {
    const pointerPosition = this.baseOffset + POINTER_NODE_NEXT_OFFSET;
    const relativeOffset = this.view.getUint32(pointerPosition, true);
    if (relativeOffset === POINTER32_NULL) {
      return null;
    }
    return pointerPosition + relativeOffset;
  }

  nextInto(out) {
    const targetOffset = this.nextTargetOffset;
    if (targetOffset === null) {
      return false;
    }
    out.moveToOffset(targetOffset);
    return true;
  }
}

function cursorPointerDerefPass(view, count) {
  let sum = 0;
  const node = new PointerNodeCursor(view);

  for (let steps = 0; steps < count; steps += 1) {
    sum += node.value;
    if (!node.nextInto(node)) {
      break;
    }
  }

  return sum;
}

function retainViews(view, count) {
  const views = new Array(count);
  for (let index = 0; index < count; index += 1) {
    views[index] = new UserView(view, index * STRIDE);
  }
  return views;
}

function retainOptimizedViews(view, count) {
  const views = new Array(count);
  for (let index = 0; index < count; index += 1) {
    views[index] = new (optimizedUserViewClass())(view, index * STRIDE);
  }
  return views;
}

function materializeObjects(view, count) {
  const objects = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const user = new UserView(view, index * STRIDE);
    objects[index] = {
      id: user.id,
      age: user.age,
      score: user.score,
      ratio: user.ratio,
    };
  }
  return objects;
}

console.log("Zeno memory bench");
console.log(`records: ${RECORD_COUNT.toLocaleString("en-US")}`);
console.log(`warmup runs: ${WARMUP_RUNS}`);
console.log(`measured runs: ${MEASURE_RUNS}`);
console.log(`record stride: ${STRIDE} bytes`);
console.log(`raw buffer size: ${formatBytes(RECORD_COUNT * STRIDE)}`);
console.log("");

const baseline = memorySnapshot();
const fixture = makeFixture(RECORD_COUNT);
const bufferOnly = memorySnapshot();
printMemoryDelta("buffer retained over baseline", bufferOnly, baseline);
console.log("");

const directAge = measure("direct DataView age pass", () =>
  directAgePass(fixture.view, RECORD_COUNT),
);
const directAgeOffsetLoop = measure("direct DataView age offset-loop pass", () =>
  directAgeOffsetLoopPass(fixture.view, RECORD_COUNT),
);
const boundDataViewAge = measure("bound DataView age pass", () =>
  boundDataViewAgePass(fixture.view, RECORD_COUNT),
);
const staticAge = measure("Zeno static age pass", () => staticAgePass(fixture.view, RECORD_COUNT));
const staticAgeAt = measure("Zeno static ageAt pass", () =>
  staticAgeAtPass(fixture.view, RECORD_COUNT),
);
const staticSumAgeKernel = measure("Zeno sumAge kernel pass", () =>
  staticSumAgeKernelPass(fixture.view, RECORD_COUNT),
);
const cursorAge = measure("Zeno cursor age pass", () => cursorAgePass(fixture.view, RECORD_COUNT));
const cursorAgeUnchecked = measure("Zeno cursor unchecked age pass", () =>
  cursorAgeUncheckedPass(fixture.view, RECORD_COUNT),
);
const cursorAgeAt = measure("Zeno cursor moveTo age pass", () =>
  cursorAgeAtPass(fixture.view, RECORD_COUNT),
);
const cursorAgeAtUnchecked = measure("Zeno cursor moveToUnchecked age pass", () =>
  cursorAgeAtUncheckedPass(fixture.view, RECORD_COUNT),
);
const optimizedCursorAge = INCLUDE_CURSOR_DIAGNOSTICS
  ? measure("Zeno optimized cursor age pass", () =>
      optimizedCursorAgePass(fixture.view, RECORD_COUNT),
    )
  : null;
const optimizedCursorAgeUnchecked = INCLUDE_CURSOR_DIAGNOSTICS
  ? measure("Zeno optimized cursor unchecked age pass", () =>
      optimizedCursorAgeUncheckedPass(fixture.view, RECORD_COUNT),
    )
  : null;
const optimizedCursorAgeAt = INCLUDE_CURSOR_DIAGNOSTICS
  ? measure("Zeno optimized cursor moveTo age pass", () =>
      optimizedCursorAgeAtPass(fixture.view, RECORD_COUNT),
    )
  : null;
const optimizedCursorAgeAtUnchecked = INCLUDE_CURSOR_DIAGNOSTICS
  ? measure("Zeno optimized cursor moveToUnchecked age pass", () =>
      optimizedCursorAgeAtUncheckedPass(fixture.view, RECORD_COUNT),
    )
  : null;
const boundCursorAge = measure("bound-method cursor age pass", () =>
  boundCursorAgePass(fixture.view, RECORD_COUNT),
);
const precomputedCursorAge = measure("precomputed-offset cursor age pass", () =>
  precomputedCursorAgePass(fixture.view, RECORD_COUNT),
);
const perRecordAge = measure("Zeno per-record view age pass", () =>
  perRecordViewAgePass(fixture.view, RECORD_COUNT),
);
console.log(
  `age checksums: direct=${directAge.checksum}, offsetLoop=${directAgeOffsetLoop.checksum}, bound=${boundDataViewAge.checksum}, static=${staticAge.checksum}, staticAt=${staticAgeAt.checksum}, sumKernel=${staticSumAgeKernel.checksum}, cursor=${cursorAge.checksum}, cursorUnchecked=${cursorAgeUnchecked.checksum}, cursorAt=${cursorAgeAt.checksum}, cursorAtUnchecked=${cursorAgeAtUnchecked.checksum}${INCLUDE_CURSOR_DIAGNOSTICS ? `, optimizedCursor=${optimizedCursorAge.checksum}, optimizedCursorUnchecked=${optimizedCursorAgeUnchecked.checksum}, optimizedCursorAt=${optimizedCursorAgeAt.checksum}, optimizedCursorAtUnchecked=${optimizedCursorAgeAtUnchecked.checksum}` : ""}, boundCursor=${boundCursorAge.checksum}, precomputedCursor=${precomputedCursorAge.checksum}, perRecord=${perRecordAge.checksum}`,
);
console.log("age delta vs direct DataView");
compareToBaseline("direct offset loop", directAge.stats, directAgeOffsetLoop.stats);
compareToBaseline("bound DataView method", directAge.stats, boundDataViewAge.stats);
compareToBaseline("static offset", directAge.stats, staticAge.stats);
compareToBaseline("static index", directAge.stats, staticAgeAt.stats);
compareToBaseline("sumAge kernel", directAge.stats, staticSumAgeKernel.stats);
compareToBaseline("cursor rebase", directAge.stats, cursorAge.stats);
compareToBaseline("cursor unchecked rebase", directAge.stats, cursorAgeUnchecked.stats);
compareToBaseline("cursor moveTo", directAge.stats, cursorAgeAt.stats);
compareToBaseline("cursor moveToUnchecked", directAge.stats, cursorAgeAtUnchecked.stats);
if (INCLUDE_CURSOR_DIAGNOSTICS) {
  compareToBaseline("optimized cursor rebase", directAge.stats, optimizedCursorAge.stats);
  compareToBaseline(
    "optimized cursor unchecked rebase",
    directAge.stats,
    optimizedCursorAgeUnchecked.stats,
  );
  compareToBaseline("optimized cursor moveTo", directAge.stats, optimizedCursorAgeAt.stats);
  compareToBaseline(
    "optimized cursor moveToUnchecked",
    directAge.stats,
    optimizedCursorAgeAtUnchecked.stats,
  );
  compareToBaseline(
    "optimized vs current cursor rebase",
    cursorAge.stats,
    optimizedCursorAge.stats,
  );
  compareToBaseline(
    "optimized vs current cursor unchecked rebase",
    cursorAgeUnchecked.stats,
    optimizedCursorAgeUnchecked.stats,
  );
  compareToBaseline(
    "optimized vs current cursor moveTo",
    cursorAgeAt.stats,
    optimizedCursorAgeAt.stats,
  );
  compareToBaseline(
    "optimized vs current cursor moveToUnchecked",
    cursorAgeAtUnchecked.stats,
    optimizedCursorAgeAtUnchecked.stats,
  );
}
compareToBaseline("bound-method cursor", directAge.stats, boundCursorAge.stats);
compareToBaseline("precomputed-offset cursor", directAge.stats, precomputedCursorAge.stats);
compareToBaseline("per-record view", directAge.stats, perRecordAge.stats);
console.log("");

const directMix = measure("direct DataView scalar mix pass", () =>
  directScalarMixPass(fixture.view, RECORD_COUNT),
);
const directMixOffsetLoop = measure("direct DataView scalar mix offset-loop pass", () =>
  directScalarMixOffsetLoopPass(fixture.view, RECORD_COUNT),
);
const zenoOffsetConstantMix = measure("Zeno offset-constant scalar mix pass", () =>
  zenoOffsetConstantScalarMixPass(fixture.view, RECORD_COUNT),
);
const zenoTopLevelOffsetConstantMix = measure(
  "Zeno top-level offset-constant scalar mix pass",
  () => zenoTopLevelOffsetConstantScalarMixPass(fixture.view, RECORD_COUNT),
);
const zenoHoistedOffsetConstantMix = measure("Zeno hoisted offset-constant scalar mix pass", () =>
  zenoHoistedOffsetConstantScalarMixPass(fixture.view, RECORD_COUNT),
);
const staticMix = measure("Zeno static scalar mix pass", () =>
  staticScalarMixPass(fixture.view, RECORD_COUNT),
);
const staticMixOffsetLoop = measure("Zeno static scalar mix offset-loop pass", () =>
  staticScalarMixOffsetLoopPass(fixture.view, RECORD_COUNT),
);
const staticMixAt = measure("Zeno static scalar mixAt pass", () =>
  staticScalarMixAtPass(fixture.view, RECORD_COUNT),
);
const cursorMix = measure("Zeno cursor scalar mix pass", () =>
  cursorScalarMixPass(fixture.view, RECORD_COUNT),
);
const cursorMixUnchecked = measure("Zeno cursor unchecked scalar mix pass", () =>
  cursorScalarMixUncheckedPass(fixture.view, RECORD_COUNT),
);
const optimizedCursorMix = INCLUDE_CURSOR_DIAGNOSTICS
  ? measure("Zeno optimized cursor scalar mix pass", () =>
      optimizedCursorScalarMixPass(fixture.view, RECORD_COUNT),
    )
  : null;
const optimizedCursorMixUnchecked = INCLUDE_CURSOR_DIAGNOSTICS
  ? measure("Zeno optimized cursor unchecked scalar mix pass", () =>
      optimizedCursorScalarMixUncheckedPass(fixture.view, RECORD_COUNT),
    )
  : null;
const optimizedCursorMixAt = INCLUDE_CURSOR_DIAGNOSTICS
  ? measure("Zeno optimized cursor moveTo scalar mix pass", () =>
      optimizedCursorScalarMixAtPass(fixture.view, RECORD_COUNT),
    )
  : null;
const optimizedCursorMixAtUnchecked = INCLUDE_CURSOR_DIAGNOSTICS
  ? measure("Zeno optimized cursor moveToUnchecked scalar mix pass", () =>
      optimizedCursorScalarMixAtUncheckedPass(fixture.view, RECORD_COUNT),
    )
  : null;
const precomputedCursorMix = measure("precomputed-offset cursor scalar mix pass", () =>
  precomputedCursorScalarMixPass(fixture.view, RECORD_COUNT),
);
const cursorMixAt = measure("Zeno cursor moveTo scalar mix pass", () =>
  cursorScalarMixAtPass(fixture.view, RECORD_COUNT),
);
const cursorMixAtUnchecked = measure("Zeno cursor moveToUnchecked scalar mix pass", () =>
  cursorScalarMixAtUncheckedPass(fixture.view, RECORD_COUNT),
);
const afterScalarPass = memorySnapshot();
printMemoryDelta("after scalar passes over buffer-only", afterScalarPass, bufferOnly);
console.log(
  `mix checksums: direct=${directMix.checksum}, offsetLoop=${directMixOffsetLoop.checksum}, offsetConstant=${zenoOffsetConstantMix.checksum}, topLevelOffsetConstant=${zenoTopLevelOffsetConstantMix.checksum}, hoistedOffsetConstant=${zenoHoistedOffsetConstantMix.checksum}, static=${staticMix.checksum}, staticOffsetLoop=${staticMixOffsetLoop.checksum}, staticAt=${staticMixAt.checksum}, cursor=${cursorMix.checksum}, cursorUnchecked=${cursorMixUnchecked.checksum}${INCLUDE_CURSOR_DIAGNOSTICS ? `, optimizedCursor=${optimizedCursorMix.checksum}, optimizedCursorUnchecked=${optimizedCursorMixUnchecked.checksum}, optimizedCursorAt=${optimizedCursorMixAt.checksum}, optimizedCursorAtUnchecked=${optimizedCursorMixAtUnchecked.checksum}` : ""}, precomputedCursor=${precomputedCursorMix.checksum}, cursorAt=${cursorMixAt.checksum}, cursorAtUnchecked=${cursorMixAtUnchecked.checksum}`,
);
console.log("scalar mix delta vs direct DataView");
compareToBaseline("direct offset loop", directMix.stats, directMixOffsetLoop.stats);
compareToBaseline("offset constants", directMix.stats, zenoOffsetConstantMix.stats);
compareToBaseline(
  "top-level offset constants",
  directMix.stats,
  zenoTopLevelOffsetConstantMix.stats,
);
compareToBaseline("hoisted offset constants", directMix.stats, zenoHoistedOffsetConstantMix.stats);
compareToBaseline("static offset", directMix.stats, staticMix.stats);
compareToBaseline("static offset loop", directMix.stats, staticMixOffsetLoop.stats);
compareToBaseline("static index", directMix.stats, staticMixAt.stats);
compareToBaseline("cursor rebase", directMix.stats, cursorMix.stats);
compareToBaseline("cursor unchecked rebase", directMix.stats, cursorMixUnchecked.stats);
if (INCLUDE_CURSOR_DIAGNOSTICS) {
  compareToBaseline("optimized cursor rebase", directMix.stats, optimizedCursorMix.stats);
  compareToBaseline(
    "optimized cursor unchecked rebase",
    directMix.stats,
    optimizedCursorMixUnchecked.stats,
  );
  compareToBaseline("optimized cursor moveTo", directMix.stats, optimizedCursorMixAt.stats);
  compareToBaseline(
    "optimized cursor moveToUnchecked",
    directMix.stats,
    optimizedCursorMixAtUnchecked.stats,
  );
  compareToBaseline(
    "optimized vs current cursor rebase",
    cursorMix.stats,
    optimizedCursorMix.stats,
  );
  compareToBaseline(
    "optimized vs current cursor unchecked rebase",
    cursorMixUnchecked.stats,
    optimizedCursorMixUnchecked.stats,
  );
  compareToBaseline(
    "optimized vs current cursor moveTo",
    cursorMixAt.stats,
    optimizedCursorMixAt.stats,
  );
  compareToBaseline(
    "optimized vs current cursor moveToUnchecked",
    cursorMixAtUnchecked.stats,
    optimizedCursorMixAtUnchecked.stats,
  );
}
compareToBaseline("precomputed-offset cursor", directMix.stats, precomputedCursorMix.stats);
compareToBaseline("cursor moveTo", directMix.stats, cursorMixAt.stats);
compareToBaseline("cursor moveToUnchecked", directMix.stats, cursorMixAtUnchecked.stats);
console.log("");

globalThis.__zenoBenchRetained = timeOnce("retain UserView objects", () =>
  retainViews(fixture.view, RECORD_COUNT),
);
const retainedViews = memorySnapshot();
printMemoryDelta("retained UserView objects over buffer-only", retainedViews, bufferOnly);
globalThis.__zenoBenchRetained = undefined;
forceGc();
console.log("");

if (INCLUDE_CURSOR_DIAGNOSTICS) {
  globalThis.__zenoBenchRetained = timeOnce("retain optimized UserView objects", () =>
    retainOptimizedViews(fixture.view, RECORD_COUNT),
  );
  const retainedOptimizedViews = memorySnapshot();
  printMemoryDelta(
    "retained optimized UserView objects over buffer-only",
    retainedOptimizedViews,
    bufferOnly,
  );
  globalThis.__zenoBenchRetained = undefined;
  forceGc();
  console.log("");
}

globalThis.__zenoBenchRetained = timeOnce("retain materialized JS objects", () =>
  materializeObjects(fixture.view, RECORD_COUNT),
);
const retainedObjects = memorySnapshot();
printMemoryDelta("retained materialized objects over buffer-only", retainedObjects, bufferOnly);
globalThis.__zenoBenchRetained = undefined;
forceGc();

console.log("");
const pointerFixture = makePointerFixture(RECORD_COUNT);
const pointerDirect = measure("direct DataView pointer32 deref pass", () =>
  directPointerDerefPass(pointerFixture.view, RECORD_COUNT),
);
const pointerCursor = measure("cursor pointer32 nextInto pass", () =>
  cursorPointerDerefPass(pointerFixture.view, RECORD_COUNT),
);
console.log(
  `pointer checksums: direct=${pointerDirect.checksum}, cursor=${pointerCursor.checksum}`,
);
console.log("pointer deref delta vs direct DataView");
compareToBaseline("cursor nextInto", pointerDirect.stats, pointerCursor.stats);
