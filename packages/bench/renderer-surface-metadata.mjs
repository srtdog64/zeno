import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "renderer-surface-metadata.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

const RECORD_COUNT = Number(process.env.ZENO_RENDERER_SURFACE_BENCH_RECORDS ?? 200_000);
const WARMUP_RUNS = Number(process.env.ZENO_RENDERER_SURFACE_BENCH_WARMUP ?? 3);
const MEASURE_RUNS = Number(process.env.ZENO_RENDERER_SURFACE_BENCH_RUNS ?? 25);
const STRIDE = 24;
const HEADER_BYTES = 8;
const FIELD_PROJECT_ID = 0;
const FIELD_KIND = 2;
const FIELD_EXTENSION = 4;
const FIELD_PATH_HASH = 8;
const FIELD_BYTE_LENGTH = 12;
const FIELD_DEPTH = 16;
const FIELD_FLAGS = 20;

const KIND_TEXTURE = fixture.kindCodes.texture;
const KIND_SCRIPT = fixture.kindCodes.script;
const KIND_METADATA = fixture.kindCodes.metadata;
const EXTENSION_PNG = extensionCode(".png");

if (typeof globalThis.gc !== "function") {
  console.error("Run with --expose-gc so retained memory measurements are meaningful.");
  process.exit(1);
}

const sourceRows = flattenRecords(fixture);
const records = expandRecords(sourceRows, RECORD_COUNT);
const jsonPayload = JSON.stringify(records);
const binaryPayload = packBinaryMetadata(records);
const binaryView = new DataView(binaryPayload);

console.log("Zeno renderer-surface metadata benchmark");
console.log(
  `sources: ${fixture.projects.map((project) => `${project.source.name}@${project.source.commit.slice(0, 8)}`).join(", ")}`,
);
console.log(`source metadata rows: ${sourceRows.length.toLocaleString("en-US")}`);
console.log(`scaled rows: ${records.length.toLocaleString("en-US")}`);
console.log(`json payload: ${formatBytes(Buffer.byteLength(jsonPayload))}`);
console.log(`binary payload: ${formatBytes(binaryPayload.byteLength)}`);
console.log(`warmup runs: ${WARMUP_RUNS}`);
console.log(`measured runs: ${MEASURE_RUNS}`);
console.log("");

const parsedJsonScan = measure("JSON pre-parsed renderer-surface scan", () =>
  scanJsonMetadata(records),
);
const jsonParseScan = measure("JSON.parse + renderer-surface scan", () =>
  scanJsonMetadata(JSON.parse(jsonPayload)),
);
const binaryScan = measure("Zeno binary renderer-surface scan", () =>
  scanBinaryMetadata(binaryView),
);
const binaryQueuePack = measure("Zeno binary renderer queue pack", () =>
  packBinaryQueues(binaryView),
);
const binaryPack = measure(
  "Zeno binary renderer metadata pack",
  () => packBinaryMetadata(records).byteLength,
);

assertSameChecksum("json/binary scan", parsedJsonScan.checksum, binaryScan.checksum);

console.log("");
console.log("Deltas vs JSON.parse + scan");
compareToBaseline("JSON pre-parsed scan", jsonParseScan.stats, parsedJsonScan.stats);
compareToBaseline("Zeno binary renderer-surface scan", jsonParseScan.stats, binaryScan.stats);
compareToBaseline("Zeno binary renderer queue pack", jsonParseScan.stats, binaryQueuePack.stats);
compareToBaseline("Zeno binary renderer metadata pack", jsonParseScan.stats, binaryPack.stats);

console.log("");
console.log(
  "Methodological note: renderer-surface fixtures contain public repository tree metadata only: path hashes, byte sizes, extensions, and kind tags. They do not store texture, audio, model, or source payload bytes.",
);

function flattenRecords(fixtureData) {
  const output = [];

  for (let projectId = 0; projectId < fixtureData.projects.length; projectId += 1) {
    const project = fixtureData.projects[projectId];

    for (const record of project.records) {
      output.push({
        projectId,
        kindCode: record.kindCode,
        extensionCode: extensionCode(record.extension),
        pathHash: record.pathHash,
        byteLength: record.byteLength,
        depth: record.depth,
        flags: assetFlags(record),
      });
    }
  }

  return output;
}

function expandRecords(rows, targetCount) {
  const expanded = [];

  for (let index = 0; index < targetCount; index += 1) {
    expanded.push(rows[index % rows.length]);
  }

  return expanded;
}

function packBinaryMetadata(rows) {
  const buffer = new ArrayBuffer(HEADER_BYTES + rows.length * STRIDE);
  const view = new DataView(buffer);

  view.setUint32(0, rows.length, true);
  view.setUint32(4, STRIDE, true);

  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];
    const offset = HEADER_BYTES + index * STRIDE;

    view.setUint16(offset + FIELD_PROJECT_ID, record.projectId, true);
    view.setUint16(offset + FIELD_KIND, record.kindCode, true);
    view.setUint16(offset + FIELD_EXTENSION, record.extensionCode, true);
    view.setUint16(offset + FIELD_DEPTH, record.depth, true);
    view.setUint32(offset + FIELD_PATH_HASH, record.pathHash, true);
    view.setUint32(offset + FIELD_BYTE_LENGTH, record.byteLength, true);
    view.setUint32(offset + FIELD_FLAGS, record.flags, true);
  }

  return buffer;
}

