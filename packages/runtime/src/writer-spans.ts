import { writeSpan32Descriptor, type Span32Descriptor } from "./descriptor32.js";
import { UTF8_ENCODER, type TextEncoding } from "./fixed.js";
import { DynamicLayoutArena } from "./writer-arena.js";

export class SpanLayoutWriter extends DynamicLayoutArena {
  writeBytes(descriptorOffset: number, bytes: ArrayLike<number> | Uint8Array): Span32Descriptor {
    const descriptor = this.appendBytes(bytes);
    writeSpan32Descriptor(
      this.view,
      this.baseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );
    return descriptor;
  }

  writeUtf8(descriptorOffset: number, text: string, encoder = UTF8_ENCODER): Span32Descriptor {
    const descriptor = this.appendUtf8(text, encoder);
    writeSpan32Descriptor(
      this.view,
      this.baseOffset + descriptorOffset,
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
    const descriptor = this.appendText(text, encoding);
    writeSpan32Descriptor(
      this.view,
      this.baseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );
    return descriptor;
  }
}
