import { performance } from "node:perf_hooks";

import {
  BytesSpanView,
  BytesVectorView,
  DynamicLayoutWriter,
  ScalarVectorView,
  Utf8SpanView,
  Utf8VectorView,
  equalsAscii,
  readSpan32Descriptor,
  readVector32Descriptor,
  writeSpan32Descriptor,
  writeVector32Descriptor,
} from "../../packages/runtime/dist/index.js";

const RECORD_COUNT = Number(process.env.ZENO_DYNAMIC_BENCH_RECORDS ?? 100_000);
const WARMUP_RUNS = Number(process.env.ZENO_DYNAMIC_BENCH_WARMUP ?? 3);
const MEASURE_RUNS = Number(process.env.ZENO_DYNAMIC_BENCH_RUNS ?? 25);
const SPAN32 = 8;
const VECTOR32 = 8;
const sharedEncoder = new TextEncoder();
const sharedDecoder = new TextDecoder();
const TEXT = "zeno-dynamic-payload";
const TEXT_BYTES = sharedEncoder.encode(TEXT);
const BYTE_PAYLOAD = Uint8Array.from({ length: 32 }, (_, index) => ((index + 1) * 17) & 0xff);

if (typeof globalThis.gc !== "function") {
  console.error("Run with --expose-gc so retained memory measurements are meaningful.");
  process.exit(1);
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

function mixByte(checksum, value) {
  return ((checksum << 5) - checksum + value) | 0;
}

function hashBytes(bytes, checksum = 0) {
  for (let index = 0; index < bytes.length; index += 1) {
    checksum = mixByte(checksum, bytes[index]);
  }
  return checksum;
}

function hashDataViewBytes(view, offset, byteLength, checksum = 0) {
  for (let index = 0; index < byteLength; index += 1) {
    checksum = mixByte(checksum, view.getUint8(offset + index));
  }
  return checksum;
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

function measureRetainedMemory(label, run) {
  for (let index = 0; index < WARMUP_RUNS; index += 1) {
    run();
  }

  forceGc();
  const before = process.memoryUsage();
  const checksum = Number(run());
  forceGc();
  const after = process.memoryUsage();
  const heapDeltaKiB = (after.heapUsed - before.heapUsed) / 1024;
  const externalDeltaKiB = (after.external - before.external) / 1024;
  console.log(
    `${label} retained-memory: heapDelta=${heapDeltaKiB.toFixed(2)} KiB externalDelta=${externalDeltaKiB.toFixed(2)} KiB checksum=${checksum}`,
  );
  return { checksum, heapDeltaKiB, externalDeltaKiB };
}

function compareToBaseline(label, baseline, candidate) {
  const delta = candidate.median - baseline.median;
  const pooledStd = Math.sqrt(baseline.std ** 2 + candidate.std ** 2);
  const ratio = pooledStd === 0 ? Number.POSITIVE_INFINITY : Math.abs(delta) / pooledStd;
  const status = Math.abs(delta) > pooledStd ? "above-noise" : "within-noise";
  console.log(
    `  ${label}: delta=${delta.toFixed(2)} ms (${nsPerRecord(delta).toFixed(2)} ns/record), pooled-std=${pooledStd.toFixed(2)} ms (${nsPerRecord(pooledStd).toFixed(2)} ns/record), ratio=${ratio.toFixed(2)}x, ${status}`,
  );
}

function makeSpanFixture(count, payload) {
  const headLength = count * SPAN32;
  const buffer = new ArrayBuffer(headLength + count * payload.length);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  for (let index = 0; index < count; index += 1) {
    const payloadOffset = headLength + index * payload.length;
    writeSpan32Descriptor(view, index * SPAN32, {
      relOffset: payloadOffset,
      byteLength: payload.length,
    });
    bytes.set(payload, payloadOffset);
  }

  return { buffer, view };
}

function directSpanBytesPass(view, count) {
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    const descriptor = readSpan32Descriptor(view, index * SPAN32);
    checksum = hashBytes(
      new Uint8Array(view.buffer, descriptor.relOffset, descriptor.byteLength),
      checksum,
    );
  }
  return checksum;
}

function directSpanBytesDataViewPass(view, count) {
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    const descriptor = readSpan32Descriptor(view, index * SPAN32);
    checksum = hashDataViewBytes(view, descriptor.relOffset, descriptor.byteLength, checksum);
  }
  return checksum;
}

