#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const tmpDir = path.join(rootDir, ".tmp-release-check");
const packDir = path.join(tmpDir, "packs");
const consumerDir = path.join(tmpDir, "consumer");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args, cwd = rootDir) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true,
  });
}

function runCapture(command, args, cwd = rootDir) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    windowsHide: true,
  }).trim();
}

function runCaptureFailure(command, args, cwd = rootDir) {
  try {
    execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      windowsHide: true,
    });
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
  }

  throw new Error(`Expected command to fail: ${command} ${args.join(" ")}`);
}

rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(packDir, { recursive: true });
mkdirSync(path.join(consumerDir, "src"), { recursive: true });

run(npmBin, [
  "pack",
  "--workspace",
  "@exornea/zeno-buffers",
  "--workspace",
  "@exornea/zeno-schema",
  "--workspace",
  "@exornea/zeno-types",
  "--workspace",
  "@exornea/zeno-runtime",
  "--workspace",
  "@exornea/zeno-compiler",
  "--pack-destination",
  packDir,
]);

const tarballs = readdirSync(packDir)
  .filter((name) => name.endsWith(".tgz"))
  .sort()
  .map((name) => path.join(packDir, name));

writeFileSync(
  path.join(consumerDir, "package.json"),
  JSON.stringify(
    {
      private: true,
      type: "module",
      scripts: {
        codegen:
          "zeno-codegen ./src/model.zeno.ts ./src/model.view.ts --manifest ./src/model.layout.json",
        "codegen:split":
          "zeno-codegen ./src/model.zeno.ts ./src/model.split.view.ts --output=split --scan-kernels=basic",
        build: "tsc -p tsconfig.json",
        start: "node ./dist/main.js",
      },
    },
    null,
    2,
  ),
);

writeFileSync(
  path.join(consumerDir, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: true,
        outDir: "./dist",
      },
      include: ["src/**/*.ts"],
    },
    null,
    2,
  ),
);

writeFileSync(
  path.join(consumerDir, "src", "model.zeno.ts"),
  `import type { z } from "@exornea/zeno-types";

export interface Mini {
  id: z.u64;
  age: z.i32;
  label: z.fixedUtf8<12>;
  name: z.utf8;
  tags: z.vector<z.utf8>;
}

export interface Item {
  id: z.i32;
  label: z.utf8;
}

export interface Bag {
  items: z.dynamicVector<Item>;
}
`,
);

writeFileSync(
  path.join(consumerDir, "src", "main.ts"),
  `import { packUintFieldsWhereU8Eq } from "@exornea/zeno-buffers";
import { emitProjectionFile } from "@exornea/zeno-compiler";
import { BagView, MiniView } from "./model.view.js";
import { POINTER32_NULL } from "@exornea/zeno-runtime";

if (typeof emitProjectionFile !== "function") {
  throw new Error("Compiler public import did not resolve.");
}

const buffer = new ArrayBuffer(128);
const view = new DataView(buffer);

MiniView.write(view, {
  id: 7n,
  age: 41,
  label: "consumer",
  name: "Zeno",
  tags: ["ts", "abi"],
});

const mini = new MiniView(view);
const packedAge = new Uint32Array(1);
const packedCount = packUintFieldsWhereU8Eq(
  view,
  1,
  MiniView.byteLength,
  MiniView.ageOffset,
  41,
  [{ offset: MiniView.ageOffset, kind: "u32" }],
  packedAge,
);
const result = {
  id: mini.id.toString(),
  age: mini.age,
  label: mini.labelText().replaceAll("\\u0000", ""),
  name: mini.nameView().text(),
  tags: mini.tagsView().textArray(),
  packedAge: packedAge[0],
  packedCount,
  pointerNull: POINTER32_NULL,
};

if (JSON.stringify(result) !== JSON.stringify({
  id: "7",
  age: 41,
  label: "consumer",
  name: "Zeno",
  tags: ["ts", "abi"],
  packedAge: 41,
  packedCount: 1,
  pointerNull: 0xffffffff,
})) {
  throw new Error(\`Unexpected consumer result: \${JSON.stringify(result)}\`);
}

const bagBuffer = new ArrayBuffer(256);
const bagView = new DataView(bagBuffer);
BagView.write(bagView, {
  items: [
    { id: 1, label: "alpha" },
    { id: 2, label: "beta" },
  ],
});

const bag = new BagView(bagView);
const items = bag.itemsView();
if (
  items.length !== 2 ||
  items.at(0).id !== 1 ||
  items.at(0).labelView().text() !== "alpha" ||
  items.at(1).id !== 2 ||
  items.at(1).labelView().text() !== "beta"
) {
  throw new Error("Unexpected dynamicVector consumer result");
}

try {
  // @ts-expect-error Package exports intentionally block runtime internals.
  await import("@exornea/zeno-runtime/dist/abi.js");
  throw new Error("Deep import unexpectedly succeeded");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Package subpath")) {
    throw error;
  }
}

try {
  // @ts-expect-error Package exports intentionally block compiler internals.
  await import("@exornea/zeno-compiler/dist/emitter.js");
  throw new Error("Compiler deep import unexpectedly succeeded");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Package subpath")) {
    throw error;
  }
}

try {
  // @ts-expect-error Package exports intentionally block buffers internals.
  await import("@exornea/zeno-buffers/dist/index.js");
  throw new Error("Buffers deep import unexpectedly succeeded");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Package subpath")) {
    throw error;
  }
}
`,
);

