#!/usr/bin/env node
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "..", "..");

for (const relativePath of [
  "packages/compiler/dist",
  "packages/runtime/dist",
  "packages/schema/dist",
  "packages/types/dist",
  "examples/basic/dist",
]) {
  rmSync(path.join(rootDir, relativePath), { recursive: true, force: true });
}
