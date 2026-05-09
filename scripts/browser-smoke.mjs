#!/usr/bin/env node
import { spawn } from "node:child_process";

import { chromium, firefox, webkit } from "playwright";

const browserName = process.env.ZENO_BROWSER ?? "chromium";
const port = Number(process.env.ZENO_BROWSER_PORT ?? 4173);
const target = `http://127.0.0.1:${port}`;
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const browserTypes = { chromium, firefox, webkit };
const browserType = browserTypes[browserName];

if (!browserType) {
  throw new Error(`Unsupported ZENO_BROWSER: ${browserName}`);
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

  try {
    await page.goto(target);
    await page.selectOption("[data-testid='record-count']", "100000");
    await page.getByRole("button", { name: "Zeno binary" }).click();
    await page.waitForFunction(() =>
      document.querySelector("[data-testid='status']")?.textContent?.includes("instances on GPU"),
    );
    await page.getByRole("button", { name: "FlatBuffers" }).click();
    await page.waitForFunction(
      () => document.querySelector("[data-testid='mode']")?.textContent === "FLAT",
    );
    await page.getByRole("button", { name: "JSON objects" }).click();
    await page.waitForFunction(
      () => document.querySelector("[data-testid='mode']")?.textContent === "JSON",
    );

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
