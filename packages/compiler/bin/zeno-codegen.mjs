#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

import {
  analyzeProjectionFile,
  emitProjectionFile,
  formatDiagnosticLocation,
} from "../dist/index.js";

const args = process.argv.slice(2);
let optimizeCursorOffsets = false;
let endianness = "little";
let diagnosticsFormat = "text";
const positionalArgs = [];
const usage = "Usage: zeno-codegen <input.ts> <output.view.ts> [--optimize-cursor-offsets] [--endian=little|big] [--diagnostics=text|json]";

for (const arg of args) {
  if (arg === "--help" || arg === "-h") {
    console.log(usage);
    process.exit(0);
  }

  if (arg === "--optimize-cursor-offsets") {
    optimizeCursorOffsets = true;
    continue;
  }

  if (arg.startsWith("--endian=")) {
    endianness = arg.slice("--endian=".length);
    continue;
  }

  if (arg.startsWith("--diagnostics=")) {
    diagnosticsFormat = arg.slice("--diagnostics=".length);
    continue;
  }

  if (arg.startsWith("--")) {
    console.error(`Unknown option: ${arg}`);
    process.exit(1);
  }

  positionalArgs.push(arg);
}

const [inputPath, outputPath] = positionalArgs;

if (inputPath === undefined || outputPath === undefined) {
  console.error(usage);
  process.exit(1);
}

if (endianness !== "little" && endianness !== "big") {
  console.error(`Invalid endianness: ${endianness}. Expected "little" or "big".`);
  process.exit(1);
}

if (diagnosticsFormat !== "text" && diagnosticsFormat !== "json") {
  console.error(`Invalid diagnostics format: ${diagnosticsFormat}. Expected "text" or "json".`);
  process.exit(1);
}

const rootName = path.resolve(inputPath);

let sourceText;
try {
  sourceText = await import("node:fs/promises").then((fs) => fs.readFile(rootName, "utf8"));
} catch {
  console.error(`Could not read input file: ${rootName}`);
  process.exit(1);
}

const sourceFile = ts.createSourceFile(
  rootName,
  sourceText,
  ts.ScriptTarget.ES2022,
  true,
);

const program = undefined;

const result = analyzeProjectionFile(program, sourceFile, { endianness });

if (result.diagnostics.length > 0) {
  if (diagnosticsFormat === "json") {
    console.error(JSON.stringify({ diagnostics: result.diagnostics }, null, 2));
  } else {
    for (const diagnostic of result.diagnostics) {
      console.error(`${formatDiagnosticLocation(diagnostic)} ${diagnostic.code}: ${diagnostic.message}`);
    }
  }
  process.exit(1);
}

await writeFile(
  path.resolve(outputPath),
  emitProjectionFile(result.layouts, { optimizeCursorOffsets }),
  "utf8",
);
