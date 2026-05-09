#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
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
  "--workspace", "@zeno/schema",
  "--workspace", "@zeno/types",
  "--workspace", "@zeno/runtime",
  "--workspace", "@zeno/compiler",
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
        codegen: "zeno-codegen ./src/model.zeno.ts ./src/model.view.ts",
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
  `import type { z } from "@zeno/types";

export interface Mini {
  id: z.u64;
  age: z.i32;
  label: z.fixedUtf8<12>;
  name: z.utf8;
  tags: z.vector<z.utf8>;
}
`,
);

writeFileSync(
  path.join(consumerDir, "src", "main.ts"),
  `import { MiniView } from "./model.view.js";
import { POINTER32_NULL } from "@zeno/runtime";

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
const result = {
  id: mini.id.toString(),
  age: mini.age,
  label: mini.labelText().replaceAll("\\u0000", ""),
  name: mini.nameView().text(),
  tags: mini.tagsView().toArray(),
  pointerNull: POINTER32_NULL,
};

if (JSON.stringify(result) !== JSON.stringify({
  id: "7",
  age: 41,
  label: "consumer",
  name: "Zeno",
  tags: ["ts", "abi"],
  pointerNull: 0xffffffff,
})) {
  throw new Error(\`Unexpected consumer result: \${JSON.stringify(result)}\`);
}

try {
  // @ts-expect-error Package exports intentionally block runtime internals.
  await import("@zeno/runtime/dist/abi.js");
  throw new Error("Deep import unexpectedly succeeded");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Package subpath")) {
    throw error;
  }
}
`,
);

writeFileSync(
  path.join(consumerDir, "src", "invalid.zeno.ts"),
  `import { ProjectionView } from "@zeno/runtime";
import type { z } from "@zeno/types";

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
const diagnosticOutput = runCaptureFailure(
  npxBin,
  [
    "zeno-codegen",
    "./src/invalid.zeno.ts",
    "./src/invalid.view.ts",
    "--diagnostics=json",
  ],
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
run(npmBin, ["run", "codegen", "--silent"], consumerDir);
run(npmBin, ["run", "build", "--silent"], consumerDir);
run(npmBin, ["run", "start", "--silent"], consumerDir);

rmSync(tmpDir, { recursive: true, force: true });
console.log("consumer smoke passed");
