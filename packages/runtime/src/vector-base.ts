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

  get length(): number {
    return readVector32Descriptor(
      this.view,
      this.absoluteOffset(this.descriptorOffset),
      this.littleEndian,
    ).count;
  }

  protected payloadOffset(): number {
    return readVector32Descriptor(
      this.view,
      this.absoluteOffset(this.descriptorOffset),
      this.littleEndian,
    ).relOffset;
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

  protected spanBytesAt(index: number): Uint8Array {
    this.assertIndex(index);
    const descriptorOffset = this.payloadOffset() + index * SPAN32_BYTE_LENGTH;
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
}
