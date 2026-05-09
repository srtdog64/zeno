import * as THREE from "three";
import { Builder, ByteBuffer } from "flatbuffers";

import {
  InstanceView,
  InstanceViewByteLength,
  InstanceViewColorOffset,
  InstanceViewIdOffset,
  InstanceViewMaterialIdOffset,
  InstanceViewMeshIdOffset,
  InstanceViewScaleOffset,
  InstanceViewXOffset,
  InstanceViewYOffset,
  InstanceViewZOffset,
} from "./schema.view";
import "./style.css";

type Mode = "zeno" | "flatbuffers" | "json";

type JsonInstance = {
  id: number;
  meshId: number;
  materialId: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  color: number;
};

type Metrics = {
  mode: Mode;
  records: number;
  payloadBytes: number;
  buildMs: number;
  parseMs: number;
  packMs: number;
  uploadMs: number;
  rendered: number;
};

const DEFAULT_COUNT = 100_000;
const MAX_RENDERED = 250_000;
const RADIUS = 180;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing app root.");
}

app.innerHTML = `
  <main class="shell">
    <div class="viewport" data-testid="viewport"></div>
    <section class="hud">
      <div class="panel control-panel">
        <div class="title-row">
          <h1 class="title">Zeno WebGL Streamer</h1>
          <div class="mode-pill" data-testid="mode">ZENO</div>
        </div>
        <div class="toolbar">
          <select class="record-select" data-testid="record-count" aria-label="record count">
            <option value="50000">50,000 instances</option>
            <option value="100000" selected>100,000 instances</option>
            <option value="250000">250,000 instances</option>
          </select>
          <button class="run-button" data-mode="zeno" data-active="true">Zeno binary</button>
          <button class="run-button" data-mode="flatbuffers">FlatBuffers</button>
          <button class="run-button" data-mode="json">JSON objects</button>
        </div>
      </div>
      <div class="panel metrics" data-testid="metrics">
        <div class="metric"><div class="metric-label">Payload</div><div class="metric-value" data-metric="payload">-</div></div>
        <div class="metric"><div class="metric-label">Build</div><div class="metric-value" data-metric="build">-</div></div>
        <div class="metric"><div class="metric-label">Parse</div><div class="metric-value" data-metric="parse">-</div></div>
        <div class="metric"><div class="metric-label">Pack + GPU</div><div class="metric-value" data-metric="pack">-</div></div>
      </div>
    </section>
    <div class="footer-strip">
      <div class="status-line" data-testid="status">Initializing renderer</div>
      <div class="legend" aria-hidden="true">
        <span class="legend-item"><span class="swatch swatch-a"></span>28 B stride</span>
        <span class="legend-item"><span class="swatch swatch-b"></span>f32 xyz</span>
        <span class="legend-item"><span class="swatch swatch-c"></span>u32 color</span>
      </div>
    </div>
  </main>
`;

const viewport = app.querySelector<HTMLDivElement>("[data-testid='viewport']")!;
const modePill = app.querySelector<HTMLDivElement>("[data-testid='mode']")!;
const statusLine = app.querySelector<HTMLDivElement>("[data-testid='status']")!;
const recordSelect = app.querySelector<HTMLSelectElement>("[data-testid='record-count']")!;
const runButtons = [...app.querySelectorAll<HTMLButtonElement>(".run-button")];
const metricPayload = app.querySelector<HTMLDivElement>("[data-metric='payload']")!;
const metricBuild = app.querySelector<HTMLDivElement>("[data-metric='build']")!;
const metricParse = app.querySelector<HTMLDivElement>("[data-metric='parse']")!;
const metricPack = app.querySelector<HTMLDivElement>("[data-metric='pack']")!;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x071014, 1);
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x071014, 0.0012);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 1000);
camera.position.set(0, 80, 230);

const group = new THREE.Group();
scene.add(group);

const ambient = new THREE.AmbientLight(0xdff7ff, 1.1);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(90, 140, 70);
scene.add(key);

const fill = new THREE.DirectionalLight(0x34b78f, 1.1);
fill.position.set(-120, 60, -90);
scene.add(fill);

let mesh: THREE.InstancedMesh | undefined;
let activeMode: Mode = "zeno";
let activeCount = DEFAULT_COUNT;
let running = false;

