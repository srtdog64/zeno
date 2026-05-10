#!/usr/bin/env node
import { spawn } from "node:child_process";

import { chromium, firefox, webkit } from "playwright";

const browserName = process.env.ZENO_BROWSER ?? "chromium";
const port = Number(process.env.ZENO_BROWSER_PORT ?? 4174);
const target = `http://127.0.0.1:${port}`;
const statusTimeoutMs = Number(process.env.ZENO_BROWSER_STATUS_TIMEOUT_MS ?? 30_000);
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const browserTypes = { chromium, firefox, webkit };
const browserType = browserTypes[browserName];
const headless = process.env.ZENO_BROWSER_HEADLESS === "0" ? false : undefined;

if (!browserType) {
  throw new Error(`Unsupported ZENO_BROWSER: ${browserName}`);
}

const preview = spawn(
  npmBin,
  [
    "run",
    "preview",
    "--workspace",
    "@exornea/zeno-example-webgl-raw-double-buffer",
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
    await page.goto(target);
    await waitForGpuStatus(page, pageErrors, statusTimeoutMs);
    await waitForMetrics(page, statusTimeoutMs);
    await assertVisualRegressionState(page, statusTimeoutMs);

    console.log(
      JSON.stringify(
        {
          event: "raw_webgl_double_buffer_smoke",
          browser: browserName,
          metrics: await page.evaluate(() => window.__zenoRawWebglMetrics),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }

  console.log(`raw WebGL smoke passed: ${browserName}`);
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
      `Timed out waiting for raw WebGL status. Last status: ${status ?? "<missing>"}.${suffix}`,
      {
        cause: error,
      },
    );
  }
}

async function waitForMetrics(page, timeout) {
  await page.waitForFunction(
    () => {
      const metrics = window.__zenoRawWebglMetrics;
      return (
        metrics?.mode === "raw-webgl-double-buffer" &&
        metrics.records > 0 &&
        metrics.payloadBytes > 0 &&
        metrics.uploadedFrames > 0 &&
        metrics.skippedFrames >= 0 &&
        metrics.tornFrames >= 0 &&
        metrics.lastFrameVersion > 0 &&
        Number.isFinite(metrics.lastUploadMs)
      );
    },
    undefined,
    { timeout },
  );
}

async function assertVisualRegressionState(page, timeout) {
  await page.waitForFunction(
    () => {
      const visual = window.__zenoRawWebglVisual;
      return (
        visual !== undefined &&
        visual.frame > 0 &&
        visual.canvasWidth > 0 &&
        visual.canvasHeight > 0 &&
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
