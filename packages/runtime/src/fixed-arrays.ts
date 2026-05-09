import {
  decodeText,
  fixedBytesView,
  writeFixedBytes,
  writeFixedText,
  type TextEncoding,
} from "./fixed.js";
import { readScalar, scalarByteLength, writeScalar, type ScalarKind } from "./scalar.js";
import { ProjectionView } from "./view-base.js";

export abstract class FixedArrayView<T> extends ProjectionView {
  protected constructor(
    view: DataView,
    private readonly payloadOffset: number,
    readonly length: number,
    protected readonly elementByteLength: number,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, baseOffset, littleEndian);
  }

  abstract at(index: number): T;

  toArray(): T[] {
    return Array.from({ length: this.length }, (_, index) => this.at(index));
  }

  protected elementOffset(index: number): number {
    this.assertIndex(index);
    return this.payloadOffset + index * this.elementByteLength;
  }

  protected assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.length) {
      throw new RangeError(`Fixed array index out of bounds: ${index}`);
    }
  }
}

export class FixedScalarArrayView<T extends number | bigint | boolean> extends FixedArrayView<T> {
  constructor(
    view: DataView,
    payloadOffset: number,
    length: number,
    private readonly scalarKind: ScalarKind,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, payloadOffset, length, scalarByteLength(scalarKind), baseOffset, littleEndian);
  }

  at(index: number): T {
    const localOffset = this.elementOffset(index);
    return readScalar(
      this.view,
      this.scalarKind,
      this.absoluteOffset(localOffset),
      this.littleEndian,
    ) as T;
  }

  set(index: number, value: T): void {
    const localOffset = this.elementOffset(index);
    writeScalar(
      this.view,
      this.scalarKind,
      this.absoluteOffset(localOffset),
      value,
      this.littleEndian,
    );
  }
}

export class FixedBytesArrayView extends FixedArrayView<Uint8Array> {
  constructor(
    view: DataView,
    payloadOffset: number,
    length: number,
    elementByteLength: number,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, payloadOffset, length, elementByteLength, baseOffset, littleEndian);
  }

  bytesAt(index: number): Uint8Array {
    const localOffset = this.elementOffset(index);
    this.assertRange(localOffset, this.elementByteLength);
    return fixedBytesView(
      this.backingBuffer(),
      this.backingOffset(localOffset),
      this.elementByteLength,
    );
  }

  set(index: number, value: ArrayLike<number> | Uint8Array): void {
    const localOffset = this.elementOffset(index);
    writeFixedBytes(
      this.backingBuffer(),
      this.backingOffset(localOffset),
      this.elementByteLength,
      value,
    );
  }

  at(index: number): Uint8Array {
    return this.bytesAt(index);
  }
}

export class FixedStringArrayView extends FixedArrayView<Uint8Array> {
  constructor(
    view: DataView,
    payloadOffset: number,
    length: number,
    elementByteLength: number,
    baseOffset = 0,
    littleEndian = true,
    private readonly encoding: TextEncoding = "utf8",
  ) {
    super(view, payloadOffset, length, elementByteLength, baseOffset, littleEndian);
  }

  bytesAt(index: number): Uint8Array {
    const localOffset = this.elementOffset(index);
    this.assertRange(localOffset, this.elementByteLength);
    return fixedBytesView(
      this.backingBuffer(),
      this.backingOffset(localOffset),
      this.elementByteLength,
    );
  }

  textAt(index: number): string {
    return decodeText(this.bytesAt(index), this.encoding);
  }

  setText(index: number, value: string): void {
    const localOffset = this.elementOffset(index);
    writeFixedText(
      this.backingBuffer(),
      this.backingOffset(localOffset),
      this.elementByteLength,
      value,
      this.encoding,
    );
  }

  textArray(): string[] {
    return Array.from({ length: this.length }, (_, index) => this.textAt(index));
  }

  at(index: number): Uint8Array {
    return this.bytesAt(index);
  }
}

export class FixedStructArrayView<TView extends ProjectionView> extends FixedArrayView<TView> {
  constructor(
    view: DataView,
    payloadOffset: number,
    length: number,
    elementByteLength: number,
    private readonly factory: (view: DataView, baseOffset: number, littleEndian: boolean) => TView,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, payloadOffset, length, elementByteLength, baseOffset, littleEndian);
  }

  at(index: number): TView {
    const localOffset = this.elementOffset(index);
    this.assertRange(localOffset, this.elementByteLength);
    return this.factory(this.view, this.absoluteOffset(localOffset), this.littleEndian);
  }
}
