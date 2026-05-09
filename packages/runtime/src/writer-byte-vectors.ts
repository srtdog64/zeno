import {
  SPAN32_BYTE_LENGTH,
  writeSpan32Descriptor,
  writeVector32Descriptor,
  type Vector32Descriptor,
} from "./descriptor32.js";
import { UTF8_ENCODER, encodeText, writeFixedBytes, writeFixedText, writeFixedUtf8, type TextEncoding } from "./fixed.js";
import { SpanLayoutWriter } from "./writer-spans.js";

export class ByteVectorLayoutWriter extends SpanLayoutWriter {
  writeBytesVector(
    descriptorOffset: number,
    values: readonly (ArrayLike<number> | Uint8Array)[],
  ): Vector32Descriptor {
    const tableOffset = this.reserve(values.length * SPAN32_BYTE_LENGTH, 4);
    const descriptor = {
      relOffset: tableOffset,
      count: values.length,
    };
    writeVector32Descriptor(
      this.view,
      this.baseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );

    values.forEach((value, index) => {
      const span = this.appendBytes(value);
      writeSpan32Descriptor(
        this.view,
        this.baseOffset + tableOffset + index * SPAN32_BYTE_LENGTH,
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
    return this.writeBytesVector(
      descriptorOffset,
      values.map((value) => encoder.encode(value)),
    );
  }

  writeTextVector(
    descriptorOffset: number,
    values: readonly string[],
    encoding: TextEncoding = "utf8",
  ): Vector32Descriptor {
    return this.writeBytesVector(
      descriptorOffset,
      values.map((value) => encodeText(value, encoding)),
    );
  }

  writeFixedBytesVector(
    descriptorOffset: number,
    values: readonly (ArrayLike<number> | Uint8Array)[],
    elementByteLength: number,
  ): Vector32Descriptor {
    const payloadOffset = this.reserve(values.length * elementByteLength, 1);
    const descriptor = {
      relOffset: payloadOffset,
      count: values.length,
    };
    writeVector32Descriptor(
      this.view,
      this.baseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );

    values.forEach((value, index) => {
      writeFixedBytes(
        this.view.buffer,
        this.view.byteOffset + this.baseOffset + payloadOffset + index * elementByteLength,
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
    const payloadOffset = this.reserve(values.length * elementByteLength, 1);
    const descriptor = {
      relOffset: payloadOffset,
      count: values.length,
    };
    writeVector32Descriptor(
      this.view,
      this.baseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );

    values.forEach((value, index) => {
      writeFixedUtf8(
        this.view.buffer,
        this.view.byteOffset + this.baseOffset + payloadOffset + index * elementByteLength,
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
    const payloadOffset = this.reserve(values.length * elementByteLength, 1);
    const descriptor = {
      relOffset: payloadOffset,
      count: values.length,
    };
    writeVector32Descriptor(
      this.view,
      this.baseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );

    values.forEach((value, index) => {
      writeFixedText(
        this.view.buffer,
        this.view.byteOffset + this.baseOffset + payloadOffset + index * elementByteLength,
        elementByteLength,
        value,
        encoding,
      );
    });

    return descriptor;
  }
}
