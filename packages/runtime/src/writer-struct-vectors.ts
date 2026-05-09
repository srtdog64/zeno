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
    return this.writeStructVectorAtBase(
      this.baseOffset,
      descriptorOffset,
      values,
      elementByteLength,
      writeElement,
      alignment,
    );
  }

  writeStructVectorAtBase<T>(
    descriptorBaseOffset: number,
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
      writeElement(
        this.view,
        value,
        payloadAbsoluteOffset + index * elementByteLength,
        this.littleEndian,
      );
    });

    return descriptor;
  }

  writeDynamicStructVectorAtBase<T>(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    values: readonly T[],
    elementByteLength: number,
    writeElement: (
      view: DataView,
      writer: this,
      value: T,
      baseOffset: number,
      littleEndian: boolean,
    ) => void,
    alignment = 1,
  ): Vector32Descriptor {
    const tableOffset = this.reserve(values.length * 4, 4);
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
      const elementOffset = this.reserve(elementByteLength, alignment);
      const elementAbsoluteOffset = this.baseOffset + elementOffset;
      const elementRelativeOffset = this.relativeOffsetFromBase(
        descriptorBaseOffset,
        elementAbsoluteOffset,
        "DynamicStructVector.elementOffset",
      );
      this.view.setUint32(
        tableAbsoluteOffset + index * 4,
        elementRelativeOffset,
        this.littleEndian,
      );
      writeElement(this.view, this, value, elementAbsoluteOffset, this.littleEndian);
    });

    return descriptor;
  }

  writeDynamicStructVector<T>(
    descriptorOffset: number,
    values: readonly T[],
    elementByteLength: number,
    writeElement: (
      view: DataView,
      writer: this,
      value: T,
      baseOffset: number,
      littleEndian: boolean,
    ) => void,
    alignment = 1,
  ): Vector32Descriptor {
    return this.writeDynamicStructVectorAtBase(
      this.baseOffset,
      descriptorOffset,
      values,
      elementByteLength,
      writeElement,
      alignment,
    );
  }
}
