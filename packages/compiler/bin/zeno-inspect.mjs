#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

import {
  analyzeProjectionSourceFile,
  createLayoutManifest,
  formatDiagnosticLocation,
  formatLayoutInspection,
} from "../dist/index.js";

const args = process.argv.slice(2);
const usage = "Usage: zeno-inspect <schema.zeno.ts> [--endian=little|big] [--json]";
let endianness = "little";
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
  if (arg.startsWith("--endian=")) {
    endianness = arg.slice("--endian=".length);
    continue;
  }
  if (arg.startsWith("--")) {
    fail(`Unknown option: ${arg}`);
  }
  positionalArgs.push(arg);
}

if (endianness !== "little" && endianness !== "big") {
  fail(`Invalid endianness: ${endianness}. Expected "little" or "big".`);
}

const [inputPath] = positionalArgs;
if (inputPath === undefined) {
  fail(usage);
}

const fileName = path.resolve(inputPath);
const sourceText = await readFile(fileName, "utf8");
const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2022, true);
const result = analyzeProjectionSourceFile(sourceFile, { endianness });

if (result.diagnostics.length > 0) {
  for (const diagnostic of result.diagnostics) {
    console.error(
      `${formatDiagnosticLocation(diagnostic)} ${diagnostic.code}: ${diagnostic.message}`,
    );
  }
  process.exit(1);
}

const manifest = createLayoutManifest(result.layouts);
console.log(json ? JSON.stringify(manifest, null, 2) : formatLayoutInspection(manifest));

function fail(message) {
  console.error(message);
  process.exit(1);
}
