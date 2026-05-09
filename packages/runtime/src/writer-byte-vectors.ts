import {
  SPAN32_BYTE_LENGTH,
  writeSpan32Descriptor,
  writeVector32Descriptor,
  type Vector32Descriptor,
} from "./descriptor32.js";
import {
  UTF8_ENCODER,
  encodeText,
  writeFixedBytes,
  writeFixedText,
  writeFixedUtf8,
  type TextEncoding,
} from "./fixed.js";
import { SpanLayoutWriter } from "./writer-spans.js";

export class ByteVectorLayoutWriter extends SpanLayoutWriter {
  writeBytesVector(
    descriptorOffset: number,
    values: readonly (ArrayLike<number> | Uint8Array)[],
  ): Vector32Descriptor {
    return this.writeBytesVectorAtBase(this.baseOffset, descriptorOffset, values);
  }

  writeBytesVectorAtBase(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    values: readonly (ArrayLike<number> | Uint8Array)[],
  ): Vector32Descriptor {
    const tableOffset = this.reserve(values.length * SPAN32_BYTE_LENGTH, 4);
    const tableAbsoluteOffset = this.baseOffset + tableOffset;
    const descriptor = {
      relOffset: this.relativeOffsetFromBase(
        descriptorBaseOffset,
        tableAbsoluteOffset,
        "Vector32.relOffset",
      ),
      count: values.length,
    };
    writeVector32Descriptor(
      this.view,
      descriptorBaseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );

    values.forEach((value, index) => {
      const span = this.appendBytesAtBase(descriptorBaseOffset, value);
      writeSpan32Descriptor(
        this.view,
        tableAbsoluteOffset + index * SPAN32_BYTE_LENGTH,
        span,
        this.littleEndian,
      );
    });

    return descriptor;
  }

  writeUtf8Vector(
    descriptorOffset: number,
    values: readonly string[],
    encoder = UTF8_ENCODER,
  ): Vector32Descriptor {
    return this.writeUtf8VectorAtBase(this.baseOffset, descriptorOffset, values, encoder);
  }

  writeUtf8VectorAtBase(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    values: readonly string[],
    encoder = UTF8_ENCODER,
  ): Vector32Descriptor {
    return this.writeBytesVectorAtBase(
      descriptorBaseOffset,
      descriptorOffset,
      values.map((value) => encoder.encode(value)),
    );
  }

  writeTextVector(
    descriptorOffset: number,
    values: readonly string[],
    encoding: TextEncoding = "utf8",
  ): Vector32Descriptor {
    return this.writeTextVectorAtBase(this.baseOffset, descriptorOffset, values, encoding);
  }

  writeTextVectorAtBase(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    values: readonly string[],
    encoding: TextEncoding = "utf8",
  ): Vector32Descriptor {
    return this.writeBytesVectorAtBase(
      descriptorBaseOffset,
      descriptorOffset,
      values.map((value) => encodeText(value, encoding)),
    );
  }

  writeFixedBytesVector(
    descriptorOffset: number,
    values: readonly (ArrayLike<number> | Uint8Array)[],
    elementByteLength: number,
  ): Vector32Descriptor {
    return this.writeFixedBytesVectorAtBase(
      this.baseOffset,
      descriptorOffset,
      values,
      elementByteLength,
    );
  }

  writeFixedBytesVectorAtBase(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    values: readonly (ArrayLike<number> | Uint8Array)[],
    elementByteLength: number,
  ): Vector32Descriptor {
    const payloadOffset = this.reserve(values.length * elementByteLength, 1);
    const payloadAbsoluteOffset = this.baseOffset + payloadOffset;
    const descriptor = {
      relOffset: this.relativeOffsetFromBase(
        descriptorBaseOffset,
        payloadAbsoluteOffset,
        "Vector32.relOffset",
      ),
      count: values.length,
    };
    writeVector32Descriptor(
      this.view,
      descriptorBaseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );

    values.forEach((value, index) => {
      writeFixedBytes(
        this.view.buffer,
        this.view.byteOffset + payloadAbsoluteOffset + index * elementByteLength,
        elementByteLength,
        value,
      );
    });

    return descriptor;
  }

  writeFixedUtf8Vector(
    descriptorOffset: number,
    values: readonly string[],
    elementByteLength: number,
    encoder = UTF8_ENCODER,
  ): Vector32Descriptor {
    return this.writeFixedUtf8VectorAtBase(
      this.baseOffset,
      descriptorOffset,
      values,
      elementByteLength,
      encoder,
    );
  }

  writeFixedUtf8VectorAtBase(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    values: readonly string[],
    elementByteLength: number,
    encoder = UTF8_ENCODER,
  ): Vector32Descriptor {
    const payloadOffset = this.reserve(values.length * elementByteLength, 1);
    const payloadAbsoluteOffset = this.baseOffset + payloadOffset;
    const descriptor = {
      relOffset: this.relativeOffsetFromBase(
        descriptorBaseOffset,
        payloadAbsoluteOffset,
        "Vector32.relOffset",
      ),
      count: values.length,
    };
    writeVector32Descriptor(
      this.view,
      descriptorBaseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );

    values.forEach((value, index) => {
      writeFixedUtf8(
        this.view.buffer,
        this.view.byteOffset + payloadAbsoluteOffset + index * elementByteLength,
        elementByteLength,
        value,
        encoder,
      );
    });

    return descriptor;
  }

  writeFixedTextVector(
    descriptorOffset: number,
    values: readonly string[],
    elementByteLength: number,
    encoding: TextEncoding = "utf8",
  ): Vector32Descriptor {
    return this.writeFixedTextVectorAtBase(
      this.baseOffset,
      descriptorOffset,
      values,
      elementByteLength,
      encoding,
    );
  }

  writeFixedTextVectorAtBase(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    values: readonly string[],
    elementByteLength: number,
    encoding: TextEncoding = "utf8",
  ): Vector32Descriptor {
    const payloadOffset = this.reserve(values.length * elementByteLength, 1);
    const payloadAbsoluteOffset = this.baseOffset + payloadOffset;
    const descriptor = {
      relOffset: this.relativeOffsetFromBase(
        descriptorBaseOffset,
        payloadAbsoluteOffset,
        "Vector32.relOffset",
      ),
      count: values.length,
    };
    writeVector32Descriptor(
      this.view,
      descriptorBaseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );

    values.forEach((value, index) => {
      writeFixedText(
        this.view.buffer,
        this.view.byteOffset + payloadAbsoluteOffset + index * elementByteLength,
        elementByteLength,
        value,
        encoding,
      );
    });

    return descriptor;
  }
}
