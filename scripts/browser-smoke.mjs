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
const headless = process.env.ZENO_BROWSER_HEADLESS === "0" ? false : undefined;

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
  const browser = await browserType.launch(browserLaunchOptions(browserName));
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(`${target}/?count=${recordCount}`);
    await waitForGpuStatus(page, pageErrors, statusTimeoutMs);
    const browserBenchmarks = [];
    browserBenchmarks.push(await waitForModeMetrics(page, "zeno", statusTimeoutMs));
    await page.selectOption("[data-testid='record-count']", String(recordCount));
    await page.getByRole("button", { name: "Zeno binary" }).click();
    await waitForGpuStatus(page, pageErrors, statusTimeoutMs);
    browserBenchmarks.push(await waitForModeMetrics(page, "zeno", statusTimeoutMs));
    await page.getByRole("button", { name: "Zeno vectors" }).click();
    await page.waitForFunction(
      () => document.querySelector("[data-testid='mode']")?.textContent === "VECTOR",
    );
    await waitForGpuStatus(page, pageErrors, statusTimeoutMs);
    browserBenchmarks.push(await waitForModeMetrics(page, "zeno-vector", statusTimeoutMs));
    await page.getByRole("button", { name: "FlatBuffers" }).click();
    await page.waitForFunction(
      () => document.querySelector("[data-testid='mode']")?.textContent === "FLAT",
    );
    await waitForGpuStatus(page, pageErrors, statusTimeoutMs);
    browserBenchmarks.push(await waitForModeMetrics(page, "flatbuffers", statusTimeoutMs));
    await page.getByRole("button", { name: "JSON objects" }).click();
    await page.waitForFunction(
      () => document.querySelector("[data-testid='mode']")?.textContent === "JSON",
    );
    await waitForGpuStatus(page, pageErrors, statusTimeoutMs);
    browserBenchmarks.push(await waitForModeMetrics(page, "json", statusTimeoutMs));
    await assertVisualRegressionState(page, statusTimeoutMs);

    const payload = await page.locator("[data-metric='payload']").textContent();
    if (!payload || payload === "-") {
      throw new Error("Browser smoke did not render payload metrics.");
    }

    console.log(
      JSON.stringify(
        {
          event: "browser_benchmark",
          browser: browserName,
          records: recordCount,
          modes: browserBenchmarks,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }

  console.log(`browser smoke passed: ${browserName}`);
} finally {
  preview.kill();
}

function browserLaunchOptions(name) {
  if (name === "chromium") {
    return {
      args: [
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
        "--use-angle=swiftshader",
        "--use-gl=angle",
      ],
      headless,
    };
  }

  if (name === "firefox") {
    return {
      firefoxUserPrefs: {
        "webgl.disabled": false,
        "webgl.enable-webgl2": true,
        "webgl.force-enabled": true,
        "webgl.msaa-force": false,
      },
      headless,
    };
  }

  return { headless };
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

async function waitForModeMetrics(page, mode, timeout) {
  await page.waitForFunction(
    (expectedMode) => {
      const metrics = window.__zenoWebglMetrics;
      return (
        metrics?.mode === expectedMode &&
        metrics.records > 0 &&
        metrics.payloadBytes > 0 &&
        metrics.rendered > 0 &&
        Number.isFinite(metrics.buildMs) &&
        Number.isFinite(metrics.parseMs) &&
        Number.isFinite(metrics.packMs) &&
        Number.isFinite(metrics.uploadMs)
      );
    },
    mode,
    { timeout },
  );

  return page.evaluate(() => window.__zenoWebglMetrics);
}

async function assertVisualRegressionState(page, timeout) {
  await page.waitForFunction(
    () => {
      const visual = window.__zenoWebglVisual;
      return (
        visual !== undefined &&
        visual.frame > 0 &&
        visual.canvasWidth > 0 &&
        visual.canvasHeight > 0 &&
        visual.meshCount > 0 &&
        visual.maxPixel > 0 &&
        visual.nonTransparentPixels > 0
      );
    },
    undefined,
    { timeout },
  );
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
