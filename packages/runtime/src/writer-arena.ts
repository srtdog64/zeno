import { type Span32Descriptor } from "./descriptor32.js";
import { UTF8_ENCODER, encodeText, type TextEncoding } from "./fixed.js";
import { alignOffset, assertDataViewRange } from "./range.js";

export interface SharedArenaViewOptions {
  readonly byteOffset?: number;
  readonly byteLength?: number;
}

export interface SharedArenaOptions extends SharedArenaViewOptions {
  readonly cursorByteOffset: number;
}

export interface SharedArenaShardOptions {
  readonly shardCount: number;
  readonly shardIndex: number;
  readonly payloadByteOffset: number;
  readonly payloadByteLength: number;
  readonly cursorTableByteOffset: number;
}

/**
 * Create a `DataView` over a caller-owned `SharedArrayBuffer`.
 *
 * This helper does not add synchronization by itself. It only creates the view
 * used by `SharedDynamicLayoutWriter`; atomic coordination lives in the cursor
 * and descriptor state cells below.
 */
export function sharedArenaView(
  buffer: SharedArrayBuffer,
  options: SharedArenaViewOptions = {},
): DataView {
  const byteOffset = options.byteOffset ?? 0;
  if (options.byteLength === undefined) {
    return new DataView(buffer, byteOffset);
  }

  return new DataView(buffer, byteOffset, options.byteLength);
}

export function sharedInt32Cell(
  buffer: SharedArrayBuffer,
  byteOffset: number,
  label = "shared i32 cell",
): Int32Array {
  if (!Number.isInteger(byteOffset) || byteOffset < 0) {
    throw new RangeError(`Invalid ${label} byte offset: ${byteOffset}`);
  }
  if (byteOffset % Int32Array.BYTES_PER_ELEMENT !== 0) {
    throw new RangeError(
      `${label} byte offset must be ${Int32Array.BYTES_PER_ELEMENT}-byte aligned: ${byteOffset}`,
    );
  }
  if (byteOffset + Int32Array.BYTES_PER_ELEMENT > buffer.byteLength) {
    throw new RangeError(
      `${label} byte offset ${byteOffset} exceeds SharedArrayBuffer length ${buffer.byteLength}`,
    );
  }

  return new Int32Array(buffer, byteOffset, 1);
}

export function sharedArenaCursorCell(
  buffer: SharedArrayBuffer,
  cursorByteOffset: number,
): Int32Array {
  return sharedInt32Cell(buffer, cursorByteOffset, "shared arena cursor");
}

/**
 * Compute the single-writer shard owned by one worker.
 *
 * This is the preferred high-contention shape: give each worker a different
 * shard so most appends use a different cursor cell and payload range instead
 * of spinning on one shared CAS loop.
 */
export function sharedArenaShard(
  buffer: SharedArrayBuffer,
  options: SharedArenaShardOptions,
): SharedArenaOptions {
  assertShardOptions(buffer, options);

  const shardBaseLength = Math.floor(options.payloadByteLength / options.shardCount);
  const byteOffset = options.payloadByteOffset + options.shardIndex * shardBaseLength;
  const byteEnd =
    options.shardIndex === options.shardCount - 1
      ? options.payloadByteOffset + options.payloadByteLength
      : byteOffset + shardBaseLength;
  const byteLength = byteEnd - byteOffset;
  const cursorByteOffset =
    options.cursorTableByteOffset + options.shardIndex * Int32Array.BYTES_PER_ELEMENT;

  sharedArenaView(buffer, { byteOffset, byteLength });
  sharedArenaCursorCell(buffer, cursorByteOffset);
  return { byteOffset, byteLength, cursorByteOffset };
}

export function initializeSharedArenaShard(
  buffer: SharedArrayBuffer,
  options: SharedArenaShardOptions,
  tailOffset = 0,
): SharedArenaOptions {
  const shard = sharedArenaShard(buffer, options);
  if (!Number.isInteger(tailOffset) || tailOffset < 0 || tailOffset > shard.byteLength!) {
    throw new RangeError(`Invalid shard tail offset: ${tailOffset}`);
  }
  Atomics.store(sharedArenaCursorCell(buffer, shard.cursorByteOffset), 0, tailOffset);
  return shard;
}

/**
 * A one-slot atomic publication cell for a dynamic descriptor.
 *
 * Writers publish the cell only after payload bytes and the `span32`/`vector32`
 * descriptor fields have been written. Readers must observe this cell with
 * `Atomics.load` before reading the descriptor to avoid torn descriptor reads.
 */
export function sharedDescriptorStateCell(
  buffer: SharedArrayBuffer,
  stateByteOffset: number,
): Int32Array {
  return sharedInt32Cell(buffer, stateByteOffset, "shared descriptor state");
}

