import { alignOffset, assertDataViewRange } from "./range.js";
import type { ScalarKind } from "./scalar.js";
import type { Span32Descriptor, Vector32Descriptor } from "./descriptor32.js";
import { UTF8_ENCODER, type TextEncoding } from "./fixed.js";
import {
  publishSharedDescriptor,
  initializeSharedArenaShard,
  sharedArenaCursorCell,
  sharedArenaShard,
  sharedArenaView,
  type SharedArenaOptions,
  type SharedArenaShardOptions,
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
export class SharedDynamicLayoutWriter {
  static initializeCursor(
    buffer: SharedArrayBuffer,
    tailOffset: number,
    options: SharedDynamicLayoutWriterInitOptions,
  ): void {
    assertSharedTailOffset(tailOffset);
    Atomics.store(sharedArenaCursorCell(buffer, options.cursorByteOffset), 0, tailOffset);
  }

  static initializeShard(
    buffer: SharedArrayBuffer,
    options: SharedArenaShardOptions,
    tailOffset = 0,
  ): SharedArenaOptions {
    return initializeSharedArenaShard(buffer, options, tailOffset);
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

  static fromSharedShard(
    buffer: SharedArrayBuffer,
    options: SharedArenaShardOptions,
  ): SharedDynamicLayoutWriter {
    return SharedDynamicLayoutWriter.fromSharedBuffer(buffer, sharedArenaShard(buffer, options));
  }

  constructor(view: DataView, sharedCursor: Int32Array, baseOffset = 0, littleEndian = true) {
    this.writer = new AtomicDynamicLayoutWriter(view, sharedCursor, baseOffset, littleEndian);
  }

  private readonly writer: AtomicDynamicLayoutWriter;

  get tailOffset(): number {
    return this.writer.tailOffset;
  }

  align(alignment: number): this {
    this.writer.align(alignment);
    return this;
  }

  reserve(byteLength: number, alignment = 1): number {
    return this.writer.reserve(byteLength, alignment);
  }

  appendBytes(bytes: ArrayLike<number> | Uint8Array, alignment = 1): Span32Descriptor {
    return this.writer.appendBytes(bytes, alignment);
  }

  appendUtf8(text: string, encoder = UTF8_ENCODER): Span32Descriptor {
    return this.writer.appendUtf8(text, encoder);
  }

  appendText(text: string, encoding: TextEncoding = "utf8"): Span32Descriptor {
    return this.writer.appendText(text, encoding);
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
    const descriptor = this.writer.writeBytes(descriptorOffset, bytes);
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
    const descriptor = this.writer.writeUtf8(descriptorOffset, text, encoder);
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
    const descriptor = this.writer.writeText(descriptorOffset, text, encoding);
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeBytesVectorPublished(
    descriptorOffset: number,
    values: readonly (ArrayLike<number> | Uint8Array)[],
    state: SharedDescriptorState,
    readyValue = 1,
  ): Vector32Descriptor {
    const descriptor = this.writer.writeBytesVector(descriptorOffset, values);
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
    const descriptor = this.writer.writeUtf8Vector(descriptorOffset, values, encoder);
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
    const descriptor = this.writer.writeTextVector(descriptorOffset, values, encoding);
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
    const descriptor = this.writer.writeFixedBytesVector(
      descriptorOffset,
      values,
      elementByteLength,
    );
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
    const descriptor = this.writer.writeFixedUtf8Vector(
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
    const descriptor = this.writer.writeFixedTextVector(
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
    values: ArrayLike<T>,
    state: SharedDescriptorState,
    readyValue = 1,
  ): Vector32Descriptor {
    const descriptor = this.writer.writeScalarVector(descriptorOffset, scalarKind, values);
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
    const descriptor = this.writer.writeStructVector(
      descriptorOffset,
      values,
      elementByteLength,
      writeElement,
      alignment,
    );
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }

  writeDynamicStructVectorPublished<T>(
    descriptorOffset: number,
    values: readonly T[],
    elementByteLength: number,
    writeElement: (
      view: DataView,
      writer: DynamicLayoutWriter,
      value: T,
      baseOffset: number,
      littleEndian: boolean,
    ) => void,
    state: SharedDescriptorState,
    readyValue = 1,
    alignment = 1,
  ): Vector32Descriptor {
    const descriptor = this.writer.writeDynamicStructVector(
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
    const descriptor = this.writer.writePointerVector(
      descriptorOffset,
      targetOffsets,
      targetByteLength,
    );
    this.publishDescriptor(state, readyValue);
    return descriptor;
  }
}

class AtomicDynamicLayoutWriter extends DynamicLayoutWriter {
  constructor(
    view: DataView,
    private readonly sharedCursor: Int32Array,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, Atomics.load(sharedCursor, 0), baseOffset, littleEndian);
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
}

function assertSharedTailOffset(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0x7fffffff) {
    throw new RangeError(`Shared arena cursor value must be a non-negative i32: ${value}`);
  }
}