function zenoSpanBytesPass(view, count) {
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    checksum = hashBytes(new BytesSpanView(view, index * SPAN32).bytes(), checksum);
  }
  return checksum;
}

function directUtf8DecodePass(view, count) {
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    const descriptor = readSpan32Descriptor(view, index * SPAN32);
    checksum += sharedDecoder.decode(
      new Uint8Array(view.buffer, descriptor.relOffset, descriptor.byteLength),
    ).length;
  }
  return checksum;
}

function zenoUtf8DecodePass(view, count) {
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    checksum += new Utf8SpanView(view, index * SPAN32).text().length;
  }
  return checksum;
}

function zenoUtf8EqualsAsciiPass(view, count) {
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    checksum += equalsAscii(new Utf8SpanView(view, index * SPAN32).bytes(), TEXT) ? 1 : 0;
  }
  return checksum;
}

function makeScalarVectorFixture(count) {
  const buffer = new ArrayBuffer(VECTOR32 + count * 4);
  const view = new DataView(buffer);
  writeVector32Descriptor(view, 0, { relOffset: VECTOR32, count });
  for (let index = 0; index < count; index += 1) {
    view.setInt32(VECTOR32 + index * 4, index % 120, true);
  }
  return { buffer, view };
}

function directScalarVectorPass(view, count) {
  const descriptor = readVector32Descriptor(view, 0);
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    checksum += view.getInt32(descriptor.relOffset + index * 4, true);
  }
  return checksum;
}

function zenoScalarVectorPass(view, count) {
  const vector = new ScalarVectorView(view, 0, "i32");
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    checksum += vector.at(index);
  }
  return checksum;
}

function zenoScalarVectorNativeArrayPass(view) {
  const values = new ScalarVectorView(view, 0, "i32").nativeArray();
  let checksum = 0;
  for (let index = 0; index < values.length; index += 1) {
    checksum += values[index];
  }
  return checksum;
}

function makeBytesVectorFixture(count, payload = BYTE_PAYLOAD) {
  const tableOffset = VECTOR32;
  const payloadOffset = tableOffset + count * SPAN32;
  const buffer = new ArrayBuffer(payloadOffset + count * payload.length);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  writeVector32Descriptor(view, 0, { relOffset: tableOffset, count });

  for (let index = 0; index < count; index += 1) {
    const offset = payloadOffset + index * payload.length;
    writeSpan32Descriptor(view, tableOffset + index * SPAN32, {
      relOffset: offset,
      byteLength: payload.length,
    });
    bytes.set(payload, offset);
  }

  return { buffer, view };
}

function directBytesVectorPass(view, count) {
  const vector = readVector32Descriptor(view, 0);
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    const span = readSpan32Descriptor(view, vector.relOffset + index * SPAN32);
    checksum = hashBytes(new Uint8Array(view.buffer, span.relOffset, span.byteLength), checksum);
  }
  return checksum;
}

function zenoBytesVectorPass(view, count) {
  const vector = new BytesVectorView(view, 0);
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    checksum = hashBytes(vector.bytesAt(index), checksum);
  }
  return checksum;
}

function makeUtf8VectorFixture(count) {
  return makeBytesVectorFixture(count, TEXT_BYTES);
}

function directUtf8VectorDecodePass(view, count) {
  const vector = readVector32Descriptor(view, 0);
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    const span = readSpan32Descriptor(view, vector.relOffset + index * SPAN32);
    checksum += sharedDecoder.decode(
      new Uint8Array(view.buffer, span.relOffset, span.byteLength),
    ).length;
  }
  return checksum;
}

function zenoUtf8VectorDecodePass(view, count) {
  const vector = new Utf8VectorView(view, 0);
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    checksum += vector.textAt(index).length;
  }
  return checksum;
}

function jsonStringParsePass(jsonPayload) {
  let checksum = 0;
  const rows = JSON.parse(jsonPayload);
  for (const row of rows) {
    checksum += row.length;
  }
  return checksum;
}

function writerUtf8Pass(count) {
  const buffer = new ArrayBuffer(count * SPAN32 + count * TEXT_BYTES.length);
  const writer = new DynamicLayoutWriter(new DataView(buffer), count * SPAN32);
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    checksum += writer.writeUtf8(index * SPAN32, TEXT).byteLength;
  }
  return checksum;
}

