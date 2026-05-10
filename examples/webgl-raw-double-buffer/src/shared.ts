export const INSTANCE_COUNT = 40_000;
export const BUFFER_COUNT = 2;
export const FLOATS_PER_INSTANCE = 20;
export const FLOATS_PER_BUFFER = INSTANCE_COUNT * FLOATS_PER_INSTANCE;
export const BYTES_PER_FRAME = FLOATS_PER_BUFFER * Float32Array.BYTES_PER_ELEMENT;

export const CONTROL_CELL_STRIDE_WORDS = 16;
export const CONTROL_CELL_COUNT = 10;
export const CONTROL_WORDS = CONTROL_CELL_STRIDE_WORDS * CONTROL_CELL_COUNT;

export const ControlCell = {
  writeBuffer: 0,
  readBuffer: 1,
  frameVersion: 2,
  ready: 3,
  uploadingBuffer: 4,
  consumedBuffer: 5,
  skippedFrames: 6,
  buffer0Version: 7,
  buffer1Version: 8,
  tornFrames: 9,
} as const;

export type ControlCellName = (typeof ControlCell)[keyof typeof ControlCell];

export interface SimulationInitMessage {
  readonly type: "init";
  readonly controlBuffer: SharedArrayBuffer;
  readonly dataBuffer: SharedArrayBuffer;
}

export interface PublishedFrame {
  readonly readBuffer: number;
  readonly frameVersion: number;
}

export function controlIndex(cell: ControlCellName): number {
  return cell * CONTROL_CELL_STRIDE_WORDS;
}

export function createControlBuffer(): SharedArrayBuffer {
  const buffer = new SharedArrayBuffer(CONTROL_WORDS * Int32Array.BYTES_PER_ELEMENT);
  const control = new Int32Array(buffer);
  Atomics.store(control, controlIndex(ControlCell.writeBuffer), 0);
  Atomics.store(control, controlIndex(ControlCell.readBuffer), 0);
  Atomics.store(control, controlIndex(ControlCell.frameVersion), 0);
  Atomics.store(control, controlIndex(ControlCell.ready), 0);
  Atomics.store(control, controlIndex(ControlCell.uploadingBuffer), -1);
  Atomics.store(control, controlIndex(ControlCell.consumedBuffer), -1);
  Atomics.store(control, controlIndex(ControlCell.skippedFrames), 0);
  Atomics.store(control, controlIndex(ControlCell.buffer0Version), 0);
  Atomics.store(control, controlIndex(ControlCell.buffer1Version), 0);
  Atomics.store(control, controlIndex(ControlCell.tornFrames), 0);
  return buffer;
}

export function createDataBuffer(): SharedArrayBuffer {
  return new SharedArrayBuffer(BUFFER_COUNT * BYTES_PER_FRAME);
}

export function canWriteFrameBuffer(control: Int32Array, writeBuffer: number): boolean {
  assertFrameBufferIndex(writeBuffer);

  if (Atomics.load(control, controlIndex(ControlCell.ready)) === 0) {
    return true;
  }

  const readBuffer = Atomics.load(control, controlIndex(ControlCell.readBuffer));
  const consumedBuffer = Atomics.load(control, controlIndex(ControlCell.consumedBuffer));
  const uploadingBuffer = Atomics.load(control, controlIndex(ControlCell.uploadingBuffer));

  if (writeBuffer === uploadingBuffer) {
    return false;
  }

  return writeBuffer !== readBuffer || consumedBuffer === readBuffer;
}

export function publishFrameBuffer(control: Int32Array, readBuffer: number): number {
  assertFrameBufferIndex(readBuffer);
  const frameVersion = Atomics.load(control, controlIndex(ControlCell.frameVersion)) + 1;
  Atomics.store(control, controlIndex(frameVersionCell(readBuffer)), frameVersion);
  Atomics.store(control, controlIndex(ControlCell.readBuffer), readBuffer);
  Atomics.store(control, controlIndex(ControlCell.frameVersion), frameVersion);
  Atomics.store(control, controlIndex(ControlCell.ready), 1);
  Atomics.store(control, controlIndex(ControlCell.writeBuffer), (readBuffer + 1) % BUFFER_COUNT);
  return frameVersion;
}

export function claimPublishedFrame(
  control: Int32Array,
  lastFrameVersion: number,
): PublishedFrame | null {
  if (Atomics.load(control, controlIndex(ControlCell.ready)) !== 1) {
    return null;
  }

  const frameVersion = Atomics.load(control, controlIndex(ControlCell.frameVersion));
  if (frameVersion === lastFrameVersion) {
    return null;
  }

  const readBuffer = Atomics.load(control, controlIndex(ControlCell.readBuffer));
  assertFrameBufferIndex(readBuffer);
  markFrameUploadStart(control, readBuffer);

  const bufferVersion = Atomics.load(control, controlIndex(frameVersionCell(readBuffer)));
  if (bufferVersion !== frameVersion) {
    Atomics.add(control, controlIndex(ControlCell.tornFrames), 1);
    markFrameUploadComplete(control, readBuffer);
    return null;
  }

  return { readBuffer, frameVersion };
}

export function markFrameUploadStart(control: Int32Array, readBuffer: number): void {
  assertFrameBufferIndex(readBuffer);
  Atomics.store(control, controlIndex(ControlCell.uploadingBuffer), readBuffer);
}

export function markFrameUploadComplete(control: Int32Array, readBuffer: number): void {
  assertFrameBufferIndex(readBuffer);
  Atomics.store(control, controlIndex(ControlCell.consumedBuffer), readBuffer);
  Atomics.store(control, controlIndex(ControlCell.uploadingBuffer), -1);
}

function frameVersionCell(bufferIndex: number): ControlCellName {
  assertFrameBufferIndex(bufferIndex);
  return bufferIndex === 0 ? ControlCell.buffer0Version : ControlCell.buffer1Version;
}

function assertFrameBufferIndex(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= BUFFER_COUNT) {
    throw new RangeError(`Invalid frame buffer index: ${value}`);
  }
}
