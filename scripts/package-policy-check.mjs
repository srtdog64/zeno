#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "..", "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function stable(value) {
  if (Array.isArray(value)) {
    return value.map(stable);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stable(nestedValue)]),
    );
  }

  return value;
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(stable(actual));
  const expectedJson = JSON.stringify(stable(expected));
  if (actualJson !== expectedJson) {
    throw new Error(`${label}: expected ${expectedJson}, got ${actualJson}`);
  }
}

function assertAbsent(object, key, label) {
  if (Object.hasOwn(object, key)) {
    throw new Error(`${label}: unexpected ${key}`);
  }
}

const rootPackage = readJson("package.json");
assertDeepEqual(rootPackage.private, true, "root private flag");
assertDeepEqual(rootPackage.workspaces, ["packages/*", "examples/*"], "root workspaces");

const rootExport = {
  ".": {
    types: "./dist/index.d.ts",
    default: "./dist/index.js",
  },
};

const policies = [
  {
    path: "packages/compiler/package.json",
    name: "@exornea/zeno-compiler",
    files: ["dist/", "bin/", "!dist/plugin.*"],
    dependencies: {
      "@exornea/zeno-schema": rootPackage.version,
      typescript: "^5.9.0",
    },
    bin: {
      "zeno-codegen": "./bin/zeno-codegen.mjs",
    },
  },
  {
    path: "packages/runtime/package.json",
    name: "@exornea/zeno-runtime",
    files: ["dist/"],
    dependencies: {
      "@exornea/zeno-types": rootPackage.version,
    },
  },
  {
    path: "packages/schema/package.json",
    name: "@exornea/zeno-schema",
    files: ["dist/"],
  },
  {
    path: "packages/types/package.json",
    name: "@exornea/zeno-types",
    files: ["dist/"],
  },
];

for (const policy of policies) {
  const manifest = readJson(policy.path);
  assertDeepEqual(manifest.name, policy.name, `${policy.path} name`);
  assertDeepEqual(manifest.type, "module", `${policy.path} module type`);
  assertDeepEqual(manifest.main, "./dist/index.js", `${policy.path} main`);
  assertDeepEqual(manifest.types, "./dist/index.d.ts", `${policy.path} types`);
  assertDeepEqual(manifest.files, policy.files, `${policy.path} files`);
  assertDeepEqual(manifest.exports, rootExport, `${policy.path} root-only exports`);

  if (policy.dependencies === undefined) {
    assertAbsent(manifest, "dependencies", policy.path);
  } else {
    assertDeepEqual(manifest.dependencies, policy.dependencies, `${policy.path} dependencies`);
  }

  if (policy.bin === undefined) {
    assertAbsent(manifest, "bin", policy.path);
  } else {
    assertDeepEqual(manifest.bin, policy.bin, `${policy.path} bin`);
  }

  assertAbsent(manifest, "devDependencies", policy.path);
  assertAbsent(manifest, "peerDependencies", policy.path);
  assertAbsent(manifest, "optionalDependencies", policy.path);
}

console.log("package policy check passed");
