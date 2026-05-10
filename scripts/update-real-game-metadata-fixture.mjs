#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE = {
  name: "HexGL",
  repository: "https://github.com/BKcore/HexGL",
  commit: "6addc95a2fce3bf05f4d751823cc054c61a16d68",
  license: "MIT",
};

const OUTPUT_PATH = resolve("packages/bench/fixtures/hexgl-asset-metadata.json");
const GITHUB_TREE_URL = `https://api.github.com/repos/BKcore/HexGL/git/trees/${SOURCE.commit}?recursive=1`;

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

const EXTENSION_CODES = {
  "": 0,
  ".css": 1,
  ".eot": 2,
  ".gif": 3,
  ".html": 4,
  ".jpg": 5,
  ".js": 6,
  ".json": 7,
  ".md": 8,
  ".ogg": 9,
  ".png": 10,
  ".svg": 11,
  ".ttf": 12,
  ".txt": 13,
  ".woff": 14,
};

await main();

async function main() {
  const response = await fetch(GITHUB_TREE_URL, {
    headers: {
      "user-agent": "zeno-real-game-metadata-fixture",
      accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub tree request failed: ${response.status} ${response.statusText}`);
  }

  const tree = await response.json();
  const records = tree.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => createRecord(entry.path, entry.size ?? 0))
    .filter((record) => record.kind !== "other")
    .sort((left, right) => left.path.localeCompare(right.path));

  const fixture = {
    source: SOURCE,
    note: "Path and byte-size metadata only. No HexGL asset payload bytes are stored in this fixture.",
    kindCodes: KIND_CODES,
    extensionCodes: EXTENSION_CODES,
    records,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`wrote ${records.length} HexGL metadata rows to ${OUTPUT_PATH}`);
}

function createRecord(path, byteLength) {
  const extension = extensionOf(path);
  return {
    path,
    byteLength,
    kind: classifyKind(path, extension),
    extension,
    pathHash: fnv1a(path),
    depth: path.split("/").length - 1,
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
  if (path.startsWith("audio/") || extension === ".ogg") {
    return "audio";
  }

  if (
    path.startsWith("textures/") ||
    extension === ".jpg" ||
    extension === ".png" ||
    extension === ".gif"
  ) {
    return "texture";
  }

  if (path.startsWith("geometries/")) {
    return "geometry";
  }

  if (
    path.includes("shader") ||
    extension === ".glsl" ||
    extension === ".vert" ||
    extension === ".frag"
  ) {
    return "shader";
  }

  if (extension === ".js") {
    return "script";
  }

  if (extension === ".css") {
    return "style";
  }

  if (
    extension === ".eot" ||
    extension === ".svg" ||
    extension === ".ttf" ||
    extension === ".woff"
  ) {
    return "font";
  }

  if (extension === ".html" || extension === ".md" || path.toLowerCase().includes("license")) {
    return "document";
  }

  if (extension === ".json") {
    return "metadata";
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
