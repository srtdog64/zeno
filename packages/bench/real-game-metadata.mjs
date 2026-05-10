import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Builder, ByteBuffer, Encoding } from "flatbuffers";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "hexgl-asset-metadata.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

const RECORD_COUNT = Number(process.env.ZENO_REAL_GAME_BENCH_RECORDS ?? 200_000);
const WARMUP_RUNS = Number(process.env.ZENO_REAL_GAME_BENCH_WARMUP ?? 3);
const MEASURE_RUNS = Number(process.env.ZENO_REAL_GAME_BENCH_RUNS ?? 25);
const STRIDE = 24;
const HEADER_BYTES = 8;
const FIELD_PATH_HASH = 0;
const FIELD_KIND = 4;
const FIELD_EXTENSION = 6;
const FIELD_BYTE_LENGTH = 8;
const FIELD_PATH_OFFSET = 12;
const FIELD_PATH_LENGTH = 16;
const FIELD_DEPTH = 18;
const FIELD_FLAGS = 20;

const KIND_TEXTURE = fixture.kindCodes.texture;
const KIND_AUDIO = fixture.kindCodes.audio;
const KIND_GEOMETRY = fixture.kindCodes.geometry;
const EXTENSION_JPG = fixture.extensionCodes[".jpg"];
const EXTENSION_PNG = fixture.extensionCodes[".png"];
const TEXTURE_PREFIX_BYTES = new TextEncoder().encode("textures/");
const GEOMETRY_PREFIX_BYTES = new TextEncoder().encode("geometries/");

if (typeof globalThis.gc !== "function") {
  console.error("Run with --expose-gc so retained memory measurements are meaningful.");
  process.exit(1);
}

const EMPTY_BYTES = new Uint8Array(0);

class FbAssetMetadata {
  __init(position, buffer) {
    this.bb_pos = position;
    this.bb = buffer;
    return this;
  }

  pathHash() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset === 0 ? 0 : this.bb.readUint32(this.bb_pos + offset);
  }

  kind() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset === 0 ? 0 : this.bb.readUint16(this.bb_pos + offset);
  }

  extension() {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset === 0 ? 0 : this.bb.readUint16(this.bb_pos + offset);
  }

  byteLength() {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset === 0 ? 0 : this.bb.readUint32(this.bb_pos + offset);
  }

  pathBytes() {
    const offset = this.bb.__offset(this.bb_pos, 12);
    return offset === 0 ? EMPTY_BYTES : this.bb.__string(this.bb_pos + offset, Encoding.UTF8_BYTES);
  }

  depth() {
    const offset = this.bb.__offset(this.bb_pos, 14);
    return offset === 0 ? 0 : this.bb.readUint16(this.bb_pos + offset);
  }

  flags() {
    const offset = this.bb.__offset(this.bb_pos, 16);
    return offset === 0 ? 0 : this.bb.readUint32(this.bb_pos + offset);
  }
}

class FbAssetMetadataBatch {
  static getRootAsAssetMetadataBatch(buffer, out = new FbAssetMetadataBatch()) {
    const root = buffer.position() + buffer.readInt32(buffer.position());
    return out.__init(root, buffer);
  }

  __init(position, buffer) {
    this.bb_pos = position;
    this.bb = buffer;
    return this;
  }

  assets(index, out = new FbAssetMetadata()) {
    const offset = this.bb.__offset(this.bb_pos, 4);
    if (offset === 0) {
      return null;
    }

    const vector = this.bb.__vector(this.bb_pos + offset);
    return out.__init(this.bb.__indirect(vector + index * 4), this.bb);
  }

  assetsLength() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset === 0 ? 0 : this.bb.__vector_len(this.bb_pos + offset);
  }
}

const sourceRows = fixture.records;
const records = expandRecords(sourceRows, RECORD_COUNT);
const jsonPayload = JSON.stringify(records);
const binaryPayload = packBinaryMetadata(records);
const binaryView = new DataView(binaryPayload);
const flatBuffersPayload = buildFlatBuffersMetadata(records);

console.log("Zeno real-game metadata benchmark");
console.log(`source: ${fixture.source.name} ${fixture.source.repository}`);
console.log(`commit: ${fixture.source.commit}`);
console.log(`license: ${fixture.source.license}`);
console.log(`source metadata rows: ${sourceRows.length}`);
console.log(`scaled rows: ${records.length}`);
console.log(`json payload: ${formatBytes(Buffer.byteLength(jsonPayload))}`);
console.log(`binary payload: ${formatBytes(binaryPayload.byteLength)}`);
console.log(`flatbuffers payload: ${formatBytes(flatBuffersPayload.bytes.byteLength)}`);
console.log(`flatbuffers rows: ${flatBuffersPayload.root.assetsLength().toLocaleString("en-US")}`);
console.log(`warmup runs: ${WARMUP_RUNS}`);
console.log(`measured runs: ${MEASURE_RUNS}`);
console.log("");