function createMesh(count: number) {
  if (mesh) {
    group.remove(mesh);
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      for (const material of mesh.material) {
        material.dispose();
      }
    } else {
      mesh.material.dispose();
    }
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x34b78f,
    fog: false,
  });
  mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(mesh);
}

function resize() {
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

window.addEventListener("resize", resize);
resize();

function packColor(materialId: number) {
  if (materialId === 0) {
    return 0x34b78f;
  }
  if (materialId === 1) {
    return 0xe15759;
  }
  return 0xf2c14e;
}

function instancePosition(index: number) {
  const y = 1 - (index / Math.max(1, activeCount - 1)) * 2;
  const ring = Math.sqrt(1 - y * y);
  const theta = index * GOLDEN_ANGLE;
  const layer = ((index * 17) % 97) / 97;
  const radius = RADIUS * (0.38 + layer * 0.62);

  return {
    x: Math.cos(theta) * ring * radius,
    y: y * 105 + Math.sin(index * 0.017) * 14,
    z: Math.sin(theta) * ring * radius,
  };
}

function instanceScale(index: number) {
  return 1.15 + ((index * 13) % 19) * 0.045;
}

function makeZenoBuffer(count: number) {
  const started = performance.now();
  const buffer = new ArrayBuffer(count * InstanceViewByteLength);
  const view = new DataView(buffer);

  for (let index = 0; index < count; index += 1) {
    const offset = index * InstanceViewByteLength;
    const position = instancePosition(index);
    const materialId = index % 3;
    view.setUint32(offset + InstanceViewIdOffset, index, true);
    view.setUint16(offset + InstanceViewMeshIdOffset, index % 2, true);
    view.setUint16(offset + InstanceViewMaterialIdOffset, materialId, true);
    view.setFloat32(offset + InstanceViewXOffset, position.x, true);
    view.setFloat32(offset + InstanceViewYOffset, position.y, true);
    view.setFloat32(offset + InstanceViewZOffset, position.z, true);
    view.setFloat32(offset + InstanceViewScaleOffset, instanceScale(index), true);
    view.setUint32(offset + InstanceViewColorOffset, packColor(materialId), true);
  }

  return { buffer, buildMs: performance.now() - started };
}

function makeJsonPayload(count: number) {
  const started = performance.now();
  const rows: JsonInstance[] = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const position = instancePosition(index);
    const materialId = index % 3;
    rows[index] = {
      id: index,
      meshId: index % 2,
      materialId,
      x: position.x,
      y: position.y,
      z: position.z,
      scale: instanceScale(index),
      color: packColor(materialId),
    };
  }

  const payload = JSON.stringify(rows);
  return { payload, buildMs: performance.now() - started };
}

function makeFlatBufferPayload(count: number) {
  const started = performance.now();
  const builder = new Builder(Math.max(1024, count * 44));
  builder.forceDefaults(true);
  const offsets = new Array<number>(count);

  for (let index = 0; index < count; index += 1) {
    const position = instancePosition(index);
    const materialId = index % 3;
    builder.startObject(8);
    builder.addFieldInt32(0, index, 0);
    builder.addFieldInt16(1, index % 2, 0);
    builder.addFieldInt16(2, materialId, 0);
    builder.addFieldFloat32(3, position.x, 0);
    builder.addFieldFloat32(4, position.y, 0);
    builder.addFieldFloat32(5, position.z, 0);
    builder.addFieldFloat32(6, instanceScale(index), 0);
    builder.addFieldInt32(7, packColor(materialId), 0);
    offsets[index] = builder.endObject();
  }

  builder.startVector(4, count, 4);
  for (let index = count - 1; index >= 0; index -= 1) {
    builder.addOffset(offsets[index]);
  }
  const vector = builder.endVector();

  builder.startObject(1);
  builder.addFieldOffset(0, vector, 0);
  const root = builder.endObject();
  builder.finish(root);

  const bytes = new Uint8Array(builder.asUint8Array());
  return {
    bytes,
    buildMs: performance.now() - started,
    root: FbInstanceBatch.getRootAsInstanceBatch(new ByteBuffer(bytes)),
  };
}

class FbInstance {
  bbPos = 0;
  bb: ByteBuffer | undefined;

  __init(position: number, buffer: ByteBuffer) {
    this.bbPos = position;
    this.bb = buffer;
    return this;
  }

