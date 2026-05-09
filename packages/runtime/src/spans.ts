import { SPAN32_BYTE_LENGTH, readSpan32Descriptor } from "./descriptor32.js";
import { decodeText, type TextEncoding } from "./fixed.js";
import { ProjectionView } from "./view-base.js";

export class BytesSpanView extends ProjectionView {
  static readonly descriptorByteLength = SPAN32_BYTE_LENGTH;

  constructor(
    view: DataView,
    private readonly descriptorOffset: number,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, baseOffset, littleEndian);
  }

  get byteLength(): number {
    return readSpan32Descriptor(
      this.view,
      this.absoluteOffset(this.descriptorOffset),
      this.littleEndian,
    ).byteLength;
  }

  bytes(): Uint8Array {
    const descriptor = readSpan32Descriptor(
      this.view,
      this.absoluteOffset(this.descriptorOffset),
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

export class Utf8SpanView extends BytesSpanView {
  constructor(
    view: DataView,
    descriptorOffset: number,
    baseOffset = 0,
    littleEndian = true,
    private readonly encoding: TextEncoding = "utf8",
  ) {
    super(view, descriptorOffset, baseOffset, littleEndian);
  }

  text(): string {
    return decodeText(this.bytes(), this.encoding);
  }
}
