import { Buffer } from "node:buffer";
import { performance } from "node:perf_hooks";

import { histogramU16Field } from "../../packages/buffers/dist/index.js";

const NODE_COUNT = Number(process.env.ZENO_GRAPH_INDEX_BENCH_NODES ?? 40_000);
const EDGE_COUNT = Number(process.env.ZENO_GRAPH_INDEX_BENCH_EDGES ?? 160_000);
const WARMUP_RUNS = Number(process.env.ZENO_GRAPH_INDEX_BENCH_WARMUP ?? 3);
const MEASURE_RUNS = Number(process.env.ZENO_GRAPH_INDEX_BENCH_RUNS ?? 20);

const NODE_KIND_COUNT = 8;
const EDGE_KIND_COUNT = 10;

const NODE_STRIDE = 16;
const NODE_OFFSET_KIND = 0;
const NODE_OFFSET_FLAGS = 4;
const NODE_OFFSET_LAYER_MASK = 8;
const NODE_OFFSET_ID_INDEX = 12;

const EDGE_STRIDE = 16;
const EDGE_OFFSET_SOURCE = 0;
const EDGE_OFFSET_TARGET = 4;
const EDGE_OFFSET_KIND = 8;
const EDGE_OFFSET_LAYER_MASK = 12;

const FLAGS_BYTE_MASK = 0xff;
const LAYER_BUCKET_COUNT = 8;
// These primes are fixture strides, not ABI constants. They keep the synthetic
// graph deterministic while spreading edges across many nodes instead of
// accidentally benchmarking a trivial local fanout pattern.
const GRAPH_SOURCE_STRIDE = 17;
const GRAPH_TARGET_STRIDE = 31;
// The checksum samples large derived arrays so the benchmark measures graph
// summary work, not only checksum traversal over every adjacency entry.
const SPARSE_CHECKSUM_SAMPLE_COUNT = 128;

if (typeof globalThis.gc !== "function") {
  console.error("Run with --expose-gc so retained memory measurements are meaningful.");
  process.exit(1);
}

forceGc();
const baseMemory = process.memoryUsage();
const objectGraph = createObjectGraph(NODE_COUNT, EDGE_COUNT);
forceGc();
const afterObjectMemory = process.memoryUsage();
const jsonPayload = JSON.stringify(objectGraph);
forceGc();
const afterJsonMemory = process.memoryUsage();
const numericObjectGraph = createNumericObjectGraph(NODE_COUNT, EDGE_COUNT);
forceGc();
const afterNumericObjectMemory = process.memoryUsage();
const typedGraph = createTypedGraphIndex(NODE_COUNT, EDGE_COUNT);
forceGc();
const afterTypedMemory = process.memoryUsage();
const binaryGraph = createBinaryGraphIndex(NODE_COUNT, EDGE_COUNT);
forceGc();
const afterBinaryMemory = process.memoryUsage();

console.log("Zeno diagram graph index benchmark");
console.log(`nodes=${NODE_COUNT.toLocaleString("en-US")}`);
console.log(`edges=${EDGE_COUNT.toLocaleString("en-US")}`);
console.log(`warmup runs=${WARMUP_RUNS}`);
console.log(`measured runs=${MEASURE_RUNS}`);
console.log("");
console.log("Fixture retained memory");
console.log(`  string-keyed object graph: ${formatMemoryDelta(baseMemory, afterObjectMemory)}`);
console.log(`  JSON payload: ${formatMemoryDelta(afterObjectMemory, afterJsonMemory)}`);
console.log(
  `  numeric-keyed object graph: ${formatMemoryDelta(afterJsonMemory, afterNumericObjectMemory)}`,
);
console.log(`  typed arrays: ${formatMemoryDelta(afterNumericObjectMemory, afterTypedMemory)}`);
console.log(`  binary rows: ${formatMemoryDelta(afterTypedMemory, afterBinaryMemory)}`);
console.log(`  JSON byte length: ${formatBytes(Buffer.byteLength(jsonPayload))}`);
console.log(`  typed-array payload: ${formatBytes(typedGraph.byteLength)}`);
console.log(
  `  binary payload: ${formatBytes(binaryGraph.nodeView.byteLength + binaryGraph.edgeView.byteLength)}`,
);
console.log("");