  x() {
    const offset = this.bb!.__offset(this.bbPos, 10);
    return offset === 0 ? 0 : this.bb!.readFloat32(this.bbPos + offset);
  }

  y() {
    const offset = this.bb!.__offset(this.bbPos, 12);
    return offset === 0 ? 0 : this.bb!.readFloat32(this.bbPos + offset);
  }

  z() {
    const offset = this.bb!.__offset(this.bbPos, 14);
    return offset === 0 ? 0 : this.bb!.readFloat32(this.bbPos + offset);
  }

  scale() {
    const offset = this.bb!.__offset(this.bbPos, 16);
    return offset === 0 ? 1 : this.bb!.readFloat32(this.bbPos + offset);
  }
}

class FbInstanceBatch {
  bbPos = 0;
  bb: ByteBuffer | undefined;

  static getRootAsInstanceBatch(buffer: ByteBuffer, out = new FbInstanceBatch()) {
    return out.__init(buffer.position() + buffer.readInt32(buffer.position()), buffer);
  }

  __init(position: number, buffer: ByteBuffer) {
    this.bbPos = position;
    this.bb = buffer;
    return this;
  }

  instances(index: number, out = new FbInstance()) {
    const offset = this.bb!.__offset(this.bbPos, 4);
    if (offset === 0) {
      return null;
    }

    const vector = this.bb!.__vector(this.bbPos + offset);
    return out.__init(this.bb!.__indirect(vector + index * 4), this.bb!);
  }

  instancesLength() {
    const offset = this.bb!.__offset(this.bbPos, 4);
    return offset === 0 ? 0 : this.bb!.__vector_len(this.bbPos + offset);
  }
}

function writeMatrix(
  array: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
  scale: number,
) {
  const offset = index * 16;
  array[offset] = scale;
  array[offset + 1] = 0;
  array[offset + 2] = 0;
  array[offset + 3] = 0;
  array[offset + 4] = 0;
  array[offset + 5] = scale;
  array[offset + 6] = 0;
  array[offset + 7] = 0;
  array[offset + 8] = 0;
  array[offset + 9] = 0;
  array[offset + 10] = scale;
  array[offset + 11] = 0;
  array[offset + 12] = x;
  array[offset + 13] = y;
  array[offset + 14] = z;
  array[offset + 15] = 1;
}

function uploadZeno(buffer: ArrayBuffer, count: number) {
  const visibleCount = Math.min(count, MAX_RENDERED);
  createMesh(visibleCount);
  const target = mesh!;
  const matrixArray = target.instanceMatrix.array as Float32Array;
  const view = new DataView(buffer);

  const packStarted = performance.now();
  for (let index = 0; index < visibleCount; index += 1) {
    const offset = index * InstanceViewByteLength;
    const x = InstanceView.getX(view, offset);
    const y = InstanceView.getY(view, offset);
    const z = InstanceView.getZ(view, offset);
    const scale = InstanceView.getScale(view, offset);
    writeMatrix(matrixArray, index, x, y, z, scale);
  }
  const packMs = performance.now() - packStarted;

  const uploadStarted = performance.now();
  target.count = visibleCount;
  target.instanceMatrix.needsUpdate = true;
  if (!Array.isArray(target.material)) {
    target.material.needsUpdate = true;
  }
  return { packMs, uploadMs: performance.now() - uploadStarted, rendered: visibleCount };
}

function uploadJson(payload: string) {
  const parseStarted = performance.now();
  const rows = JSON.parse(payload) as JsonInstance[];
  const parseMs = performance.now() - parseStarted;
  const visibleCount = Math.min(rows.length, MAX_RENDERED);
  createMesh(visibleCount);
  const target = mesh!;
  const matrixArray = target.instanceMatrix.array as Float32Array;

  const packStarted = performance.now();
  for (let index = 0; index < visibleCount; index += 1) {
    const row = rows[index];
    writeMatrix(matrixArray, index, row.x, row.y, row.z, row.scale);
  }
  const packMs = performance.now() - packStarted;

  const uploadStarted = performance.now();
  target.count = visibleCount;
  target.instanceMatrix.needsUpdate = true;
  if (!Array.isArray(target.material)) {
    target.material.needsUpdate = true;
  }
  return { parseMs, packMs, uploadMs: performance.now() - uploadStarted, rendered: visibleCount };
}

