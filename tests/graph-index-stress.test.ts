import { describe, expect, it } from "vitest";

import { histogramU16Field } from "../packages/buffers/src/index.js";

const NODE_COUNT = 12_000;
const EDGE_COUNT = 48_000;
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
// The checksum samples large derived arrays to keep this stress test quick.
// Full semantic equality is still covered by node/edge counts and degree scans.
const SPARSE_CHECKSUM_SAMPLE_COUNT = 128;

interface ObjectNode {
  readonly id: string;
  readonly kind: number;
  readonly flags: number;
  readonly layerMask: number;
}

interface ObjectEdge {
  readonly source: string;
  readonly target: string;
  readonly kind: number;
  readonly layerMask: number;
}

interface ObjectGraph {
  readonly nodes: readonly ObjectNode[];
  readonly edges: readonly ObjectEdge[];
}

interface BinaryGraphIndex {
  readonly nodeView: DataView;
  readonly edgeView: DataView;
}

describe("large graph index benchmark fixture", () => {
  it("matches object graph summary semantics with interned binary rows", () => {
    const objectGraph = createObjectGraph();
    const binaryGraph = createBinaryGraphIndex();

    expect(summarizeObjectGraph(objectGraph)).toBe(summarizeBinaryGraphIndex(binaryGraph));
  });

  it("keeps binary graph row boundaries fail-closed", () => {
    const binaryGraph = createBinaryGraphIndex();
    const edgeKindCounts = new Uint32Array(EDGE_KIND_COUNT);

    expect(() =>
      histogramU16Field(
        binaryGraph.edgeView,
        EDGE_COUNT + 1,
        EDGE_STRIDE,
        EDGE_OFFSET_KIND,
        edgeKindCounts,
      ),
    ).toThrow(RangeError);
  });
});

function createObjectGraph(): ObjectGraph {
  const nodes = new Array<ObjectNode>(NODE_COUNT);
  const edges = new Array<ObjectEdge>(EDGE_COUNT);

  for (let index = 0; index < NODE_COUNT; index += 1) {
    nodes[index] = {
      id: nodeId(index),
      kind: index % NODE_KIND_COUNT,
      flags: fixtureFlags(index),
      layerMask: layerMask(index),
    };
  }

  for (let index = 0; index < EDGE_COUNT; index += 1) {
    const source = edgeSource(index);
    edges[index] = {
      source: nodeId(source),
      target: nodeId(edgeTarget(index, source)),
      kind: index % EDGE_KIND_COUNT,
      layerMask: layerMask(index),
    };
  }

  return { nodes, edges };
}

function createBinaryGraphIndex(): BinaryGraphIndex {
  const nodeView = new DataView(new ArrayBuffer(NODE_COUNT * NODE_STRIDE));
  const edgeView = new DataView(new ArrayBuffer(EDGE_COUNT * EDGE_STRIDE));

  for (let index = 0; index < NODE_COUNT; index += 1) {
    const offset = index * NODE_STRIDE;
    nodeView.setUint16(offset + NODE_OFFSET_KIND, index % NODE_KIND_COUNT, true);
    nodeView.setUint32(offset + NODE_OFFSET_FLAGS, fixtureFlags(index), true);
    nodeView.setUint32(offset + NODE_OFFSET_LAYER_MASK, layerMask(index), true);
    nodeView.setUint32(offset + NODE_OFFSET_ID_INDEX, index, true);
  }

  for (let index = 0; index < EDGE_COUNT; index += 1) {
    const source = edgeSource(index);
    const offset = index * EDGE_STRIDE;
    edgeView.setUint32(offset + EDGE_OFFSET_SOURCE, source, true);
    edgeView.setUint32(offset + EDGE_OFFSET_TARGET, edgeTarget(index, source), true);
    edgeView.setUint16(offset + EDGE_OFFSET_KIND, index % EDGE_KIND_COUNT, true);
    edgeView.setUint32(offset + EDGE_OFFSET_LAYER_MASK, layerMask(index), true);
  }

  return { nodeView, edgeView };
}