const objectSummary = measure("String-keyed object graph summary", EDGE_COUNT, () =>
  summarizeObjectGraph(objectGraph),
);
const jsonSummary = measure("JSON.parse + string-keyed object graph summary", EDGE_COUNT, () =>
  summarizeObjectGraph(JSON.parse(jsonPayload)),
);
const numericObjectSummary = measure(
  "Numeric-keyed object graph summary (no string lookup)",
  EDGE_COUNT,
  () => summarizeNumericObjectGraph(numericObjectGraph),
);
const typedSummary = measure("Interned typed-array graph index summary", EDGE_COUNT, () =>
  summarizeTypedGraphIndex(typedGraph),
);
const binarySummary = measure("Zeno binary graph index summary", EDGE_COUNT, () =>
  summarizeBinaryGraphIndex(binaryGraph),
);

assertSameChecksum("typed graph index", objectSummary.checksum, typedSummary.checksum);
assertSameChecksum("binary graph index", objectSummary.checksum, binarySummary.checksum);
assertSameChecksum("JSON graph summary", objectSummary.checksum, jsonSummary.checksum);
assertSameChecksum(
  "numeric-keyed object graph",
  objectSummary.checksum,
  numericObjectSummary.checksum,
);

console.log("");
console.log("Deltas vs string-keyed object graph summary");
compareToBaseline(
  "JSON.parse + string-keyed object graph summary",
  objectSummary.stats,
  jsonSummary.stats,
);
compareToBaseline(
  "Numeric-keyed object graph summary",
  objectSummary.stats,
  numericObjectSummary.stats,
);
compareToBaseline(
  "Interned typed-array graph index summary",
  objectSummary.stats,
  typedSummary.stats,
);
compareToBaseline("Zeno binary graph index summary", objectSummary.stats, binarySummary.stats);

console.log("");
console.log("Deltas vs numeric-keyed object graph summary (fair baseline)");
compareToBaseline(
  "Interned typed-array graph index summary",
  numericObjectSummary.stats,
  typedSummary.stats,
);
compareToBaseline(
  "Zeno binary graph index summary",
  numericObjectSummary.stats,
  binarySummary.stats,
);

console.log("");
console.log("Methodological notes:");
console.log(
  "  Scope: this models a Diagram Studio-style object graph lowered into a rebuildable numeric index. String labels, memos, and editor state stay in JSON/object form; the binary path only owns repeated topology scans over interned node and edge rows.",
);
console.log(
  "  Cost amortization: each run measures one summary pass. Building the binary index from the source object graph or JSON is excluded. Binary only pays for itself when the index is reused across many summary passes between rebuilds; for a single-shot summary the rebuild cost dominates.",
);
console.log(
  "  Fair baseline: the string-keyed object summary includes a Map.get per edge endpoint. The numeric-keyed object summary removes that lookup, isolating the access-pattern difference from the string-interning difference. Compare against the numeric-keyed baseline when judging what Zeno's binary representation contributes versus what numeric interning alone contributes.",
);
console.log(
  "  Topology: synthetic graph uses prime-stride edge generation. Degree distribution is uniform, no self-loops, no multi-edges, no isolated nodes. Real Diagram-style graphs have power-law degree, hubs, and self-loops; expect the deltas here to be optimistic for any path that benefits from cache-friendly access (typed, binary).",
);
console.log(
  `  Checksum: outDegree/inDegree/adjacency are sampled at ${SPARSE_CHECKSUM_SAMPLE_COUNT} positions, not exhaustive. Semantic equivalence is verified at this resolution, not byte-for-byte across all derived rows.`,
);
console.log(
  "  Attribution: the buffers package contributes two histogramU16Field calls; the rest is hand-written DataView access. The bench shows that a fixed-row binary index keeps up with native typed-arrays, not that the buffers package is the reason. Zeno's value here is schema-driven row layout and type-safe accessor codegen, not raw scan speed.",
);

function createObjectGraph(nodeCount, edgeCount) {
  const nodes = new Array(nodeCount);
  const edges = new Array(edgeCount);

  for (let index = 0; index < nodeCount; index += 1) {
    nodes[index] = {
      id: nodeId(index),
      kind: index % NODE_KIND_COUNT,
      flags: fixtureFlags(index),
      layerMask: layerMask(index),
    };
  }

  for (let index = 0; index < edgeCount; index += 1) {
    const source = edgeSource(index, nodeCount);
    const target = edgeTarget(index, source, nodeCount);
    edges[index] = {
      source: nodeId(source),
      target: nodeId(target),
      kind: index % EDGE_KIND_COUNT,
      layerMask: layerMask(index),
    };
  }

  return { nodes, edges };
}

