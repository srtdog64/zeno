import { type Span32Descriptor } from "./descriptor32.js";
import { UTF8_ENCODER, encodeText, type TextEncoding } from "./fixed.js";
import { alignOffset, assertDataViewRange } from "./range.js";

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
    return this.cursor;
  }

  align(alignment: number): this {
    const next = alignOffset(this.cursor, alignment);
    assertDataViewRange(this.view, this.baseOffset + next, 0);
    this.cursor = next;
    return this;
  }

  reserve(byteLength: number, alignment = 1): number {
    this.align(alignment);
    const offset = this.cursor;
    assertDataViewRange(this.view, this.baseOffset + offset, byteLength);
    this.cursor += byteLength;
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
}
