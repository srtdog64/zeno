import { readFileSync } from "node:fs";

import { AssetRowView } from "./model.view.js";

const KindCode = {
  other: 0,
  texture: 1,
  geometry: 2,
  audio: 3,
  shader: 4,
  script: 5,
  style: 6,
  font: 7,
  document: 8,
  metadata: 9,
} as const;

const ExtensionCode = {
  other: 0,
  png: 1,
  jpg: 2,
  jpeg: 3,
  webp: 4,
  ogg: 5,
  mp3: 6,
  glsl: 7,
  js: 8,
  json: 9,
  css: 10,
} as const;

const fixtureUrl = new URL(
  "../../../packages/bench/fixtures/renderer-surface-metadata.json",
  import.meta.url,
);

const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8")) as RendererSurfaceFixture;
const records = flattenRecords(fixture);
const rowBuffer = new ArrayBuffer(AssetRowView.byteLength * records.length);
const rowView = new DataView(rowBuffer);

writeAssetRows(rowView, records);

const textureCount = AssetRowView.countKindWhereEq(rowView, records.length, KindCode.texture);
const scriptCount = AssetRowView.countKindWhereEq(rowView, records.length, KindCode.script);
const metadataCount = AssetRowView.countKindWhereEq(rowView, records.length, KindCode.metadata);
const totalBytes = AssetRowView.sumByteLength(rowView, records.length);
const maxAssetBytes = AssetRowView.maxByteLength(rowView, records.length);
const firstTexture = AssetRowView.findFirstKindWhereEq(rowView, records.length, KindCode.texture);

const textureQueue = new Uint32Array(textureCount * 3);
const scriptQueue = new Uint32Array(scriptCount * 3);
const projectByteTotals = new Uint32Array(fixture.projects.length * 2);

packAssetsByKind(rowView, records.length, KindCode.texture, textureQueue);
packAssetsByKind(rowView, records.length, KindCode.script, scriptQueue);
packProjectByteTotals(rowView, records.length, fixture.projects.length, projectByteTotals);

console.log({
  projectCount: fixture.projects.length,
  recordCount: records.length,
  textureCount,
  scriptCount,
  metadataCount,
  firstTexture,
  totalBytes,
  maxAssetBytes,
  textureQueueWords: textureQueue.length,
  scriptQueueWords: scriptQueue.length,
  projectByteTotalWords: projectByteTotals.length,
});

function flattenRecords(fixtureData: RendererSurfaceFixture): readonly FlatAssetRecord[] {
  const output: FlatAssetRecord[] = [];

  for (let projectId = 0; projectId < fixtureData.projects.length; projectId += 1) {
    const project = fixtureData.projects[projectId];
    if (project === undefined) {
      throw new RangeError(`Missing project at index ${projectId}`);
    }

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

function writeAssetRows(view: DataView, assetRows: readonly FlatAssetRecord[]): void {
  for (let index = 0; index < assetRows.length; index += 1) {
    const record = assetRows[index];
    if (record === undefined) {
      throw new RangeError(`Missing asset row at index ${index}`);
    }

    AssetRowView.setProjectIdAt(view, record.projectId, index);
    AssetRowView.setKindAt(view, record.kindCode, index);
    AssetRowView.setExtensionAt(view, record.extensionCode, index);
    AssetRowView.setPathHashAt(view, record.pathHash, index);
    AssetRowView.setByteLengthAt(view, record.byteLength, index);
    AssetRowView.setDepthAt(view, record.depth, index);
    AssetRowView.setFlagsAt(view, record.flags, index);
  }
}

function packAssetsByKind(
  view: DataView,
  count: number,
  kindCode: number,
  output: Uint32Array,
): number {
  let outputIndex = 0;

  for (let index = 0; index < count; index += 1) {
    if (AssetRowView.getKindAt(view, index) !== kindCode) {
      continue;
    }

    const out = outputIndex * 3;

    output[out] = AssetRowView.getPathHashAt(view, index);
    output[out + 1] = AssetRowView.getByteLengthAt(view, index);
    output[out + 2] = AssetRowView.getExtensionAt(view, index);
    outputIndex += 1;
  }

  return outputIndex;
}

function packProjectByteTotals(
  view: DataView,
  count: number,
  projectCount: number,
  output: Uint32Array,
): void {
  for (let projectId = 0; projectId < projectCount; projectId += 1) {
    output[projectId * 2] = projectId;
  }

  for (let index = 0; index < count; index += 1) {
    const projectId = AssetRowView.getProjectIdAt(view, index);
    const out = projectId * 2;

    output[out + 1] = (output[out + 1] ?? 0) + AssetRowView.getByteLengthAt(view, index);
  }
}

function extensionCode(extension: string): number {
  switch (extension) {
    case ".png":
      return ExtensionCode.png;
    case ".jpg":
      return ExtensionCode.jpg;
    case ".jpeg":
      return ExtensionCode.jpeg;
    case ".webp":
      return ExtensionCode.webp;
    case ".ogg":
      return ExtensionCode.ogg;
    case ".mp3":
      return ExtensionCode.mp3;
    case ".glsl":
    case ".vert":
    case ".frag":
      return ExtensionCode.glsl;
    case ".js":
    case ".mjs":
      return ExtensionCode.js;
    case ".json":
      return ExtensionCode.json;
    case ".css":
      return ExtensionCode.css;
    default:
      return ExtensionCode.other;
  }
}

function assetFlags(record: FixtureRecord): number {
  const large = record.byteLength >= 1024 * 1024;
  const nested = record.depth > 2;
  const rendererPayload =
    record.kindCode === KindCode.texture ||
    record.kindCode === KindCode.geometry ||
    record.kindCode === KindCode.shader;

  return (large ? 0b001 : 0) | (nested ? 0b010 : 0) | (rendererPayload ? 0b100 : 0);
}

interface RendererSurfaceFixture {
  readonly projects: readonly ProjectFixture[];
}

interface ProjectFixture {
  readonly records: readonly FixtureRecord[];
}

interface FixtureRecord {
  readonly byteLength: number;
  readonly kindCode: number;
  readonly extension: string;
  readonly pathHash: number;
  readonly depth: number;
}

interface FlatAssetRecord {
  readonly projectId: number;
  readonly kindCode: number;
  readonly extensionCode: number;
  readonly pathHash: number;
  readonly byteLength: number;
  readonly depth: number;
  readonly flags: number;
}