function manualWriterUtf8Pass(count) {
  const headLength = count * SPAN32;
  const buffer = new ArrayBuffer(headLength + count * TEXT_BYTES.length);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let payloadOffset = headLength;
  let checksum = 0;

  for (let index = 0; index < count; index += 1) {
    const encoded = sharedEncoder.encode(TEXT);
    writeSpan32Descriptor(view, index * SPAN32, {
      relOffset: payloadOffset,
      byteLength: encoded.length,
    });
    bytes.set(encoded, payloadOffset);
    payloadOffset += encoded.length;
    checksum += encoded.length;
  }

  return checksum;
}

function writerBytesPass(count) {
  const buffer = new ArrayBuffer(count * SPAN32 + count * TEXT_BYTES.length);
  const writer = new DynamicLayoutWriter(new DataView(buffer), count * SPAN32);
  let checksum = 0;
  for (let index = 0; index < count; index += 1) {
    checksum += writer.writeBytes(index * SPAN32, TEXT_BYTES).byteLength;
  }
  return checksum;
}

function manualWriterBytesPass(count) {
  const headLength = count * SPAN32;
  const buffer = new ArrayBuffer(headLength + count * TEXT_BYTES.length);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let payloadOffset = headLength;
  let checksum = 0;

  for (let index = 0; index < count; index += 1) {
    writeSpan32Descriptor(view, index * SPAN32, {
      relOffset: payloadOffset,
      byteLength: TEXT_BYTES.length,
    });
    bytes.set(TEXT_BYTES, payloadOffset);
    payloadOffset += TEXT_BYTES.length;
    checksum += TEXT_BYTES.length;
  }

  return checksum;
}

function writerScalarVectorPass(count) {
  const values = Array.from({ length: count }, (_, index) => index % 120);
  const buffer = new ArrayBuffer(VECTOR32 + count * 4);
  const writer = new DynamicLayoutWriter(new DataView(buffer), VECTOR32);
  return writer.writeScalarVector(0, "i32", values).count;
}

function manualWriterScalarVectorPass(count) {
  const values = Array.from({ length: count }, (_, index) => index % 120);
  const buffer = new ArrayBuffer(VECTOR32 + count * 4);
  const view = new DataView(buffer);
  writeVector32Descriptor(view, 0, { relOffset: VECTOR32, count });
  for (let index = 0; index < count; index += 1) {
    view.setInt32(VECTOR32 + index * 4, values[index], true);
  }
  return count;
}

const textSpan = makeSpanFixture(RECORD_COUNT, TEXT_BYTES);
const bytesSpan = makeSpanFixture(RECORD_COUNT, BYTE_PAYLOAD);
const scalarVector = makeScalarVectorFixture(RECORD_COUNT);
const bytesVector = makeBytesVectorFixture(RECORD_COUNT);
const utf8Vector = makeUtf8VectorFixture(RECORD_COUNT);
const jsonTextPayload = JSON.stringify(Array.from({ length: RECORD_COUNT }, () => TEXT));

console.log("Zeno dynamic layout benchmark");
console.log(
  `records=${RECORD_COUNT} warmup=${WARMUP_RUNS} runs=${MEASURE_RUNS} textBytes=${TEXT_BYTES.length} rawBytes=${BYTE_PAYLOAD.length}`,
);

const directBytesSpanDataView = measure("direct span bytes DataView", () =>
  directSpanBytesDataViewPass(bytesSpan.view, RECORD_COUNT),
);
const directBytesSpan = measure("direct span bytes Uint8Array", () =>
  directSpanBytesPass(bytesSpan.view, RECORD_COUNT),
);
const zenoBytesSpan = measure("Zeno BytesSpanView.bytes()", () =>
  zenoSpanBytesPass(bytesSpan.view, RECORD_COUNT),
);
compareToBaseline(
  "BytesSpanView.bytes() vs DataView",
  directBytesSpanDataView.stats,
  zenoBytesSpan.stats,
);
compareToBaseline("BytesSpanView.bytes()", directBytesSpan.stats, zenoBytesSpan.stats);

const directUtf8 = measure("direct UTF-8 decode", () =>
  directUtf8DecodePass(textSpan.view, RECORD_COUNT),
);
const zenoUtf8 = measure("Zeno Utf8SpanView.text()", () =>
  zenoUtf8DecodePass(textSpan.view, RECORD_COUNT),
);
const zenoUtf8EqualsAscii = measure("Zeno Utf8SpanView.bytes() + equalsAscii", () =>
  zenoUtf8EqualsAsciiPass(textSpan.view, RECORD_COUNT),
);
const jsonParse = measure("JSON.parse string array", () => jsonStringParsePass(jsonTextPayload));
compareToBaseline("Utf8SpanView.text()", directUtf8.stats, zenoUtf8.stats);
compareToBaseline("Utf8SpanView.bytes() + equalsAscii", zenoUtf8.stats, zenoUtf8EqualsAscii.stats);
compareToBaseline("JSON.parse string array", directUtf8.stats, jsonParse.stats);