/**
 * Publish a descriptor with an atomic ready flag.
 *
 * JavaScript Atomics are sequentially consistent, so writes sequenced before
 * this store in the writer happen-before a reader that observes the value with
 * `isSharedDescriptorPublished(...)`. The ready cell is a host-native control
 * word and is not part of the portable Zeno binary ABI.
 */
export function publishSharedDescriptor(state: Int32Array, readyValue = 1): void {
  assertSharedStateCell(state);
  assertSharedStateValue(readyValue);
  Atomics.store(state, 0, readyValue);
}

export function resetSharedDescriptor(state: Int32Array): void {
  assertSharedStateCell(state);
  Atomics.store(state, 0, 0);
}

export function isSharedDescriptorPublished(state: Int32Array, readyValue = 1): boolean {
  assertSharedStateCell(state);
  assertSharedStateValue(readyValue);
  return Atomics.load(state, 0) === readyValue;
}

export class DynamicLayoutArena {
  private cursor: number;

  constructor(
    protected readonly view: DataView,
    tailOffset: number,
    protected readonly baseOffset = 0,
    protected readonly littleEndian = true,
  ) {
    assertDataViewRange(view, baseOffset, 0);
    assertDataViewRange(view, baseOffset + tailOffset, 0);
    this.cursor = tailOffset;
  }

  get tailOffset(): number {
    return this.readCursor();
  }

  align(alignment: number): this {
    const next = alignOffset(this.readCursor(), alignment);
    assertDataViewRange(this.view, this.baseOffset + next, 0);
    this.writeCursor(next);
    return this;
  }

  reserve(byteLength: number, alignment = 1): number {
    this.align(alignment);
    const offset = this.readCursor();
    assertDataViewRange(this.view, this.baseOffset + offset, byteLength);
    this.writeCursor(offset + byteLength);
    return offset;
  }

  appendBytes(bytes: ArrayLike<number> | Uint8Array, alignment = 1): Span32Descriptor {
    const byteLength = bytes.length;
    const relOffset = this.reserve(byteLength, alignment);
    new Uint8Array(
      this.view.buffer,
      this.view.byteOffset + this.baseOffset + relOffset,
      byteLength,
    ).set(bytes);
    return { relOffset, byteLength };
  }

  appendUtf8(text: string, encoder = UTF8_ENCODER): Span32Descriptor {
    return this.appendBytes(encoder.encode(text));
  }

  appendText(text: string, encoding: TextEncoding = "utf8"): Span32Descriptor {
    return this.appendBytes(encodeText(text, encoding));
  }

  protected readCursor(): number {
    return this.cursor;
  }

  protected writeCursor(value: number): void {
    this.cursor = value;
  }
}

function assertSharedStateCell(state: Int32Array): void {
  if (state.length < 1) {
    throw new RangeError("Shared descriptor state cell must contain at least one i32 slot.");
  }
}

function assertSharedStateValue(value: number): void {
  if (!Number.isInteger(value) || value <= 0 || value > 0x7fffffff) {
    throw new RangeError(`Shared descriptor ready value must be a positive i32: ${value}`);
  }
}

function assertShardOptions(buffer: SharedArrayBuffer, options: SharedArenaShardOptions): void {
  if (!Number.isInteger(options.shardCount) || options.shardCount <= 0) {
    throw new RangeError(`Invalid shared arena shard count: ${options.shardCount}`);
  }
  if (
    !Number.isInteger(options.shardIndex) ||
    options.shardIndex < 0 ||
    options.shardIndex >= options.shardCount
  ) {
    throw new RangeError(`Invalid shared arena shard index: ${options.shardIndex}`);
  }
  if (!Number.isInteger(options.payloadByteOffset) || options.payloadByteOffset < 0) {
    throw new RangeError(`Invalid shared arena payload byte offset: ${options.payloadByteOffset}`);
  }
  if (!Number.isInteger(options.payloadByteLength) || options.payloadByteLength <= 0) {
    throw new RangeError(`Invalid shared arena payload byte length: ${options.payloadByteLength}`);
  }
  if (options.payloadByteLength < options.shardCount) {
    throw new RangeError("Shared arena payload must provide at least one byte per shard.");
  }
  if (options.payloadByteOffset + options.payloadByteLength > buffer.byteLength) {
    throw new RangeError(
      `Shared arena payload exceeds SharedArrayBuffer length ${buffer.byteLength}.`,
    );
  }

  const cursorTableByteLength = options.shardCount * Int32Array.BYTES_PER_ELEMENT;
  sharedInt32Cell(buffer, options.cursorTableByteOffset, "shared arena cursor table");
  if (options.cursorTableByteOffset + cursorTableByteLength > buffer.byteLength) {
    throw new RangeError(
      `Shared arena cursor table exceeds SharedArrayBuffer length ${buffer.byteLength}.`,
    );
  }
}