writeFileSync(
  path.join(consumerDir, "src", "invalid.zeno.ts"),
  `import { ProjectionView } from "@exornea/zeno-runtime";
import type { z } from "@exornea/zeno-types";

export const runtimeValue = ProjectionView;

export interface InvalidMini {
  id: z.u64;
}
`,
);

run(npmBin, ["install", "--silent", ...tarballs], consumerDir);
const help = runCapture(npxBin, ["zeno-codegen", "--help"], consumerDir);
if (!help.includes("Usage: zeno-codegen")) {
  throw new Error(`Unexpected zeno-codegen help output: ${help}`);
}
const inspectHelp = runCapture(npxBin, ["zeno-inspect", "--help"], consumerDir);
if (!inspectHelp.includes("Usage: zeno-inspect")) {
  throw new Error(`Unexpected zeno-inspect help output: ${inspectHelp}`);
}
const diffHelp = runCapture(npxBin, ["zeno-diff-layout", "--help"], consumerDir);
if (!diffHelp.includes("Usage: zeno-diff-layout")) {
  throw new Error(`Unexpected zeno-diff-layout help output: ${diffHelp}`);
}
const diagnosticOutput = runCaptureFailure(
  npxBin,
  ["zeno-codegen", "./src/invalid.zeno.ts", "./src/invalid.view.ts", "--diagnostics=json"],
  consumerDir,
);
const diagnosticJson = JSON.parse(diagnosticOutput);
const diagnosticCodes = diagnosticJson.diagnostics.map((diagnostic) => diagnostic.code);
if (
  diagnosticCodes.length !== 2 ||
  diagnosticCodes.some((code) => code !== "UNSUPPORTED_SCHEMA_STATEMENT")
) {
  throw new Error(`Unexpected JSON diagnostics: ${diagnosticOutput}`);
}
const operationalFailureOutput = runCaptureFailure(
  npxBin,
  ["zeno-codegen", "./src/missing.zeno.ts", "./src/missing.view.ts", "--diagnostics=json"],
  consumerDir,
);
const operationalFailureJson = JSON.parse(operationalFailureOutput);
if (
  operationalFailureJson.event !== "Codegen_Failed" ||
  operationalFailureJson.code !== "INPUT_READ_FAILED"
) {
  throw new Error(`Unexpected JSON operational failure: ${operationalFailureOutput}`);
}
run(npmBin, ["run", "codegen", "--silent"], consumerDir);
run(npmBin, ["run", "codegen:split", "--silent"], consumerDir);
const inspectOutput = runCapture(npxBin, ["zeno-inspect", "./src/model.zeno.ts"], consumerDir);
if (!inspectOutput.includes("Struct Mini") || !inspectOutput.includes("Struct Bag")) {
  throw new Error(`Unexpected zeno-inspect output: ${inspectOutput}`);
}
const diffOutput = runCapture(
  npxBin,
  ["zeno-diff-layout", "./src/model.layout.json", "./src/model.layout.json"],
  consumerDir,
);
if (diffOutput !== "No layout differences.") {
  throw new Error(`Unexpected zeno-diff-layout output: ${diffOutput}`);
}
const generatedView = readFileSync(path.join(consumerDir, "src", "model.view.ts"), "utf8");
if (!generatedView.includes('from "@exornea/zeno-runtime"')) {
  throw new Error("Generated view did not import the runtime package root.");
}
if (generatedView.includes("@exornea/zeno-runtime/dist/")) {
  throw new Error("Generated view used a runtime deep import.");
}
const splitBarrel = readFileSync(path.join(consumerDir, "src", "model.split.view.ts"), "utf8");
if (
  !splitBarrel.includes('export * from "./model.split.view.views/Mini.view.js";') ||
  !splitBarrel.includes('export * from "./model.split.view.views/Bag.view.js";')
) {
  throw new Error(`Unexpected split generated barrel: ${splitBarrel}`);
}
const splitMiniView = readFileSync(
  path.join(consumerDir, "src", "model.split.view.views", "Mini.view.ts"),
  "utf8",
);
if (!splitMiniView.includes('from "@exornea/zeno-runtime"')) {
  throw new Error("Split generated view did not import the runtime package root.");
}
run(npmBin, ["run", "build", "--silent"], consumerDir);
run(npmBin, ["run", "start", "--silent"], consumerDir);

rmSync(tmpDir, { recursive: true, force: true });
console.log("consumer smoke passed");
