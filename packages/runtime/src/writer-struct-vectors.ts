import {
  writeVector32Descriptor,
  type Vector32Descriptor,
} from "./descriptor32.js";
import { ScalarVectorLayoutWriter } from "./writer-scalar-vectors.js";

export class StructVectorLayoutWriter extends ScalarVectorLayoutWriter {
  writeStructVector<T>(
    descriptorOffset: number,
    values: readonly T[],
    elementByteLength: number,
    writeElement: (
      view: DataView,
      value: T,
      baseOffset: number,
      littleEndian: boolean,
    ) => void,
    alignment = 1,
  ): Vector32Descriptor {
    const payloadOffset = this.reserve(values.length * elementByteLength, alignment);
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
      writeElement(
        this.view,
        value,
        this.baseOffset + payloadOffset + index * elementByteLength,
        this.littleEndian,
      );
    });

    return descriptor;
  }
}