function createNumericObjectGraph(nodeCount, edgeCount) {
  const nodes = new Array(nodeCount);
  const edges = new Array(edgeCount);

  for (let index = 0; index < nodeCount; index += 1) {
    nodes[index] = {
      index,
      kind: index % NODE_KIND_COUNT,
      flags: fixtureFlags(index),
      layerMask: layerMask(index),
    };
  }

  for (let index = 0; index < edgeCount; index += 1) {
    const source = edgeSource(index, nodeCount);
    edges[index] = {
      source,
      target: edgeTarget(index, source, nodeCount),
      kind: index % EDGE_KIND_COUNT,
      layerMask: layerMask(index),
    };
  }

  return { nodes, edges };
}

function createTypedGraphIndex(nodeCount, edgeCount) {
  const nodeKind = new Uint16Array(nodeCount);
  const nodeFlags = new Uint32Array(nodeCount);
  const nodeLayerMask = new Uint32Array(nodeCount);
  const edgeSourceIds = new Uint32Array(edgeCount);
  const edgeTargetIds = new Uint32Array(edgeCount);
  const edgeKind = new Uint16Array(edgeCount);
  const edgeLayerMask = new Uint32Array(edgeCount);

  for (let index = 0; index < nodeCount; index += 1) {
    nodeKind[index] = index % NODE_KIND_COUNT;
    nodeFlags[index] = fixtureFlags(index);
    nodeLayerMask[index] = layerMask(index);
  }

  for (let index = 0; index < edgeCount; index += 1) {
    const source = edgeSource(index, nodeCount);
    edgeSourceIds[index] = source;
    edgeTargetIds[index] = edgeTarget(index, source, nodeCount);
    edgeKind[index] = index % EDGE_KIND_COUNT;
    edgeLayerMask[index] = layerMask(index);
  }

  return {
    nodeCount,
    edgeCount,
    nodeKind,
    nodeFlags,
    nodeLayerMask,
    edgeSourceIds,
    edgeTargetIds,
    edgeKind,
    edgeLayerMask,
    byteLength:
      nodeKind.byteLength +
      nodeFlags.byteLength +
      nodeLayerMask.byteLength +
      edgeSourceIds.byteLength +
      edgeTargetIds.byteLength +
      edgeKind.byteLength +
      edgeLayerMask.byteLength,
  };
}

function createBinaryGraphIndex(nodeCount, edgeCount) {
  const nodeView = new DataView(new ArrayBuffer(nodeCount * NODE_STRIDE));
  const edgeView = new DataView(new ArrayBuffer(edgeCount * EDGE_STRIDE));

  for (let index = 0; index < nodeCount; index += 1) {
    const offset = index * NODE_STRIDE;
    nodeView.setUint16(offset + NODE_OFFSET_KIND, index % NODE_KIND_COUNT, true);
    nodeView.setUint32(offset + NODE_OFFSET_FLAGS, fixtureFlags(index), true);
    nodeView.setUint32(offset + NODE_OFFSET_LAYER_MASK, layerMask(index), true);
    nodeView.setUint32(offset + NODE_OFFSET_ID_INDEX, index, true);
  }

  for (let index = 0; index < edgeCount; index += 1) {
    const source = edgeSource(index, nodeCount);
    const offset = index * EDGE_STRIDE;
    edgeView.setUint32(offset + EDGE_OFFSET_SOURCE, source, true);
    edgeView.setUint32(offset + EDGE_OFFSET_TARGET, edgeTarget(index, source, nodeCount), true);
    edgeView.setUint16(offset + EDGE_OFFSET_KIND, index % EDGE_KIND_COUNT, true);
    edgeView.setUint32(offset + EDGE_OFFSET_LAYER_MASK, layerMask(index), true);
  }

  return { nodeCount, edgeCount, nodeView, edgeView };
}

