#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const OUTPUT_PATH = resolve("packages/bench/fixtures/renderer-surface-metadata.json");

const SOURCES = [
  {
    name: "HexGL",
    owner: "BKcore",
    repo: "HexGL",
    repository: "https://github.com/BKcore/HexGL",
    commit: "6addc95a2fce3bf05f4d751823cc054c61a16d68",
    rendererSurface: "racing game assets and instance metadata",
    zenoRelevantShape: "asset catalog rows, texture/geometry/audio metadata",
  },
  {
    name: "Nemesis",
    owner: "IceCreamYou",
    repo: "Nemesis",
    repository: "https://github.com/IceCreamYou/Nemesis",
    commit: "697fae45cf299aaf7070561bbec0b290c3b04a27",
    rendererSurface: "small FPS entity/map state",
    zenoRelevantShape: "transform rows, enemy/projectile/pickup state",
  },
  {
    name: "xwing",
    owner: "amilajack",
    repo: "xwing",
    repository: "https://github.com/amilajack/xwing",
    commit: "2b9fce366736da5ab35238fb7b2fc480f1f2f522",
    rendererSurface: "Three.js/WebGL2 game assets",
    zenoRelevantShape: "asset catalog, projectile/enemy instance buffers",
  },
  {
    name: "NetHack 3D",
    owner: "JamesIV4",
    repo: "nethack-3d",
    repository: "https://github.com/JamesIV4/nethack-3d",
    commit: "22571ba3ef120a8bc076d82bec4f07853644c82a",
    rendererSurface: "WASM game state plus Three.js renderer",
    zenoRelevantShape: "grid cells, visible entities, item/monster buffers",
  },
];

const KIND_CODES = {
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
};

await main();

async function main() {
  const projects = [];

  for (const source of SOURCES) {
    const records = await fetchSourceRecords(source);
    projects.push({
      source: sourceSummary(source),
      summary: summarizeRecords(records),
      records,
    });
  }

  const fixture = {
    version: 1,
    note: "GitHub tree path and byte-size metadata only. No game asset payload bytes or source file contents are stored in this fixture.",
    kindCodes: KIND_CODES,
    projects,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`wrote ${projects.length} renderer-surface projects to ${OUTPUT_PATH}`);
}

async function fetchSourceRecords(source) {
  const url = `https://api.github.com/repos/${source.owner}/${source.repo}/git/trees/${source.commit}?recursive=1`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "zeno-renderer-surface-fixture",
      accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`${source.name} GitHub tree request failed: ${response.status}`);
  }

  const tree = await response.json();
  return tree.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => createRecord(entry.path, entry.size ?? 0))
    .filter((record) => record.kind !== "other")
    .sort((left, right) => left.path.localeCompare(right.path));
}

function sourceSummary(source) {
  return {
    name: source.name,
    repository: source.repository,
    commit: source.commit,
    rendererSurface: source.rendererSurface,
    zenoRelevantShape: source.zenoRelevantShape,
  };
}

function createRecord(path, byteLength) {
  const extension = extensionOf(path);
  const kind = classifyKind(path, extension);

  return {
    path,
    byteLength,
    kind,
    kindCode: KIND_CODES[kind],
    extension,
    pathHash: fnv1a(path),
    depth: path.split("/").length - 1,
  };
}

function summarizeRecords(records) {
  const countsByKind = {};
  const bytesByKind = {};
  let totalBytes = 0;

  for (const record of records) {
    countsByKind[record.kind] = (countsByKind[record.kind] ?? 0) + 1;
    bytesByKind[record.kind] = (bytesByKind[record.kind] ?? 0) + record.byteLength;
    totalBytes += record.byteLength;
  }

  return {
    recordCount: records.length,
    totalBytes,
    countsByKind,
    bytesByKind,
  };
}

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  if (index < 0) {
    return "";
  }

  return path.slice(index).toLowerCase();
}

function classifyKind(path, extension) {
  const normalizedPath = path.toLowerCase();

  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ktx", ".dds"].includes(extension)) {
    return "texture";
  }

  if ([".glb", ".gltf", ".obj", ".fbx", ".dae", ".stl", ".ply"].includes(extension)) {
    return "geometry";
  }

  if ([".ogg", ".mp3", ".wav", ".m4a"].includes(extension)) {
    return "audio";
  }

  if (
    [".glsl", ".vert", ".frag", ".wgsl"].includes(extension) ||
    normalizedPath.includes("shader")
  ) {
    return "shader";
  }

  if ([".js", ".ts", ".tsx", ".jsx"].includes(extension)) {
    return "script";
  }

  if ([".css", ".scss"].includes(extension)) {
    return "style";
  }

  if ([".eot", ".svg", ".ttf", ".woff", ".woff2"].includes(extension)) {
    return "font";
  }

  if ([".json", ".xml", ".yaml", ".yml", ".tmx", ".tsx"].includes(extension)) {
    return "metadata";
  }

  if (
    [".html", ".md", ".txt"].includes(extension) ||
    normalizedPath.includes("license") ||
    normalizedPath.includes("readme")
  ) {
    return "document";
  }

  return "other";
}

function fnv1a(text) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}
