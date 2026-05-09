#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

import { SharedDynamicLayoutWriter } from "../packages/runtime/dist/index.js";

const rootDir = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const runtimeUrl = pathToFileURL(path.join(rootDir, "packages/runtime/dist/index.js")).href;
const workerCount = 4;
const writesPerWorker = 256;
const bytesPerWrite = 4;
const payloadByteLength = workerCount * writesPerWorker * bytesPerWrite + 64;
const cursorByteOffset = payloadByteLength;
const buffer = new SharedArrayBuffer(payloadByteLength + Int32Array.BYTES_PER_ELEMENT);
const tempDir = mkdtempSync(path.join(tmpdir(), "zeno-shared-stress-"));
const workerFile = path.join(tempDir, "worker.mjs");

SharedDynamicLayoutWriter.initializeCursor(buffer, 0, { cursorByteOffset });

writeFileSync(
  workerFile,
  `import { parentPort, workerData } from "node:worker_threads";
import { SharedDynamicLayoutWriter } from ${JSON.stringify(runtimeUrl)};

const writer = SharedDynamicLayoutWriter.fromSharedBuffer(workerData.buffer, {
  byteOffset: 0,
  byteLength: workerData.payloadByteLength,
  cursorByteOffset: workerData.cursorByteOffset,
});
const descriptors = [];

for (let index = 0; index < workerData.writesPerWorker; index += 1) {
  descriptors.push(writer.appendBytes([
    workerData.workerIndex,
    index & 0xff,
    (index >>> 8) & 0xff,
    0xa5,
  ]));
}

parentPort.postMessage(descriptors);
`,
);

try {
  const results = await Promise.all(
    Array.from({ length: workerCount }, (_, workerIndex) =>
      runWorker(workerFile, {
        buffer,
        cursorByteOffset,
        payloadByteLength,
        workerIndex,
        writesPerWorker,
      }),
    ),
  );

  const ranges = results.flatMap((descriptors, workerIndex) =>
    descriptors.map((descriptor, writeIndex) => ({
      workerIndex,
      writeIndex,
      start: descriptor.relOffset,
      end: descriptor.relOffset + descriptor.byteLength,
    })),
  );
  ranges.sort((left, right) => left.start - right.start);

  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    if (range.end > payloadByteLength) {
      throw new Error(`Shared writer range exceeded payload: ${JSON.stringify(range)}`);
    }
    if (index > 0 && ranges[index - 1].end > range.start) {
      throw new Error(
        `Shared writer ranges overlapped: ${JSON.stringify(ranges[index - 1])} ${JSON.stringify(range)}`,
      );
    }

    const bytes = new Uint8Array(buffer, range.start, bytesPerWrite);
    if (
      bytes[0] !== range.workerIndex ||
      bytes[1] !== (range.writeIndex & 0xff) ||
      bytes[2] !== ((range.writeIndex >>> 8) & 0xff) ||
      bytes[3] !== 0xa5
    ) {
      throw new Error(`Shared writer payload corrupted at ${JSON.stringify(range)}`);
    }
  }

  const cursor = new Int32Array(buffer, cursorByteOffset, 1);
  const expectedTail = workerCount * writesPerWorker * bytesPerWrite;
  if (Atomics.load(cursor, 0) !== expectedTail) {
    throw new Error(`Unexpected shared arena tail: ${Atomics.load(cursor, 0)} !== ${expectedTail}`);
  }

  console.log("shared writer stress passed");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function runWorker(filename, workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(filename, { workerData });
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Shared writer worker exited with code ${code}`));
      }
    });
  });
}
