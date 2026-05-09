#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

import {
  analyzeProjectionSourceFile,
  emitProjectionFile,
  formatDiagnosticLocation,
} from "../dist/index.js";

const args = process.argv.slice(2);
let optimizeCursorOffsets = false;
let endianness = "little";
const diagnosticsArg = args.find((arg) => arg.startsWith("--diagnostics="));
let diagnosticsFormat =
  diagnosticsArg === undefined ? "text" : diagnosticsArg.slice("--diagnostics=".length);
const positionalArgs = [];
const usage =
  "Usage: zeno-codegen <input.ts> <output.view.ts> [--optimize-cursor-offsets retired-diagnostic] [--endian=little|big] [--diagnostics=text|json]";

function fail(code, message, details = {}) {
  if (diagnosticsFormat === "json") {
    console.error(
      JSON.stringify(
        {
          event: "Codegen_Failed",
          code,
          message,
          details,
        },
        null,
        2,
      ),
    );
  } else {
    console.error(message);
  }
  process.exit(1);
}

for (const arg of args) {
  if (arg === "--help" || arg === "-h") {
    console.log(usage);
    process.exit(0);
  }

  if (arg === "--optimize-cursor-offsets") {
    optimizeCursorOffsets = true;
    console.error(
      "Warning: --optimize-cursor-offsets is a retired diagnostic mode; static accessors and scan kernels are the supported hot path.",
    );
    continue;
  }

  if (arg.startsWith("--endian=")) {
    endianness = arg.slice("--endian=".length);
    continue;
  }

  if (arg.startsWith("--diagnostics=")) {
    continue;
  }

  if (arg.startsWith("--")) {
    fail("UNKNOWN_OPTION", `Unknown option: ${arg}`, { option: arg });
  }

  positionalArgs.push(arg);
}

const [inputPath, outputPath] = positionalArgs;

if (inputPath === undefined || outputPath === undefined) {
  fail("INVALID_ARGUMENTS", usage);
}

if (endianness !== "little" && endianness !== "big") {
  fail("INVALID_ENDIANNESS", `Invalid endianness: ${endianness}. Expected "little" or "big".`, {
    endianness,
  });
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
  fail("INPUT_READ_FAILED", `Could not read input file: ${rootName}`, {
    inputPath: rootName,
  });
}

const sourceFile = ts.createSourceFile(rootName, sourceText, ts.ScriptTarget.ES2022, true);

const result = analyzeProjectionSourceFile(sourceFile, { endianness });

if (result.diagnostics.length > 0) {
  if (diagnosticsFormat === "json") {
    console.error(JSON.stringify({ diagnostics: result.diagnostics }, null, 2));
  } else {
    for (const diagnostic of result.diagnostics) {
      console.error(
        `${formatDiagnosticLocation(diagnostic)} ${diagnostic.code}: ${diagnostic.message}`,
      );
    }
  }
  process.exit(1);
}

await writeFile(
  path.resolve(outputPath),
  emitProjectionFile(result.layouts, { optimizeCursorOffsets }),
  "utf8",
);