const directScalarVector = measure("direct scalar vector i32", () =>
  directScalarVectorPass(scalarVector.view, RECORD_COUNT),
);
const zenoScalarVector = measure("Zeno ScalarVectorView.at(i)", () =>
  zenoScalarVectorPass(scalarVector.view, RECORD_COUNT),
);
compareToBaseline("ScalarVectorView.at(i)", directScalarVector.stats, zenoScalarVector.stats);
const zenoScalarVectorNative = measure("Zeno ScalarVectorView.nativeArray()", () =>
  zenoScalarVectorNativeArrayPass(scalarVector.view),
);
compareToBaseline(
  "ScalarVectorView.nativeArray()",
  directScalarVector.stats,
  zenoScalarVectorNative.stats,
);

const directBytesVector = measure("direct bytes vector", () =>
  directBytesVectorPass(bytesVector.view, RECORD_COUNT),
);
const zenoBytesVector = measure("Zeno BytesVectorView.bytesAt(i)", () =>
  zenoBytesVectorPass(bytesVector.view, RECORD_COUNT),
);
const directUtf8Vector = measure("direct UTF-8 vector decode", () =>
  directUtf8VectorDecodePass(utf8Vector.view, RECORD_COUNT),
);
const zenoUtf8Vector = measure("Zeno Utf8VectorView.textAt(i)", () =>
  zenoUtf8VectorDecodePass(utf8Vector.view, RECORD_COUNT),
);
compareToBaseline("BytesVectorView.bytesAt(i)", directBytesVector.stats, zenoBytesVector.stats);
compareToBaseline("Utf8VectorView.textAt(i)", directUtf8Vector.stats, zenoUtf8Vector.stats);

const manualUtf8Writer = measure("manual writeUtf8", () => manualWriterUtf8Pass(RECORD_COUNT));
const writerUtf8 = measure("DynamicLayoutWriter.writeUtf8", () => writerUtf8Pass(RECORD_COUNT));
compareToBaseline("DynamicLayoutWriter.writeUtf8", manualUtf8Writer.stats, writerUtf8.stats);
const manualBytesWriter = measure("manual writeBytes", () => manualWriterBytesPass(RECORD_COUNT));
const writerBytes = measure("DynamicLayoutWriter.writeBytes", () => writerBytesPass(RECORD_COUNT));
compareToBaseline("DynamicLayoutWriter.writeBytes", manualBytesWriter.stats, writerBytes.stats);
const manualScalarWriter = measure("manual writeScalarVector", () =>
  manualWriterScalarVectorPass(RECORD_COUNT),
);
const writerScalar = measure("DynamicLayoutWriter.writeScalarVector", () =>
  writerScalarVectorPass(RECORD_COUNT),
);
compareToBaseline(
  "DynamicLayoutWriter.writeScalarVector",
  manualScalarWriter.stats,
  writerScalar.stats,
);
console.log(
  `writer checksums: utf8=${writerUtf8.checksum}, bytes=${writerBytes.checksum}, scalarVector=${writerScalar.checksum}`,
);

console.log("Retained memory witnesses");
measureRetainedMemory("BytesSpanView.bytes()", () =>
  zenoSpanBytesPass(bytesSpan.view, RECORD_COUNT),
);
measureRetainedMemory("Utf8SpanView.text()", () => zenoUtf8DecodePass(textSpan.view, RECORD_COUNT));
measureRetainedMemory("Utf8SpanView.bytes() + equalsAscii", () =>
  zenoUtf8EqualsAsciiPass(textSpan.view, RECORD_COUNT),
);
measureRetainedMemory("ScalarVectorView.at(i)", () =>
  zenoScalarVectorPass(scalarVector.view, RECORD_COUNT),
);
measureRetainedMemory("ScalarVectorView.nativeArray()", () =>
  zenoScalarVectorNativeArrayPass(scalarVector.view),
);
measureRetainedMemory("DynamicLayoutWriter.writeUtf8", () => writerUtf8Pass(RECORD_COUNT));
