import { writeSpan32Descriptor, type Span32Descriptor } from "./descriptor32.js";
import { UTF8_ENCODER, type TextEncoding } from "./fixed.js";
import { DynamicLayoutArena } from "./writer-arena.js";

export class SpanLayoutWriter extends DynamicLayoutArena {
  writeBytes(descriptorOffset: number, bytes: ArrayLike<number> | Uint8Array): Span32Descriptor {
    return this.writeBytesAtBase(this.baseOffset, descriptorOffset, bytes);
  }

  writeBytesAtBase(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    bytes: ArrayLike<number> | Uint8Array,
  ): Span32Descriptor {
    const descriptor = this.appendBytesAtBase(descriptorBaseOffset, bytes);
    writeSpan32Descriptor(
      this.view,
      descriptorBaseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );
    return descriptor;
  }

  writeUtf8(descriptorOffset: number, text: string, encoder = UTF8_ENCODER): Span32Descriptor {
    return this.writeUtf8AtBase(this.baseOffset, descriptorOffset, text, encoder);
  }

  writeUtf8AtBase(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    text: string,
    encoder = UTF8_ENCODER,
  ): Span32Descriptor {
    const descriptor = this.appendUtf8AtBase(descriptorBaseOffset, text, encoder);
    writeSpan32Descriptor(
      this.view,
      descriptorBaseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );
    return descriptor;
  }

  writeText(
    descriptorOffset: number,
    text: string,
    encoding: TextEncoding = "utf8",
  ): Span32Descriptor {
    return this.writeTextAtBase(this.baseOffset, descriptorOffset, text, encoding);
  }

  writeTextAtBase(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    text: string,
    encoding: TextEncoding = "utf8",
  ): Span32Descriptor {
    const descriptor = this.appendTextAtBase(descriptorBaseOffset, text, encoding);
    writeSpan32Descriptor(
      this.view,
      descriptorBaseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );
    return descriptor;
  }
}