function summarizeObjectGraph(graph) {
  const nodeIndexById = new Map();
  const nodeKindCounts = new Uint32Array(NODE_KIND_COUNT);
  const edgeKindCounts = new Uint32Array(EDGE_KIND_COUNT);
  const outDegree = new Uint32Array(graph.nodes.length);
  const inDegree = new Uint32Array(graph.nodes.length);

  for (let index = 0; index < graph.nodes.length; index += 1) {
    const node = graph.nodes[index];
    nodeIndexById.set(node.id, index);
    nodeKindCounts[node.kind] += 1;
  }

  for (const edge of graph.edges) {
    const source = nodeIndexById.get(edge.source);
    const target = nodeIndexById.get(edge.target);

    if (source === undefined || target === undefined) {
      throw new Error(`Dangling edge: ${edge.source} -> ${edge.target}`);
    }

    outDegree[source] += 1;
    inDegree[target] += 1;
    edgeKindCounts[edge.kind] += 1;
  }

  const adjacency = buildAdjacencyFromObjectGraph(graph, nodeIndexById, outDegree);
  return checksumGraphSummary(nodeKindCounts, edgeKindCounts, outDegree, inDegree, adjacency);
}

function summarizeTypedGraphIndex(graph) {
  const nodeKindCounts = new Uint32Array(NODE_KIND_COUNT);
  const edgeKindCounts = new Uint32Array(EDGE_KIND_COUNT);
  const outDegree = new Uint32Array(graph.nodeCount);
  const inDegree = new Uint32Array(graph.nodeCount);

  for (let index = 0; index < graph.nodeCount; index += 1) {
    nodeKindCounts[graph.nodeKind[index]] += 1;
  }

  for (let index = 0; index < graph.edgeCount; index += 1) {
    const source = graph.edgeSourceIds[index];
    const target = graph.edgeTargetIds[index];
    outDegree[source] += 1;
    inDegree[target] += 1;
    edgeKindCounts[graph.edgeKind[index]] += 1;
  }

  const adjacency = buildAdjacencyFromTypedGraph(graph, outDegree);
  return checksumGraphSummary(nodeKindCounts, edgeKindCounts, outDegree, inDegree, adjacency);
}

function summarizeNumericObjectGraph(graph) {
  const nodeKindCounts = new Uint32Array(NODE_KIND_COUNT);
  const edgeKindCounts = new Uint32Array(EDGE_KIND_COUNT);
  const outDegree = new Uint32Array(graph.nodes.length);
  const inDegree = new Uint32Array(graph.nodes.length);

  for (let index = 0; index < graph.nodes.length; index += 1) {
    const node = graph.nodes[index];
    nodeKindCounts[node.kind] += 1;
  }

  for (const edge of graph.edges) {
    outDegree[edge.source] += 1;
    inDegree[edge.target] += 1;
    edgeKindCounts[edge.kind] += 1;
  }

  const adjacency = buildAdjacencyFromNumericObjectGraph(graph, outDegree);
  return checksumGraphSummary(nodeKindCounts, edgeKindCounts, outDegree, inDegree, adjacency);
}

function buildAdjacencyFromNumericObjectGraph(graph, outDegree) {
  const offsets = prefixOffsets(outDegree);
  const cursor = offsets.slice(0, offsets.length - 1);
  const targets = new Uint32Array(graph.edges.length);

  for (const edge of graph.edges) {
    const outIndex = cursor[edge.source];
    targets[outIndex] = edge.target;
    cursor[edge.source] = outIndex + 1;
  }

  return { offsets, targets };
}

function summarizeBinaryGraphIndex(graph) {
  const nodeKindCounts = new Uint32Array(NODE_KIND_COUNT);
  const edgeKindCounts = new Uint32Array(EDGE_KIND_COUNT);
  const outDegree = new Uint32Array(graph.nodeCount);
  const inDegree = new Uint32Array(graph.nodeCount);

  histogramU16Field(graph.nodeView, graph.nodeCount, NODE_STRIDE, NODE_OFFSET_KIND, nodeKindCounts);
  histogramU16Field(graph.edgeView, graph.edgeCount, EDGE_STRIDE, EDGE_OFFSET_KIND, edgeKindCounts);

  for (let index = 0; index < graph.edgeCount; index += 1) {
    const offset = index * EDGE_STRIDE;
    const source = graph.edgeView.getUint32(offset + EDGE_OFFSET_SOURCE, true);
    const target = graph.edgeView.getUint32(offset + EDGE_OFFSET_TARGET, true);
    outDegree[source] += 1;
    inDegree[target] += 1;
  }

  const adjacency = buildAdjacencyFromBinaryGraph(graph, outDegree);
  return checksumGraphSummary(nodeKindCounts, edgeKindCounts, outDegree, inDegree, adjacency);
}