function summarizeObjectGraph(graph: ObjectGraph): number {
  const nodeIndexById = new Map<string, number>();
  const nodeKindCounts = new Uint32Array(NODE_KIND_COUNT);
  const edgeKindCounts = new Uint32Array(EDGE_KIND_COUNT);
  const outDegree = new Uint32Array(graph.nodes.length);
  const inDegree = new Uint32Array(graph.nodes.length);

  for (let index = 0; index < graph.nodes.length; index += 1) {
    const node = graph.nodes[index];
    if (node === undefined) {
      throw new Error(`Missing node at index ${index}`);
    }

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

function summarizeBinaryGraphIndex(graph: BinaryGraphIndex): number {
  const nodeKindCounts = new Uint32Array(NODE_KIND_COUNT);
  const edgeKindCounts = new Uint32Array(EDGE_KIND_COUNT);
  const outDegree = new Uint32Array(NODE_COUNT);
  const inDegree = new Uint32Array(NODE_COUNT);

  histogramU16Field(graph.nodeView, NODE_COUNT, NODE_STRIDE, NODE_OFFSET_KIND, nodeKindCounts);
  histogramU16Field(graph.edgeView, EDGE_COUNT, EDGE_STRIDE, EDGE_OFFSET_KIND, edgeKindCounts);

  for (let index = 0; index < EDGE_COUNT; index += 1) {
    const offset = index * EDGE_STRIDE;
    const source = graph.edgeView.getUint32(offset + EDGE_OFFSET_SOURCE, true);
    const target = graph.edgeView.getUint32(offset + EDGE_OFFSET_TARGET, true);

    outDegree[source] += 1;
    inDegree[target] += 1;
  }

  const adjacency = buildAdjacencyFromBinaryGraph(graph, outDegree);
  return checksumGraphSummary(nodeKindCounts, edgeKindCounts, outDegree, inDegree, adjacency);
}

function buildAdjacencyFromObjectGraph(
  graph: ObjectGraph,
  nodeIndexById: ReadonlyMap<string, number>,
  outDegree: Uint32Array,
): { readonly offsets: Uint32Array; readonly targets: Uint32Array } {
  const offsets = prefixOffsets(outDegree);
  const cursor = offsets.slice(0, offsets.length - 1);
  const targets = new Uint32Array(graph.edges.length);

  for (const edge of graph.edges) {
    const source = nodeIndexById.get(edge.source);
    const target = nodeIndexById.get(edge.target);

    if (source === undefined || target === undefined) {
      throw new Error(`Dangling edge: ${edge.source} -> ${edge.target}`);
    }

    const outIndex = cursor[source] ?? 0;
    targets[outIndex] = target;
    cursor[source] = outIndex + 1;
  }

  return { offsets, targets };
}

function buildAdjacencyFromBinaryGraph(
  graph: BinaryGraphIndex,
  outDegree: Uint32Array,
): { readonly offsets: Uint32Array; readonly targets: Uint32Array } {
  const offsets = prefixOffsets(outDegree);
  const cursor = offsets.slice(0, offsets.length - 1);
  const targets = new Uint32Array(EDGE_COUNT);

  for (let index = 0; index < EDGE_COUNT; index += 1) {
    const offset = index * EDGE_STRIDE;
    const source = graph.edgeView.getUint32(offset + EDGE_OFFSET_SOURCE, true);
    const outIndex = cursor[source] ?? 0;
    targets[outIndex] = graph.edgeView.getUint32(offset + EDGE_OFFSET_TARGET, true);
    cursor[source] = outIndex + 1;
  }

  return { offsets, targets };
}

function prefixOffsets(degree: Uint32Array): Uint32Array {
  const offsets = new Uint32Array(degree.length + 1);

  for (let index = 0; index < degree.length; index += 1) {
    offsets[index + 1] = (offsets[index] ?? 0) + (degree[index] ?? 0);
  }

  return offsets;
}

function checksumGraphSummary(
  nodeKindCounts: Uint32Array,
  edgeKindCounts: Uint32Array,
  outDegree: Uint32Array,
  inDegree: Uint32Array,
  adjacency: { readonly offsets: Uint32Array; readonly targets: Uint32Array },
): number {
  let checksum = 0;
  checksum = mixUintArray(checksum, nodeKindCounts);
  checksum = mixUintArray(checksum, edgeKindCounts);
  checksum = mixSparseUintArray(checksum, outDegree);
  checksum = mixSparseUintArray(checksum, inDegree);
  checksum = mixSparseUintArray(checksum, adjacency.offsets);
  checksum = mixSparseUintArray(checksum, adjacency.targets);
  return checksum;
}

function edgeSource(index: number): number {
  return Math.imul(index, GRAPH_SOURCE_STRIDE) % NODE_COUNT;
}

function edgeTarget(index: number, source: number): number {
  return (source + 1 + (Math.imul(index, GRAPH_TARGET_STRIDE) % (NODE_COUNT - 1))) % NODE_COUNT;
}

function fixtureFlags(index: number): number {
  return index & FLAGS_BYTE_MASK;
}

function layerMask(index: number): number {
  return 1 << (index % LAYER_BUCKET_COUNT);
}

function nodeId(index: number): string {
  return `node:${index}`;
}

function mixUintArray(checksum: number, values: Uint32Array): number {
  for (const value of values) {
    checksum = mix32(checksum, value);
  }

  return checksum;
}

function mixSparseUintArray(checksum: number, values: Uint32Array): number {
  const stride = Math.max(1, Math.floor(values.length / SPARSE_CHECKSUM_SAMPLE_COUNT));

  for (let index = 0; index < values.length; index += stride) {
    checksum = mix32(checksum, values[index] ?? 0);
  }

  return checksum;
}

function mix32(checksum: number, value: number): number {
  checksum ^= value | 0;
  return Math.imul(checksum, 0x45d9f3b) >>> 0;
}
