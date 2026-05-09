#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const npmCommand = "npm";
const useShell = process.platform === "win32";
const packages = [
  "@exornea/zeno-types",
  "@exornea/zeno-schema",
  "@exornea/zeno-runtime",
  "@exornea/zeno-compiler",
];

const options = parseArgs(process.argv.slice(2));
const version = readJson("package.json").version;

for (const packageName of packages) {
  const published = isPublished(packageName, version);
  if (published && !options.force) {
    console.log(`skip ${packageName}@${version}: already published`);
    continue;
  }

  const args = [
    "publish",
    "--workspace",
    packageName,
    "--access",
    options.access,
    "--tag",
    options.tag,
  ];

  if (options.dryRun) {
    args.push("--dry-run");
  }

  if (options.otp !== undefined) {
    args.push(`--otp=${options.otp}`);
  }

  console.log(`${options.dryRun ? "dry-run" : "publish"} ${packageName}@${version}`);
  run(args);
}

function parseArgs(args) {
  const options = {
    access: "public",
    dryRun: false,
    force: false,
    otp: process.env.NPM_CONFIG_OTP,
    tag: "latest",
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg.startsWith("--otp=")) {
      options.otp = arg.slice("--otp=".length);
      continue;
    }

    if (arg.startsWith("--tag=")) {
      options.tag = arg.slice("--tag=".length);
      continue;
    }

    if (arg.startsWith("--access=")) {
      options.access = arg.slice("--access=".length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function isPublished(packageName, packageVersion) {
  const result = spawnNpm(["view", `${packageName}@${packageVersion}`, "version", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status === 0) {
    return true;
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const output = `${stdout}\n${stderr}`;
  if (output.includes("E404") || output.includes("404 Not Found")) {
    return false;
  }

  process.stdout.write(stdout);
  process.stderr.write(stderr);
  throw new Error(`Failed to check ${packageName}@${packageVersion}`);
}

function run(args) {
  const result = spawnNpm(args, { stdio: "inherit" });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function spawnNpm(args, options) {
  return spawnSync(npmCommand, args, {
    cwd: rootDir,
    shell: useShell,
    ...options,
  });
}