function uploadFlatBuffers(root: FbInstanceBatch) {
  const count = root.instancesLength();
  const visibleCount = Math.min(count, MAX_RENDERED);
  createMesh(visibleCount);
  const target = mesh!;
  const matrixArray = target.instanceMatrix.array as Float32Array;
  const row = new FbInstance();

  const packStarted = performance.now();
  for (let index = 0; index < visibleCount; index += 1) {
    root.instances(index, row);
    writeMatrix(matrixArray, index, row.x(), row.y(), row.z(), row.scale());
  }
  const packMs = performance.now() - packStarted;

  const uploadStarted = performance.now();
  target.count = visibleCount;
  target.instanceMatrix.needsUpdate = true;
  if (!Array.isArray(target.material)) {
    target.material.needsUpdate = true;
  }
  return { packMs, uploadMs: performance.now() - uploadStarted, rendered: visibleCount };
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function formatMs(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)} ms`;
}

function setBusy(value: boolean) {
  running = value;
  recordSelect.disabled = value;
  for (const button of runButtons) {
    button.disabled = value;
  }
}

function renderMetrics(metrics: Metrics) {
  modePill.textContent =
    metrics.mode === "zeno" ? "ZENO" : metrics.mode === "flatbuffers" ? "FLAT" : "JSON";
  metricPayload.textContent = formatBytes(metrics.payloadBytes);
  metricBuild.textContent = formatMs(metrics.buildMs);
  metricParse.textContent = metrics.mode === "json" ? formatMs(metrics.parseMs) : "0 ms";
  metricPack.textContent = `${formatMs(metrics.packMs + metrics.uploadMs)}`;
  statusLine.textContent = `${metrics.rendered.toLocaleString("en-US")} / ${metrics.records.toLocaleString("en-US")} instances on GPU`;

  for (const button of runButtons) {
    button.dataset.active = String(button.dataset.mode === metrics.mode);
  }
}

async function run(mode: Mode, count: number) {
  if (running) {
    return;
  }

  setBusy(true);
  activeMode = mode;
  activeCount = count;
  statusLine.textContent = "Preparing dataset";
  await new Promise(requestAnimationFrame);

  try {
    if (mode === "zeno") {
      const { buffer, buildMs } = makeZenoBuffer(count);
      const upload = uploadZeno(buffer, count);
      renderMetrics({
        mode,
        records: count,
        payloadBytes: buffer.byteLength,
        buildMs,
        parseMs: 0,
        packMs: upload.packMs,
        uploadMs: upload.uploadMs,
        rendered: upload.rendered,
      });
    } else if (mode === "flatbuffers") {
      const { bytes, buildMs, root } = makeFlatBufferPayload(count);
      const upload = uploadFlatBuffers(root);
      renderMetrics({
        mode,
        records: count,
        payloadBytes: bytes.byteLength,
        buildMs,
        parseMs: 0,
        packMs: upload.packMs,
        uploadMs: upload.uploadMs,
        rendered: upload.rendered,
      });
    } else {
      const { payload, buildMs } = makeJsonPayload(count);
      const upload = uploadJson(payload);
      renderMetrics({
        mode,
        records: count,
        payloadBytes: new TextEncoder().encode(payload).byteLength,
        buildMs,
        parseMs: upload.parseMs,
        packMs: upload.packMs,
        uploadMs: upload.uploadMs,
        rendered: upload.rendered,
      });
    }
  } finally {
    setBusy(false);
  }
}

recordSelect.addEventListener("change", () => {
  void run(activeMode, Number(recordSelect.value));
});

for (const button of runButtons) {
  button.addEventListener("click", () => {
    const mode =
      button.dataset.mode === "json"
        ? "json"
        : button.dataset.mode === "flatbuffers"
          ? "flatbuffers"
          : "zeno";
    void run(mode, Number(recordSelect.value));
  });
}

function animate() {
  requestAnimationFrame(animate);
  group.rotation.y +=
    activeMode === "zeno" ? 0.0018 : activeMode === "flatbuffers" ? 0.0014 : 0.0012;
  group.rotation.x = Math.sin(performance.now() * 0.00018) * 0.08;
  renderer.render(scene, camera);
}

void run("zeno", DEFAULT_COUNT);
animate();