function buildAdjacencyFromObjectGraph(graph, nodeIndexById, outDegree) {
  const offsets = prefixOffsets(outDegree);
  const cursor = offsets.slice(0, offsets.length - 1);
  const targets = new Uint32Array(graph.edges.length);

  for (const edge of graph.edges) {
    const source = nodeIndexById.get(edge.source);
    const target = nodeIndexById.get(edge.target);
    const outIndex = cursor[source];
    targets[outIndex] = target;
    cursor[source] = outIndex + 1;
  }

  return { offsets, targets };
}

function buildAdjacencyFromTypedGraph(graph, outDegree) {
  const offsets = prefixOffsets(outDegree);
  const cursor = offsets.slice(0, offsets.length - 1);
  const targets = new Uint32Array(graph.edgeCount);

  for (let index = 0; index < graph.edgeCount; index += 1) {
    const source = graph.edgeSourceIds[index];
    const outIndex = cursor[source];
    targets[outIndex] = graph.edgeTargetIds[index];
    cursor[source] = outIndex + 1;
  }

  return { offsets, targets };
}

function buildAdjacencyFromBinaryGraph(graph, outDegree) {
  const offsets = prefixOffsets(outDegree);
  const cursor = offsets.slice(0, offsets.length - 1);
  const targets = new Uint32Array(graph.edgeCount);

  for (let index = 0; index < graph.edgeCount; index += 1) {
    const offset = index * EDGE_STRIDE;
    const source = graph.edgeView.getUint32(offset + EDGE_OFFSET_SOURCE, true);
    const outIndex = cursor[source];
    targets[outIndex] = graph.edgeView.getUint32(offset + EDGE_OFFSET_TARGET, true);
    cursor[source] = outIndex + 1;
  }

  return { offsets, targets };
}

function prefixOffsets(degree) {
  const offsets = new Uint32Array(degree.length + 1);

  for (let index = 0; index < degree.length; index += 1) {
    offsets[index + 1] = offsets[index] + degree[index];
  }

  return offsets;
}

function checksumGraphSummary(nodeKindCounts, edgeKindCounts, outDegree, inDegree, adjacency) {
  let checksum = 0;
  checksum = mixUintArray(checksum, nodeKindCounts);
  checksum = mixUintArray(checksum, edgeKindCounts);
  checksum = mixSparseUintArray(checksum, outDegree);
  checksum = mixSparseUintArray(checksum, inDegree);
  checksum = mixSparseUintArray(checksum, adjacency.offsets);
  checksum = mixSparseUintArray(checksum, adjacency.targets);
  return checksum;
}

function edgeSource(index, nodeCount) {
  return Math.imul(index, GRAPH_SOURCE_STRIDE) % nodeCount;
}

function edgeTarget(index, source, nodeCount) {
  return (source + 1 + (Math.imul(index, GRAPH_TARGET_STRIDE) % (nodeCount - 1))) % nodeCount;
}

function fixtureFlags(index) {
  return index & FLAGS_BYTE_MASK;
}

function layerMask(index) {
  return 1 << (index % LAYER_BUCKET_COUNT);
}

function nodeId(index) {
  return `node:${index}`;
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
    medianNsPerRecord: nsPerRecord(median, recordCount),
  };

  console.log(
    `${label}: median=${median.toFixed(2)} ms p95=${p95.toFixed(2)} ms p99=${p99.toFixed(2)} ms std=${std.toFixed(2)} ms median=${stats.medianNsPerRecord.toFixed(2)} ns/edge checksum=${checksum}`,
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

function mixUintArray(checksum, values) {
  for (const value of values) {
    checksum = mix32(checksum, value);
  }

  return checksum;
}

function mixSparseUintArray(checksum, values) {
  const stride = Math.max(1, Math.floor(values.length / SPARSE_CHECKSUM_SAMPLE_COUNT));

  for (let index = 0; index < values.length; index += stride) {
    checksum = mix32(checksum, values[index] ?? 0);
  }

  return checksum;
}

function mix32(checksum, value) {
  checksum ^= Number(value) | 0;
  return Math.imul(checksum, 0x45d9f3b) >>> 0;
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
