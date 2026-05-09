#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "..", "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const rootPackage = readJson("package.json");
const lockfile = readJson("package-lock.json");
const packagePaths = [
  ["packages/compiler", "packages/compiler/package.json"],
  ["packages/runtime", "packages/runtime/package.json"],
  ["packages/schema", "packages/schema/package.json"],
  ["packages/types", "packages/types/package.json"],
];
const workspacePackages = packagePaths.map(([lockKey, packagePath]) => ({
  lockKey,
  packagePath,
  manifest: readJson(packagePath),
}));

const version = rootPackage.version;
assertEqual(lockfile.version, version, "package-lock root version");
assertEqual(lockfile.packages[""].version, version, "package-lock workspace root version");

for (const { lockKey, packagePath, manifest } of workspacePackages) {
  assertEqual(manifest.version, version, `${packagePath} version`);

  const lockPackage = lockfile.packages[lockKey];
  if (lockPackage === undefined) {
    throw new Error(`package-lock missing ${packagePath}`);
  }
  assertEqual(lockPackage.version, version, `package-lock ${packagePath} version`);
}

const compilerPackage = readJson("packages/compiler/package.json");
const runtimePackage = readJson("packages/runtime/package.json");
assertEqual(
  compilerPackage.dependencies?.["@exornea/zeno-schema"],
  version,
  "@exornea/zeno-compiler dependency @exornea/zeno-schema",
);
assertEqual(
  runtimePackage.dependencies?.["@exornea/zeno-types"],
  version,
  "@exornea/zeno-runtime dependency @exornea/zeno-types",
);

const lockCompiler = lockfile.packages["packages/compiler"];
const lockRuntime = lockfile.packages["packages/runtime"];
assertEqual(
  lockCompiler.dependencies?.["@exornea/zeno-schema"],
  version,
  "package-lock @exornea/zeno-compiler dependency @exornea/zeno-schema",
);
assertEqual(
  lockRuntime.dependencies?.["@exornea/zeno-types"],
  version,
  "package-lock @exornea/zeno-runtime dependency @exornea/zeno-types",
);

console.log(`version check passed: ${version}`);
