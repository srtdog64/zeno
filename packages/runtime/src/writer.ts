import { alignOffset, assertDataViewRange } from "./range.js";
import type { ScalarKind } from "./scalar.js";
import type { Span32Descriptor, Vector32Descriptor } from "./descriptor32.js";
import { UTF8_ENCODER, type TextEncoding } from "./fixed.js";
import {
  publishSharedDescriptor,
  sharedArenaCursorCell,
  sharedArenaView,
  type SharedArenaOptions,
  type SharedArenaViewOptions,
} from "./writer-arena.js";
import { VectorLayoutWriter } from "./writer-vectors.js";

export interface SharedDynamicLayoutWriterOptions
  extends SharedArenaOptions, SharedArenaViewOptions {
  readonly baseOffset?: number;
  readonly littleEndian?: boolean;
}

export type SharedDynamicLayoutWriterInitOptions = SharedArenaOptions;
export type SharedDescriptorState = Int32Array;

export class DynamicLayoutWriter extends VectorLayoutWriter {}

/**
 * Dynamic tail writer for a `SharedArrayBuffer` arena.
 *
 * Guarantees:
 * - tail reservation is race-free across writer instances that share the same
 *   cursor cell; reservation uses `Atomics.compareExchange`.
 * - descriptor publication is atomic when using the `*Published(...)` methods
 *   with a descriptor state cell.
 *
 * Non-guarantees:
 * - arbitrary fixed-position writes are not protected. If callers write the
 *   same byte range outside of cursor reservation, the payload can be corrupted.
 * - readers must wait for the descriptor state cell before reading descriptors
 *   written by another thread.
 */
export class SharedDynamicLayoutWriter extends DynamicLayoutWriter {
  private readonly sharedCursor: Int32Array;

  static initializeCursor(
    buffer: SharedArrayBuffer,
    tailOffset: number,
    options: SharedDynamicLayoutWriterInitOptions,
  ): void {
    assertSharedTailOffset(tailOffset);
    Atomics.store(sharedArenaCursorCell(buffer, options.cursorByteOffset), 0, tailOffset);
  }

  static fromSharedBuffer(
    buffer: SharedArrayBuffer,
    options: SharedDynamicLayoutWriterOptions,
  ): SharedDynamicLayoutWriter {
    const cursor = sharedArenaCursorCell(buffer, options.cursorByteOffset);
    return new SharedDynamicLayoutWriter(
      sharedArenaView(buffer, options),
      cursor,
      options.baseOffset ?? 0,
      options.littleEndian ?? true,
    );
  }

  constructor(view: DataView, sharedCursor: Int32Array, baseOffset = 0, littleEndian = true) {
    super(view, Atomics.load(sharedCursor, 0), baseOffset, littleEndian);
    this.sharedCursor = sharedCursor;
  }

  override align(alignment: number): this {
    this.reserve(0, alignment);
    return this;
  }

  override reserve(byteLength: number, alignment = 1): number {
    assertSharedTailOffset(byteLength);

    while (true) {
      const current = this.readCursor();
      const aligned = alignOffset(current, alignment);
      const next = aligned + byteLength;
      assertSharedTailOffset(next);
      assertDataViewRange(this.view, this.baseOffset + aligned, byteLength);

      if (Atomics.compareExchange(this.sharedCursor, 0, current, next) === current) {
        return aligned;
      }
    }
  }

  protected override readCursor(): number {
    return Atomics.load(this.sharedCursor, 0);
  }

  protected override writeCursor(value: number): void {
    assertSharedTailOffset(value);
    Atomics.store(this.sharedCursor, 0, value);
  }

  publishDescriptor(state: SharedDescriptorState, readyValue = 1): void {
    publishSharedDescriptor(state, readyValue);
  }

