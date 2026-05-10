import {
  BUFFER_COUNT,
  BYTES_PER_FRAME,
  ControlCell,
  FLOATS_PER_BUFFER,
  FLOATS_PER_INSTANCE,
  INSTANCE_COUNT,
  claimPublishedFrame,
  controlIndex,
  createControlBuffer,
  createDataBuffer,
  markFrameUploadComplete,
  type SimulationInitMessage,
} from "./shared";
import "./style.css";

type RawWebglMetrics = {
  readonly mode: "raw-webgl-double-buffer";
  readonly records: number;
  readonly payloadBytes: number;
  readonly uploadedFrames: number;
  readonly skippedFrames: number;
  readonly tornFrames: number;
  readonly lastFrameVersion: number;
  readonly lastUploadMs: number;
};

type RawWebglVisual = {
  readonly frame: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly maxPixel: number;
  readonly nonTransparentPixels: number;
};

declare global {
  interface Window {
    __zenoRawWebglMetrics?: RawWebglMetrics;
    __zenoRawWebglVisual?: RawWebglVisual;
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (app === null) {
  throw new Error("Missing app root.");
}

app.innerHTML = `
  <main class="shell">
    <canvas data-testid="canvas"></canvas>
    <section class="hud">
      <h1 class="title">Raw WebGL Double Buffer</h1>
      <div class="status" data-testid="status">Initializing renderer</div>
      <div class="metrics">
        <div class="metric"><div class="label">Instances</div><div class="value" data-metric="instances">-</div></div>
        <div class="metric"><div class="label">Payload</div><div class="value" data-metric="payload">-</div></div>
        <div class="metric"><div class="label">Upload</div><div class="value" data-metric="upload">-</div></div>
        <div class="metric"><div class="label">Skipped</div><div class="value" data-metric="skipped">-</div></div>
        <div class="metric"><div class="label">Torn</div><div class="value" data-metric="torn">-</div></div>
      </div>
    </section>
  </main>
`;

const canvas = app.querySelector<HTMLCanvasElement>("[data-testid='canvas']");
const statusLine = app.querySelector<HTMLDivElement>("[data-testid='status']");
const metricInstances = app.querySelector<HTMLDivElement>("[data-metric='instances']");
const metricPayload = app.querySelector<HTMLDivElement>("[data-metric='payload']");
const metricUpload = app.querySelector<HTMLDivElement>("[data-metric='upload']");
const metricSkipped = app.querySelector<HTMLDivElement>("[data-metric='skipped']");
const metricTorn = app.querySelector<HTMLDivElement>("[data-metric='torn']");

if (
  canvas === null ||
  statusLine === null ||
  metricInstances === null ||
  metricPayload === null ||
  metricUpload === null ||
  metricSkipped === null ||
  metricTorn === null
) {
  throw new Error("Missing UI nodes.");
}

if (typeof SharedArrayBuffer === "undefined" || !crossOriginIsolated) {
  throw new Error("SharedArrayBuffer requires COOP/COEP and a cross-origin isolated page.");
}

const gl = canvas.getContext("webgl2", {
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
});
if (gl === null) {
  throw new Error("WebGL2 is required.");
}

const controlBuffer = createControlBuffer();
const dataBuffer = createDataBuffer();
const control = new Int32Array(controlBuffer);
const frameViews = Array.from(
  { length: BUFFER_COUNT },
  (_, index) => new Float32Array(dataBuffer, index * BYTES_PER_FRAME, FLOATS_PER_BUFFER),
);

const vertexShaderSource = `#version 300 es
in vec2 aPosition;
in vec4 iMatrix0;
in vec4 iMatrix1;
in vec4 iMatrix2;
in vec4 iMatrix3;
in vec4 iColor;

out vec4 vColor;

void main() {
  mat4 model = mat4(iMatrix0, iMatrix1, iMatrix2, iMatrix3);
  gl_Position = model * vec4(aPosition, 0.0, 1.0);
  vColor = iColor;
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

in vec4 vColor;
out vec4 outColor;

void main() {
  outColor = vColor;
}
`;

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
const vertexBuffer = createVertexBuffer(gl);
const instanceBuffer = createInstanceBuffer(gl);
const vao = createVertexArray(gl, program, vertexBuffer, instanceBuffer);
const worker = new Worker(new URL("./simulation-worker.ts", import.meta.url), {
  type: "module",
});
const workerInit: SimulationInitMessage = {
  type: "init",
  controlBuffer,
  dataBuffer,
};
worker.postMessage(workerInit);

let uploadedFrames = 0;
let lastFrameVersion = -1;
let lastUploadMs = 0;
let frame = 0;

resize();
window.addEventListener("resize", resize);
requestAnimationFrame(render);

function resize(): void {
  const width = Math.max(1, canvas.clientWidth || window.innerWidth);
  const height = Math.max(1, canvas.clientHeight || window.innerHeight);
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function render(): void {
  frame += 1;
  uploadPublishedFrame();

  gl.clearColor(0.02, 0.04, 0.05, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, INSTANCE_COUNT);
  gl.bindVertexArray(null);

  updateUi();
  updateVisualState();
  requestAnimationFrame(render);
}

function uploadPublishedFrame(): void {
  const publishedFrame = claimPublishedFrame(control, lastFrameVersion);
  if (publishedFrame === null) {
    return;
  }

  const started = performance.now();
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, frameViews[publishedFrame.readBuffer]);
  lastUploadMs = performance.now() - started;
  markFrameUploadComplete(control, publishedFrame.readBuffer);
  lastFrameVersion = publishedFrame.frameVersion;
  uploadedFrames += 1;
}

function updateUi(): void {
  statusLine.textContent = `${INSTANCE_COUNT.toLocaleString("en-US")} instances on GPU from SharedArrayBuffer slot ${Atomics.load(control, controlIndex(ControlCell.readBuffer))}`;
  metricInstances.textContent = INSTANCE_COUNT.toLocaleString("en-US");
  metricPayload.textContent = formatBytes(BYTES_PER_FRAME);
  metricUpload.textContent = `${lastUploadMs.toFixed(lastUploadMs >= 10 ? 1 : 2)} ms`;
  metricSkipped.textContent = Atomics.load(
    control,
    controlIndex(ControlCell.skippedFrames),
  ).toLocaleString("en-US");
  metricTorn.textContent = Atomics.load(
    control,
    controlIndex(ControlCell.tornFrames),
  ).toLocaleString("en-US");
  window.__zenoRawWebglMetrics = {
    mode: "raw-webgl-double-buffer",
    records: INSTANCE_COUNT,
    payloadBytes: BYTES_PER_FRAME,
    uploadedFrames,
    skippedFrames: Atomics.load(control, controlIndex(ControlCell.skippedFrames)),
    tornFrames: Atomics.load(control, controlIndex(ControlCell.tornFrames)),
    lastFrameVersion,
    lastUploadMs,
  };
}

function updateVisualState(): void {
  const pixels = new Uint8Array(4 * 4 * 4);
  gl.readPixels(0, 0, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  let maxPixel = 0;
  let nonTransparentPixels = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    maxPixel = Math.max(maxPixel, pixels[index], pixels[index + 1], pixels[index + 2]);
    if (pixels[index + 3] !== 0) {
      nonTransparentPixels += 1;
    }
  }

  window.__zenoRawWebglVisual = {
    frame,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    maxPixel,
    nonTransparentPixels,
  };
}

function createVertexBuffer(context: WebGL2RenderingContext): WebGLBuffer {
  const vertices = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
  const buffer = mustCreateBuffer(context);
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(context.ARRAY_BUFFER, vertices, context.STATIC_DRAW);
  return buffer;
}

function createInstanceBuffer(context: WebGL2RenderingContext): WebGLBuffer {
  const buffer = mustCreateBuffer(context);
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(context.ARRAY_BUFFER, BYTES_PER_FRAME, context.DYNAMIC_DRAW);
  return buffer;
}

function createVertexArray(
  context: WebGL2RenderingContext,
  shaderProgram: WebGLProgram,
  vertexBuffer: WebGLBuffer,
  instanceBuffer: WebGLBuffer,
): WebGLVertexArrayObject {
  const vao = context.createVertexArray();
  if (vao === null) {
    throw new Error("Failed to create vertex array.");
  }

  context.bindVertexArray(vao);
  context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
  const positionLocation = context.getAttribLocation(shaderProgram, "aPosition");
  context.enableVertexAttribArray(positionLocation);
  context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0);

  context.bindBuffer(context.ARRAY_BUFFER, instanceBuffer);
  const stride = FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT;
  bindInstanceVec4(context, shaderProgram, "iMatrix0", stride, 0);
  bindInstanceVec4(context, shaderProgram, "iMatrix1", stride, 4);
  bindInstanceVec4(context, shaderProgram, "iMatrix2", stride, 8);
  bindInstanceVec4(context, shaderProgram, "iMatrix3", stride, 12);
  bindInstanceVec4(context, shaderProgram, "iColor", stride, 16);

  context.bindVertexArray(null);
  return vao;
}

function bindInstanceVec4(
  context: WebGL2RenderingContext,
  shaderProgram: WebGLProgram,
  name: string,
  stride: number,
  floatOffset: number,
): void {
  const location = context.getAttribLocation(shaderProgram, name);
  if (location < 0) {
    throw new Error(`Missing shader attribute: ${name}`);
  }
  context.enableVertexAttribArray(location);
  context.vertexAttribPointer(
    location,
    4,
    context.FLOAT,
    false,
    stride,
    floatOffset * Float32Array.BYTES_PER_ELEMENT,
  );
  context.vertexAttribDivisor(location, 1);
}

function createProgram(
  context: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentSource);
  const shaderProgram = context.createProgram();
  if (shaderProgram === null) {
    throw new Error("Failed to create WebGL program.");
  }

  context.attachShader(shaderProgram, vertexShader);
  context.attachShader(shaderProgram, fragmentShader);
  context.linkProgram(shaderProgram);
  if (!context.getProgramParameter(shaderProgram, context.LINK_STATUS)) {
    throw new Error(context.getProgramInfoLog(shaderProgram) ?? "WebGL program link failed.");
  }

  context.deleteShader(vertexShader);
  context.deleteShader(fragmentShader);
  return shaderProgram;
}

function compileShader(context: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = context.createShader(type);
  if (shader === null) {
    throw new Error("Failed to create WebGL shader.");
  }

  context.shaderSource(shader, source);
  context.compileShader(shader);
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    throw new Error(context.getShaderInfoLog(shader) ?? "WebGL shader compile failed.");
  }

  return shader;
}

function mustCreateBuffer(context: WebGL2RenderingContext): WebGLBuffer {
  const buffer = context.createBuffer();
  if (buffer === null) {
    throw new Error("Failed to create WebGL buffer.");
  }
  return buffer;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