function scanJsonMetadata(rows) {
  let textureBytes = 0;
  let scriptCount = 0;
  let metadataCount = 0;
  let pngTextureCount = 0;
  let largeRendererPayloadCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const record = rows[index];

    if (record.kindCode === KIND_TEXTURE) {
      textureBytes += record.byteLength;
    }

    if (record.kindCode === KIND_SCRIPT) {
      scriptCount += 1;
    }

    if (record.kindCode === KIND_METADATA) {
      metadataCount += 1;
    }

    if (record.kindCode === KIND_TEXTURE && record.extensionCode === EXTENSION_PNG) {
      pngTextureCount += 1;
    }

    if ((record.flags & 0b101) === 0b101) {
      largeRendererPayloadCount += 1;
    }
  }

  let checksum = 0;
  checksum = mix32(checksum, textureBytes);
  checksum = mix32(checksum, scriptCount);
  checksum = mix32(checksum, metadataCount);
  checksum = mix32(checksum, pngTextureCount);
  checksum = mix32(checksum, largeRendererPayloadCount);
  return checksum;
}

function scanBinaryMetadata(view) {
  const count = view.getUint32(0, true);
  let textureBytes = 0;
  let scriptCount = 0;
  let metadataCount = 0;
  let pngTextureCount = 0;
  let largeRendererPayloadCount = 0;

  for (let index = 0; index < count; index += 1) {
    const offset = HEADER_BYTES + index * STRIDE;
    const kind = view.getUint16(offset + FIELD_KIND, true);
    const extension = view.getUint16(offset + FIELD_EXTENSION, true);
    const byteLength = view.getUint32(offset + FIELD_BYTE_LENGTH, true);
    const flags = view.getUint32(offset + FIELD_FLAGS, true);

    if (kind === KIND_TEXTURE) {
      textureBytes += byteLength;
    }

    if (kind === KIND_SCRIPT) {
      scriptCount += 1;
    }

    if (kind === KIND_METADATA) {
      metadataCount += 1;
    }

    if (kind === KIND_TEXTURE && extension === EXTENSION_PNG) {
      pngTextureCount += 1;
    }

    if ((flags & 0b101) === 0b101) {
      largeRendererPayloadCount += 1;
    }
  }

  let checksum = 0;
  checksum = mix32(checksum, textureBytes);
  checksum = mix32(checksum, scriptCount);
  checksum = mix32(checksum, metadataCount);
  checksum = mix32(checksum, pngTextureCount);
  checksum = mix32(checksum, largeRendererPayloadCount);
  return checksum;
}

function packBinaryQueues(view) {
  const count = view.getUint32(0, true);
  const textureQueue = new Uint32Array(count * 3);
  const scriptQueue = new Uint32Array(count * 3);
  let textureIndex = 0;
  let scriptIndex = 0;

  for (let index = 0; index < count; index += 1) {
    const offset = HEADER_BYTES + index * STRIDE;
    const kind = view.getUint16(offset + FIELD_KIND, true);

    if (kind !== KIND_TEXTURE && kind !== KIND_SCRIPT) {
      continue;
    }

    const queue = kind === KIND_TEXTURE ? textureQueue : scriptQueue;
    const outputIndex = kind === KIND_TEXTURE ? textureIndex : scriptIndex;
    const out = outputIndex * 3;

    queue[out] = view.getUint32(offset + FIELD_PATH_HASH, true);
    queue[out + 1] = view.getUint32(offset + FIELD_BYTE_LENGTH, true);
    queue[out + 2] = view.getUint16(offset + FIELD_EXTENSION, true);

    if (kind === KIND_TEXTURE) {
      textureIndex += 1;
    } else {
      scriptIndex += 1;
    }
  }

  let checksum = 0;
  checksum = mix32(checksum, textureIndex);
  checksum = mix32(checksum, scriptIndex);
  checksum = mix32(checksum, textureQueue[1] ?? 0);
  checksum = mix32(checksum, scriptQueue[1] ?? 0);
  return checksum;
}

function extensionCode(extension) {
  switch (extension) {
    case ".png":
      return 1;
    case ".jpg":
      return 2;
    case ".jpeg":
      return 3;
    case ".webp":
      return 4;
    case ".ogg":
      return 5;
    case ".mp3":
      return 6;
    case ".glsl":
    case ".vert":
    case ".frag":
      return 7;
    case ".js":
    case ".mjs":
      return 8;
    case ".json":
      return 9;
    case ".css":
      return 10;
    default:
      return 0;
  }
}

function assetFlags(record) {
  const large = record.byteLength >= 1024 * 1024;
  const nested = record.depth > 2;
  const rendererPayload =
    record.kindCode === KIND_TEXTURE ||
    record.kindCode === fixture.kindCodes.geometry ||
    record.kindCode === fixture.kindCodes.shader;

  return (large ? 0b001 : 0) | (nested ? 0b010 : 0) | (rendererPayload ? 0b100 : 0);
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
