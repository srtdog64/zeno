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
