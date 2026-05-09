import {
  SPAN32_BYTE_LENGTH,
  VECTOR32_BYTE_LENGTH,
  readSpan32Descriptor,
  readVector32Descriptor,
} from "./descriptor32.js";
import { ProjectionView } from "./view-base.js";

export abstract class VectorView<T> extends ProjectionView {
  static readonly descriptorByteLength = VECTOR32_BYTE_LENGTH;

  protected constructor(
    view: DataView,
    private readonly descriptorOffset: number,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, baseOffset, littleEndian);
  }

  private descriptorCache:
    | {
        readonly relOffset: number;
        readonly count: number;
      }
    | undefined;

  override rebase(baseOffset: number): this {
    super.rebase(baseOffset);
    this.clearDescriptorCache();
    return this;
  }

  override rebaseUnchecked(baseOffset: number): this {
    super.rebaseUnchecked(baseOffset);
    this.clearDescriptorCache();
    return this;
  }

  override moveToOffset(baseOffset: number, byteLength: number): this {
    super.moveToOffset(baseOffset, byteLength);
    this.clearDescriptorCache();
    return this;
  }

  override moveToOffsetUnchecked(baseOffset: number, byteLength: number): this {
    super.moveToOffsetUnchecked(baseOffset, byteLength);
    this.clearDescriptorCache();
    return this;
  }

  protected override moveToIndexUnchecked(index: number, byteLength: number): this {
    super.moveToIndexUnchecked(index, byteLength);
    this.clearDescriptorCache();
    return this;
  }

  refreshDescriptor(): this {
    this.clearDescriptorCache();
    this.descriptor();
    return this;
  }

  get length(): number {
    return this.descriptor().count;
  }

  protected payloadOffset(): number {
    return this.descriptor().relOffset;
  }

  abstract at(index: number): T;

  toArray(): T[] {
    return Array.from({ length: this.length }, (_, index) => this.at(index));
  }

  protected assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.length) {
      throw new RangeError(`Vector index out of bounds: ${index}`);
    }
  }

  protected elementOffsetAt(index: number, elementByteLength: number): number {
    const descriptor = this.descriptor();
    if (!Number.isInteger(index) || index < 0 || index >= descriptor.count) {
      throw new RangeError(`Vector index out of bounds: ${index}`);
    }

    return descriptor.relOffset + index * elementByteLength;
  }

  protected spanBytesAt(index: number): Uint8Array {
    const descriptorOffset = this.elementOffsetAt(index, SPAN32_BYTE_LENGTH);
    const descriptor = readSpan32Descriptor(
      this.view,
      this.absoluteOffset(descriptorOffset),
      this.littleEndian,
    );
    this.assertRange(descriptor.relOffset, descriptor.byteLength);
    return new Uint8Array(
      this.backingBuffer(),
      this.backingOffset(descriptor.relOffset),
      descriptor.byteLength,
    );
  }

  private descriptor(): {
    readonly relOffset: number;
    readonly count: number;
  } {
    if (this.descriptorCache === undefined) {
      this.descriptorCache = readVector32Descriptor(
        this.view,
        this.absoluteOffset(this.descriptorOffset),
        this.littleEndian,
      );
    }

    return this.descriptorCache;
  }

  private clearDescriptorCache(): void {
    this.descriptorCache = undefined;
  }
}
