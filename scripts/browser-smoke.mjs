#!/usr/bin/env node
import { spawn } from "node:child_process";

import { chromium, firefox, webkit } from "playwright";

const browserName = process.env.ZENO_BROWSER ?? "chromium";
const port = Number(process.env.ZENO_BROWSER_PORT ?? 4173);
const target = `http://127.0.0.1:${port}`;
const recordCount = Number(process.env.ZENO_BROWSER_RECORD_COUNT ?? 10_000);
const statusTimeoutMs = Number(
  process.env.ZENO_BROWSER_STATUS_TIMEOUT_MS ?? (browserName === "firefox" ? 60_000 : 30_000),
);
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const browserTypes = { chromium, firefox, webkit };
const browserType = browserTypes[browserName];

if (!browserType) {
  throw new Error(`Unsupported ZENO_BROWSER: ${browserName}`);
}

if (!Number.isInteger(recordCount) || recordCount <= 0) {
  throw new Error(`Invalid ZENO_BROWSER_RECORD_COUNT: ${recordCount}`);
}

if (!Number.isInteger(statusTimeoutMs) || statusTimeoutMs <= 0) {
  throw new Error(`Invalid ZENO_BROWSER_STATUS_TIMEOUT_MS: ${statusTimeoutMs}`);
}

const preview = spawn(
  npmBin,
  [
    "run",
    "preview",
    "--workspace",
    "@exornea/zeno-example-webgl-instance-streamer",
    "--",
    "--port",
    String(port),
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true,
  },
);

try {
  await waitForServer(target);
  const browser = await browserType.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(`${target}/?count=${recordCount}`);
    await waitForGpuStatus(page, pageErrors, statusTimeoutMs);
    await page.selectOption("[data-testid='record-count']", String(recordCount));
    await page.getByRole("button", { name: "Zeno binary" }).click();
    await waitForGpuStatus(page, pageErrors, statusTimeoutMs);
    await page.getByRole("button", { name: "FlatBuffers" }).click();
    await page.waitForFunction(
      () => document.querySelector("[data-testid='mode']")?.textContent === "FLAT",
    );
    await waitForGpuStatus(page, pageErrors, statusTimeoutMs);
    await page.getByRole("button", { name: "JSON objects" }).click();
    await page.waitForFunction(
      () => document.querySelector("[data-testid='mode']")?.textContent === "JSON",
    );
    await waitForGpuStatus(page, pageErrors, statusTimeoutMs);

    const payload = await page.locator("[data-metric='payload']").textContent();
    if (!payload || payload === "-") {
      throw new Error("Browser smoke did not render payload metrics.");
    }
  } finally {
    await browser.close();
  }

  console.log(`browser smoke passed: ${browserName}`);
} finally {
  preview.kill();
}

async function waitForGpuStatus(page, pageErrors, timeout) {
  try {
    await page.waitForFunction(
      () =>
        document.querySelector("[data-testid='status']")?.textContent?.includes("instances on GPU"),
      undefined,
      { timeout },
    );
  } catch (error) {
    const status = await page
      .locator("[data-testid='status']")
      .textContent()
      .catch(() => null);
    const suffix =
      pageErrors.length === 0 ? "" : ` Page errors: ${pageErrors.slice(-3).join(" | ")}`;
    throw new Error(
      `Timed out waiting for GPU status. Last status: ${status ?? "<missing>"}.${suffix}`,
      {
        cause: error,
      },
    );
  }
}

async function waitForServer(url) {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until Vite preview is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}