const parsedJsonScan = measure("JSON pre-parsed metadata scan", () => scanJsonMetadata(records));
const jsonParseScan = measure("JSON.parse + metadata scan", () =>
  scanJsonMetadata(JSON.parse(jsonPayload)),
);
const binaryScalarScan = measure("Zeno binary scalar metadata scan", () =>
  scanBinaryScalarMetadata(binaryView),
);
const binaryPathScan = measure("Zeno binary path-prefix metadata scan", () =>
  scanBinaryPathPrefixMetadata(binaryView),
);
const flatBuffersScalarScan = measure("FlatBuffers table scalar metadata scan", () =>
  scanFlatBuffersScalarMetadata(flatBuffersPayload.root),
);
const flatBuffersPathScan = measure("FlatBuffers table path-prefix metadata scan", () =>
  scanFlatBuffersPathPrefixMetadata(flatBuffersPayload.root),
);
const binaryPack = measure(
  "Zeno binary metadata pack",
  () => packBinaryMetadata(records).byteLength,
);
const flatBuffersPack = measure(
  "FlatBuffers metadata pack",
  () => buildFlatBuffersMetadata(records).bytes.byteLength,
);

assertSameChecksum(
  "scalar metadata binary/flatbuffers",
  binaryScalarScan.checksum,
  flatBuffersScalarScan.checksum,
);
assertSameChecksum(
  "path-prefix metadata binary/flatbuffers",
  binaryPathScan.checksum,
  flatBuffersPathScan.checksum,
);

console.log("");
console.log("Deltas vs JSON.parse + scan");
compareToBaseline("JSON pre-parsed scan", jsonParseScan.stats, parsedJsonScan.stats);
compareToBaseline("Zeno binary scalar scan", jsonParseScan.stats, binaryScalarScan.stats);
compareToBaseline("Zeno binary path-prefix scan", jsonParseScan.stats, binaryPathScan.stats);
compareToBaseline(
  "FlatBuffers table scalar scan",
  jsonParseScan.stats,
  flatBuffersScalarScan.stats,
);
compareToBaseline(
  "FlatBuffers table path-prefix scan",
  jsonParseScan.stats,
  flatBuffersPathScan.stats,
);
compareToBaseline("Zeno binary pack", jsonParseScan.stats, binaryPack.stats);
compareToBaseline("FlatBuffers metadata pack", jsonParseScan.stats, flatBuffersPack.stats);

console.log("");
console.log("Deltas vs Zeno binary fixed-record scan");
compareToBaseline(
  "FlatBuffers table scalar scan",
  binaryScalarScan.stats,
  flatBuffersScalarScan.stats,
);
compareToBaseline(
  "FlatBuffers table path-prefix scan",
  binaryPathScan.stats,
  flatBuffersPathScan.stats,
);

console.log("");
console.log(
  "Methodological note: HexGL asset payload bytes are not stored here. The fixture contains path, extension, size, and kind metadata from a pinned public repository tree, repeated to create a large metadata scan workload.",
);

function expandRecords(rows, targetCount) {
  const expanded = [];

  for (let index = 0; index < targetCount; index += 1) {
    const source = rows[index % rows.length];
    expanded.push(source);
  }

  return expanded;
}

function packBinaryMetadata(rows) {
  const encodedPaths = rows.map((record) => new TextEncoder().encode(record.path));
  const tailBytes = encodedPaths.reduce((sum, pathBytes) => sum + pathBytes.byteLength, 0);
  const headBytes = HEADER_BYTES + rows.length * STRIDE;
  const buffer = new ArrayBuffer(headBytes + tailBytes);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let tailOffset = headBytes;

  view.setUint32(0, rows.length, true);
  view.setUint32(4, STRIDE, true);

  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    const pathBytes = encodedPaths[index];
    const offset = HEADER_BYTES + index * STRIDE;
    const flags = assetFlags(record);

    view.setUint32(offset + FIELD_PATH_HASH, record.pathHash, true);
    view.setUint16(offset + FIELD_KIND, fixture.kindCodes[record.kind], true);
    view.setUint16(offset + FIELD_EXTENSION, fixture.extensionCodes[record.extension], true);
    view.setUint32(offset + FIELD_BYTE_LENGTH, record.byteLength, true);
    view.setUint32(offset + FIELD_PATH_OFFSET, tailOffset, true);
    view.setUint16(offset + FIELD_PATH_LENGTH, pathBytes.byteLength, true);
    view.setUint16(offset + FIELD_DEPTH, record.depth, true);
    view.setUint32(offset + FIELD_FLAGS, flags, true);

    bytes.set(pathBytes, tailOffset);
    tailOffset += pathBytes.byteLength;
  }

  return buffer;
}

