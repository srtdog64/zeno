#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

import {
  analyzeProjectionSourceFile,
  createLayoutManifest,
  emitProjectionFile,
  emitProjectionFileBarrel,
  emitProjectionFileParts,
  emitProjectionFileWithSourceMap,
  formatDiagnosticLocation,
  parseScanKernelMode,
} from "../dist/index.js";

const args = process.argv.slice(2);
let sourceMap = false;
let endianness = "little";
let manifestPath;
let scanKernels = "full";
let outputMode = "single";
const diagnosticsArg = args.find((arg) => arg.startsWith("--diagnostics="));
let diagnosticsFormat =
  diagnosticsArg === undefined ? "text" : diagnosticsArg.slice("--diagnostics=".length);
const positionalArgs = [];
const usage =
  "Usage: zeno-codegen <input.ts> <output.view.ts> [--source-map] [--manifest <layout.json>] [--scan-kernels=none|sum|basic|full] [--output=single|split] [--endian=little|big] [--diagnostics=text|json]";

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

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--help" || arg === "-h") {
    console.log(usage);
    process.exit(0);
  }

  if (arg === "--source-map") {
    sourceMap = true;
    continue;
  }

  if (arg === "--manifest") {
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) {
      fail("INVALID_ARGUMENTS", "Missing path after --manifest.");
    }
    manifestPath = next;
    index += 1;
    continue;
  }

  if (arg.startsWith("--manifest=")) {
    manifestPath = arg.slice("--manifest=".length);
    continue;
  }

  if (arg.startsWith("--endian=")) {
    endianness = arg.slice("--endian=".length);
    continue;
  }

  if (arg.startsWith("--scan-kernels=")) {
    scanKernels = arg.slice("--scan-kernels=".length);
    continue;
  }

  if (arg.startsWith("--output=")) {
    outputMode = arg.slice("--output=".length);
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

if (outputMode !== "single" && outputMode !== "split") {
  fail("INVALID_OUTPUT_MODE", `Invalid output mode: ${outputMode}. Expected "single" or "split".`, {
    outputMode,
  });
}

if (outputMode === "split" && sourceMap) {
  fail("UNSUPPORTED_OPTION_COMBINATION", "--source-map is not supported with --output=split yet.", {
    outputMode,
    sourceMap,
  });
}

const scanKernelMode = parseScanKernelMode(scanKernels);
if (scanKernelMode === null) {
  fail(
    "INVALID_SCAN_KERNEL_MODE",
    `Invalid scan kernel mode: ${scanKernels}. Expected "none", "sum", "basic", or "full".`,
    { scanKernels },
  );
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

const resolvedOutputPath = path.resolve(outputPath);
const emitOptions = { scanKernels: scanKernelMode };
if (outputMode === "split") {
  const splitDirectory = splitDirectoryForOutput(resolvedOutputPath);
  await mkdir(splitDirectory, { recursive: true });
  for (const part of emitProjectionFileParts(result.layouts, emitOptions)) {
    await writeFile(path.join(splitDirectory, part.fileName), part.code, "utf8");
  }
  await writeFile(
    resolvedOutputPath,
    emitProjectionFileBarrel(result.layouts, `./${path.basename(splitDirectory)}`),
    "utf8",
  );
} else if (sourceMap) {
  const emitted = emitProjectionFileWithSourceMap(result.layouts, resolvedOutputPath, emitOptions);
  await writeFile(resolvedOutputPath, emitted.code, "utf8");
  await writeFile(`${resolvedOutputPath}.map`, JSON.stringify(emitted.sourceMap, null, 2), "utf8");
} else {
  await writeFile(resolvedOutputPath, emitProjectionFile(result.layouts, emitOptions), "utf8");
}

if (manifestPath !== undefined) {
  await writeFile(
    path.resolve(manifestPath),
    `${JSON.stringify(createLayoutManifest(result.layouts), null, 2)}\n`,
    "utf8",
  );
}

function splitDirectoryForOutput(outputFilePath) {
  const extension = path.extname(outputFilePath);
  const baseName = path.basename(outputFilePath, extension);
  return path.join(path.dirname(outputFilePath), `${baseName}.views`);
}
