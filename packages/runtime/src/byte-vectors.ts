import { decodeText, type TextEncoding } from "./fixed.js";
import { VectorView } from "./vector-base.js";

export class BytesVectorView extends VectorView<Uint8Array> {
  constructor(
    view: DataView,
    descriptorOffset: number,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, descriptorOffset, baseOffset, littleEndian);
  }

  bytesAt(index: number): Uint8Array {
    return this.spanBytesAt(index);
  }

  at(index: number): Uint8Array {
    return this.bytesAt(index);
  }
}

export class FixedBytesVectorView extends VectorView<Uint8Array> {
  constructor(
    view: DataView,
    descriptorOffset: number,
    private readonly elementByteLength: number,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, descriptorOffset, baseOffset, littleEndian);
  }

  bytesAt(index: number): Uint8Array {
    this.assertIndex(index);
    const localOffset = this.payloadOffset() + index * this.elementByteLength;
    this.assertRange(localOffset, this.elementByteLength);
    return new Uint8Array(
      this.backingBuffer(),
      this.backingOffset(localOffset),
      this.elementByteLength,
    );
  }

  at(index: number): Uint8Array {
    return this.bytesAt(index);
  }
}

export class FixedStringVectorView extends VectorView<string> {
  constructor(
    view: DataView,
    descriptorOffset: number,
    private readonly elementByteLength: number,
    baseOffset = 0,
    littleEndian = true,
    private readonly encoding: TextEncoding = "utf8",
  ) {
    super(view, descriptorOffset, baseOffset, littleEndian);
  }

  bytesAt(index: number): Uint8Array {
    this.assertIndex(index);
    const localOffset = this.payloadOffset() + index * this.elementByteLength;
    this.assertRange(localOffset, this.elementByteLength);
    return new Uint8Array(
      this.backingBuffer(),
      this.backingOffset(localOffset),
      this.elementByteLength,
    );
  }

  textAt(index: number): string {
    return decodeText(this.bytesAt(index), this.encoding);
  }

  at(index: number): string {
    return this.textAt(index);
  }
}

export class Utf8VectorView extends VectorView<string> {
  constructor(
    view: DataView,
    descriptorOffset: number,
    baseOffset = 0,
    littleEndian = true,
    private readonly encoding: TextEncoding = "utf8",
  ) {
    super(view, descriptorOffset, baseOffset, littleEndian);
  }

  bytesAt(index: number): Uint8Array {
    return this.spanBytesAt(index);
  }

  at(index: number): string {
    return decodeText(this.bytesAt(index), this.encoding);
  }
}
