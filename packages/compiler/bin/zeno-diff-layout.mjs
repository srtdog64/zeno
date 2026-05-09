#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

import { diffLayoutManifests, formatLayoutDiff } from "../dist/index.js";

const args = process.argv.slice(2);
const usage = "Usage: zeno-diff-layout <old.layout.json> <new.layout.json> [--json]";
let json = false;
const positionalArgs = [];

for (const arg of args) {
  if (arg === "--help" || arg === "-h") {
    console.log(usage);
    process.exit(0);
  }
  if (arg === "--json") {
    json = true;
    continue;
  }
  if (arg.startsWith("--")) {
    fail(`Unknown option: ${arg}`);
  }
  positionalArgs.push(arg);
}

const [previousPath, nextPath] = positionalArgs;
if (previousPath === undefined || nextPath === undefined) {
  fail(usage);
}

const previous = JSON.parse(await readFile(path.resolve(previousPath), "utf8"));
const next = JSON.parse(await readFile(path.resolve(nextPath), "utf8"));
const diff = diffLayoutManifests(previous, next);

console.log(json ? JSON.stringify(diff, null, 2) : formatLayoutDiff(diff));
if (diff.breaking.length > 0) {
  process.exitCode = 1;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