function buildFlatBuffersMetadata(rows) {
  const builder = new Builder(Math.max(1024, rows.length * 64));
  builder.forceDefaults(true);
  const pathOffsets = rows.map((record) => builder.createString(record.path));
  const assetOffsets = new Array(rows.length);

  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    const flags = assetFlags(record);

    builder.startObject(7);
    builder.addFieldInt32(0, record.pathHash | 0, 0);
    builder.addFieldInt16(1, fixture.kindCodes[record.kind], 0);
    builder.addFieldInt16(2, fixture.extensionCodes[record.extension], 0);
    builder.addFieldInt32(3, record.byteLength | 0, 0);
    builder.addFieldOffset(4, pathOffsets[index], 0);
    builder.addFieldInt16(5, record.depth, 0);
    builder.addFieldInt32(6, flags | 0, 0);
    assetOffsets[index] = builder.endObject();
  }

  builder.startVector(4, rows.length, 4);
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    builder.addOffset(assetOffsets[index]);
  }
  const assetsVector = builder.endVector();

  builder.startObject(1);
  builder.addFieldOffset(0, assetsVector, 0);
  const batch = builder.endObject();
  builder.finish(batch);

  const bytes = new Uint8Array(builder.asUint8Array());
  const buffer = new ByteBuffer(bytes);
  return {
    bytes,
    buffer,
    root: FbAssetMetadataBatch.getRootAsAssetMetadataBatch(buffer),
  };
}

function assetFlags(record) {
  let flags = 0;

  if (record.path.startsWith("textures/")) {
    flags |= 1;
  }

  if (record.path.startsWith("geometries/")) {
    flags |= 2;
  }

  if (record.byteLength >= 128 * 1024) {
    flags |= 4;
  }

  if (record.extension === ".jpg" || record.extension === ".png") {
    flags |= 8;
  }

  return flags;
}

function scanJsonMetadata(rows) {
  let checksum = 0;
  let textureBytes = 0;
  let audioCount = 0;
  let geometryBytes = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];

    if (record.kind === "texture") {
      textureBytes += record.byteLength;
    }

    if (record.kind === "audio") {
      audioCount += 1;
    }

    if (record.path.startsWith("geometries/")) {
      geometryBytes += record.byteLength;
    }
  }

  checksum = mix32(checksum, textureBytes);
  checksum = mix32(checksum, audioCount);
  checksum = mix32(checksum, geometryBytes);
  return checksum;
}

function scanBinaryScalarMetadata(view) {
  const count = view.getUint32(0, true);
  let textureBytes = 0;
  let textureImageCount = 0;
  let audioCount = 0;
  let largeAssetCount = 0;

  for (let index = 0; index < count; index += 1) {
    const offset = HEADER_BYTES + index * STRIDE;
    const kind = view.getUint16(offset + FIELD_KIND, true);
    const extension = view.getUint16(offset + FIELD_EXTENSION, true);
    const byteLength = view.getUint32(offset + FIELD_BYTE_LENGTH, true);
    const flags = view.getUint32(offset + FIELD_FLAGS, true);

    if (kind === KIND_TEXTURE) {
      textureBytes += byteLength;
    }

    if (kind === KIND_AUDIO) {
      audioCount += 1;
    }

    if (kind === KIND_TEXTURE && (extension === EXTENSION_JPG || extension === EXTENSION_PNG)) {
      textureImageCount += 1;
    }

    if ((flags & 4) !== 0) {
      largeAssetCount += 1;
    }
  }

  let checksum = 0;
  checksum = mix32(checksum, textureBytes);
  checksum = mix32(checksum, textureImageCount);
  checksum = mix32(checksum, audioCount);
  checksum = mix32(checksum, largeAssetCount);
  return checksum;
}

