import {
  ControlCell,
  FLOATS_PER_BUFFER,
  FLOATS_PER_INSTANCE,
  INSTANCE_COUNT,
  canWriteFrameBuffer,
  controlIndex,
  publishFrameBuffer,
  type SimulationInitMessage,
} from "./shared";

let control: Int32Array | undefined;
let instanceData: Float32Array | undefined;
let phase = 0;

self.addEventListener("message", (event: MessageEvent<SimulationInitMessage>) => {
  if (event.data.type !== "init") {
    return;
  }

  control = new Int32Array(event.data.controlBuffer);
  instanceData = new Float32Array(event.data.dataBuffer);
  writeFrame();
  setInterval(writeFrame, 16);
});

function writeFrame(): void {
  if (control === undefined || instanceData === undefined) {
    return;
  }

  const writeBuffer = Atomics.load(control, controlIndex(ControlCell.writeBuffer));
  if (!canWriteFrameBuffer(control, writeBuffer)) {
    Atomics.add(control, controlIndex(ControlCell.skippedFrames), 1);
    return;
  }

  const base = writeBuffer * FLOATS_PER_BUFFER;

  for (let index = 0; index < INSTANCE_COUNT; index += 1) {
    writeInstance(instanceData, base + index * FLOATS_PER_INSTANCE, index, phase);
  }

  publishFrameBuffer(control, writeBuffer);
  phase += 0.016;
}

function writeInstance(data: Float32Array, offset: number, index: number, time: number): void {
  const gridWidth = 240;
  const column = index % gridWidth;
  const row = Math.floor(index / gridWidth);
  const normalizedX = (column / (gridWidth - 1)) * 1.86 - 0.93;
  const normalizedY = (row / Math.ceil(INSTANCE_COUNT / gridWidth)) * 1.72 - 0.86;
  const wave = Math.sin(index * 0.031 + time * 2.7) * 0.012;
  const scale = 0.0045 + ((index * 13) % 17) * 0.00016;

  data[offset] = scale;
  data[offset + 1] = 0;
  data[offset + 2] = 0;
  data[offset + 3] = 0;
  data[offset + 4] = 0;
  data[offset + 5] = scale;
  data[offset + 6] = 0;
  data[offset + 7] = 0;
  data[offset + 8] = 0;
  data[offset + 9] = 0;
  data[offset + 10] = 1;
  data[offset + 11] = 0;
  data[offset + 12] = normalizedX;
  data[offset + 13] = normalizedY + wave;
  data[offset + 14] = 0;
  data[offset + 15] = 1;

  const palette = index % 3;
  data[offset + 16] = palette === 0 ? 0.2 : palette === 1 ? 0.88 : 0.95;
  data[offset + 17] = palette === 0 ? 0.72 : palette === 1 ? 0.34 : 0.76;
  data[offset + 18] = palette === 0 ? 0.56 : palette === 1 ? 0.36 : 0.28;
  data[offset + 19] = 1;
}