  writeBytesPublished(
    descriptorOffset: number,
    bytes: ArrayLike<number> | Uint8Array,
    state: SharedDescriptorState,
    readyValue = 1,
  ): Span32Descriptor {
    const descriptor = super.writeBytes(descriptorOffset, bytes);
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeUtf8Published(
    descriptorOffset: number,
    text: string,
    state: SharedDescriptorState,
    readyValue = 1,
    encoder = UTF8_ENCODER,
  ): Span32Descriptor {
    const descriptor = super.writeUtf8(descriptorOffset, text, encoder);
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeTextPublished(
    descriptorOffset: number,
    text: string,
    state: SharedDescriptorState,
    readyValue = 1,
    encoding: TextEncoding = "utf8",
  ): Span32Descriptor {
    const descriptor = super.writeText(descriptorOffset, text, encoding);
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeBytesVectorPublished(
    descriptorOffset: number,
    values: readonly (ArrayLike<number> | Uint8Array)[],
    state: SharedDescriptorState,
    readyValue = 1,
  ): Vector32Descriptor {
    const descriptor = super.writeBytesVector(descriptorOffset, values);
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeUtf8VectorPublished(
    descriptorOffset: number,
    values: readonly string[],
    state: SharedDescriptorState,
    readyValue = 1,
    encoder = UTF8_ENCODER,
  ): Vector32Descriptor {
    const descriptor = super.writeUtf8Vector(descriptorOffset, values, encoder);
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeTextVectorPublished(
    descriptorOffset: number,
    values: readonly string[],
    state: SharedDescriptorState,
    readyValue = 1,
    encoding: TextEncoding = "utf8",
  ): Vector32Descriptor {
    const descriptor = super.writeTextVector(descriptorOffset, values, encoding);
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeFixedBytesVectorPublished(
    descriptorOffset: number,
    values: readonly (ArrayLike<number> | Uint8Array)[],
    elementByteLength: number,
    state: SharedDescriptorState,
    readyValue = 1,
  ): Vector32Descriptor {
    const descriptor = super.writeFixedBytesVector(descriptorOffset, values, elementByteLength);
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeFixedUtf8VectorPublished(
    descriptorOffset: number,
    values: readonly string[],
    elementByteLength: number,
    state: SharedDescriptorState,
    readyValue = 1,
    encoder = UTF8_ENCODER,
  ): Vector32Descriptor {
    const descriptor = super.writeFixedUtf8Vector(
      descriptorOffset,
      values,
      elementByteLength,
      encoder,
    );
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeFixedTextVectorPublished(
    descriptorOffset: number,
    values: readonly string[],
    elementByteLength: number,
    state: SharedDescriptorState,
    readyValue = 1,
    encoding: TextEncoding = "utf8",
  ): Vector32Descriptor {
    const descriptor = super.writeFixedTextVector(
      descriptorOffset,
      values,
      elementByteLength,
      encoding,
    );
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeScalarVectorPublished<T extends number | bigint | boolean>(
    descriptorOffset: number,
    scalarKind: ScalarKind,
    values: readonly T[],
    state: SharedDescriptorState,
    readyValue = 1,
  ): Vector32Descriptor {
    const descriptor = super.writeScalarVector(descriptorOffset, scalarKind, values);
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeStructVectorPublished<T>(
    descriptorOffset: number,
    values: readonly T[],
    elementByteLength: number,
    writeElement: (view: DataView, value: T, baseOffset: number, littleEndian: boolean) => void,
    state: SharedDescriptorState,
    readyValue = 1,
    alignment = 1,
  ): Vector32Descriptor {
    const descriptor = super.writeStructVector(
      descriptorOffset,
      values,
      elementByteLength,
      writeElement,
      alignment,
    );
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writePointerVectorPublished(
    descriptorOffset: number,
    targetOffsets: readonly (number | null)[],
    targetByteLength: number,
    state: SharedDescriptorState,
    readyValue = 1,
  ): Vector32Descriptor {
    const descriptor = super.writePointerVector(descriptorOffset, targetOffsets, targetByteLength);
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  override writeBytes(): Span32Descriptor {
    return rejectSharedDescriptorWrite();
  }

  override writeUtf8(): Span32Descriptor {
    return rejectSharedDescriptorWrite();
  }

  override writeText(): Span32Descriptor {
    return rejectSharedDescriptorWrite();
  }

  override writeBytesVector(): Vector32Descriptor {
    return rejectSharedDescriptorWrite();
  }

  override writeUtf8Vector(): Vector32Descriptor {
    return rejectSharedDescriptorWrite();
  }

  override writeTextVector(): Vector32Descriptor {
    return rejectSharedDescriptorWrite();
  }

  override writeFixedBytesVector(): Vector32Descriptor {
    return rejectSharedDescriptorWrite();
  }

  override writeFixedUtf8Vector(): Vector32Descriptor {
    return rejectSharedDescriptorWrite();
  }

  override writeFixedTextVector(): Vector32Descriptor {
    return rejectSharedDescriptorWrite();
  }

  override writeScalarVector(): Vector32Descriptor {
    return rejectSharedDescriptorWrite();
  }

  override writeStructVector(): Vector32Descriptor {
    return rejectSharedDescriptorWrite();
  }

  override writePointerVector(): Vector32Descriptor {
    return rejectSharedDescriptorWrite();
  }
}

function assertSharedTailOffset(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0x7fffffff) {
    throw new RangeError(`Shared arena cursor value must be a non-negative i32: ${value}`);
  }
}

function rejectSharedDescriptorWrite(): never {
  throw new Error(
    "SharedDynamicLayoutWriter descriptor writes require a state cell. Use the *Published method variant.",
  );
}
