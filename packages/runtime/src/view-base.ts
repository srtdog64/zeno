import { assertDataViewRange } from "./range.js";

export abstract class ProjectionView {
  protected constructor(
    protected readonly view: DataView,
    protected baseOffset = 0,
    protected readonly littleEndian = true,
  ) {}

  rebase(baseOffset: number): this {
    assertDataViewRange(this.view, baseOffset, 0);
    this.baseOffset = baseOffset;
    return this;
  }

  rebaseUnchecked(baseOffset: number): this {
    this.baseOffset = baseOffset;
    return this;
  }

  protected moveToIndex(index: number, byteLength: number): this {
    if (!Number.isInteger(index) || index < 0) {
      throw new RangeError(`Invalid record index: ${index}`);
    }

    const baseOffset = index * byteLength;
    return this.moveToOffset(baseOffset, byteLength);
  }

  protected moveToIndexUnchecked(index: number, byteLength: number): this {
    const baseOffset = index * byteLength;
    this.baseOffset = baseOffset;
    return this;
  }

  moveToOffset(baseOffset: number, byteLength: number): this {
    assertDataViewRange(this.view, baseOffset, 0);
    assertDataViewRange(this.view, baseOffset, byteLength);
    this.baseOffset = baseOffset;
    return this;
  }

  moveToOffsetUnchecked(baseOffset: number, _byteLength: number): this {
    this.baseOffset = baseOffset;
    return this;
  }

  protected absoluteOffset(localOffset = 0): number {
    return this.baseOffset + localOffset;
  }

  protected backingOffset(localOffset = 0): number {
    return this.view.byteOffset + this.absoluteOffset(localOffset);
  }

  protected backingBuffer(): ArrayBufferLike {
    return this.view.buffer;
  }

  protected assertRange(localOffset: number, byteLength: number): void {
    const start = this.absoluteOffset(localOffset);
    assertDataViewRange(this.view, start, byteLength);
  }
}