function scanBinaryPathPrefixMetadata(view) {
  const count = view.getUint32(0, true);
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  let geometryBytes = 0;
  let texturePathCount = 0;
  let checksum = 0;

  for (let index = 0; index < count; index += 1) {
    const offset = HEADER_BYTES + index * STRIDE;
    const kind = view.getUint16(offset + FIELD_KIND, true);
    const byteLength = view.getUint32(offset + FIELD_BYTE_LENGTH, true);
    const pathOffset = view.getUint32(offset + FIELD_PATH_OFFSET, true);
    const pathLength = view.getUint16(offset + FIELD_PATH_LENGTH, true);

    if (
      kind === KIND_GEOMETRY &&
      startsWithBytes(bytes, pathOffset, pathLength, GEOMETRY_PREFIX_BYTES)
    ) {
      geometryBytes += byteLength;
    }

    if (startsWithBytes(bytes, pathOffset, pathLength, TEXTURE_PREFIX_BYTES)) {
      texturePathCount += 1;
    }
  }

  checksum = mix32(checksum, geometryBytes);
  checksum = mix32(checksum, texturePathCount);
  return checksum;
}

function scanFlatBuffersScalarMetadata(root) {
  const count = root.assetsLength();
  const asset = new FbAssetMetadata();
  let textureBytes = 0;
  let textureImageCount = 0;
  let audioCount = 0;
  let largeAssetCount = 0;

  for (let index = 0; index < count; index += 1) {
    root.assets(index, asset);
    const kind = asset.kind();
    const extension = asset.extension();
    const byteLength = asset.byteLength();
    const flags = asset.flags();

    if (kind === KIND_TEXTURE) {
      textureBytes += byteLength;
    }

    if (kind === KIND_AUDIO) {
      audioCount += 1;
    }

    if (kind === KIND_TEXTURE && (extension === EXTENSION_JPG || extension === EXTENSION_PNG)) {
      textureImageCount += 1;
    }

    if ((flags & 4) !== 0) {
      largeAssetCount += 1;
    }
  }

  let checksum = 0;
  checksum = mix32(checksum, textureBytes);
  checksum = mix32(checksum, textureImageCount);
  checksum = mix32(checksum, audioCount);
  checksum = mix32(checksum, largeAssetCount);
  return checksum;
}

function scanFlatBuffersPathPrefixMetadata(root) {
  const count = root.assetsLength();
  const asset = new FbAssetMetadata();
  let geometryBytes = 0;
  let texturePathCount = 0;
  let checksum = 0;

  for (let index = 0; index < count; index += 1) {
    root.assets(index, asset);
    const pathBytes = asset.pathBytes();

    if (
      asset.kind() === KIND_GEOMETRY &&
      startsWithBytes(pathBytes, 0, pathBytes.byteLength, GEOMETRY_PREFIX_BYTES)
    ) {
      geometryBytes += asset.byteLength();
    }

    if (startsWithBytes(pathBytes, 0, pathBytes.byteLength, TEXTURE_PREFIX_BYTES)) {
      texturePathCount += 1;
    }
  }

  checksum = mix32(checksum, geometryBytes);
  checksum = mix32(checksum, texturePathCount);
  return checksum;
}

function startsWithBytes(bytes, offset, byteLength, prefix) {
  if (byteLength < prefix.byteLength) {
    return false;
  }

  for (let index = 0; index < prefix.byteLength; index += 1) {
    if (bytes[offset + index] !== prefix[index]) {
      return false;
    }
  }

  return true;
}

function measure(label, run) {
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
  const stats = { median, p95, p99, std, medianNsPerRecord: nsPerRecord(median), samples };

  console.log(
    `${label}: median=${median.toFixed(2)} ms p95=${p95.toFixed(2)} ms p99=${p99.toFixed(2)} ms std=${std.toFixed(2)} ms median=${stats.medianNsPerRecord.toFixed(2)} ns/record checksum=${checksum}`,
  );

  return { checksum, stats };
}

function compareToBaseline(label, baseline, comparison) {
  const delta = comparison.median - baseline.median;
  const pooledStd = Math.sqrt(baseline.std ** 2 + comparison.std ** 2);
  const deltaNs = nsPerRecord(delta);
  const pooledStdNs = nsPerRecord(pooledStd);
  const status = Math.abs(delta) <= pooledStd ? "within-noise" : "above-noise";
  console.log(
    `  ${label}: delta=${delta.toFixed(2)} ms (${deltaNs.toFixed(2)} ns/record), pooled-std=${pooledStd.toFixed(2)} ms (${pooledStdNs.toFixed(2)} ns/record), ${status}`,
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

function nsPerRecord(milliseconds) {
  return (milliseconds * 1_000_000) / RECORD_COUNT;
}

function mix32(checksum, value) {
  checksum ^= value;
  return Math.imul(checksum, 0x45d9f3b) >>> 0;
}

function assertSameChecksum(label, left, right) {
  if (left !== right) {
    throw new Error(`${label} checksum mismatch: ${left} !== ${right}`);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KiB", "MiB", "GiB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}
