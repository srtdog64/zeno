import { writeVector32Descriptor, type Vector32Descriptor } from "./descriptor32.js";
import { scalarByteLength, writeScalar, type ScalarKind } from "./scalar.js";
import { ByteVectorLayoutWriter } from "./writer-byte-vectors.js";

export class ScalarVectorLayoutWriter extends ByteVectorLayoutWriter {
  writeScalarVector<T extends number | bigint | boolean>(
    descriptorOffset: number,
    scalarKind: ScalarKind,
    values: ArrayLike<T>,
  ): Vector32Descriptor {
    return this.writeScalarVectorAtBase(this.baseOffset, descriptorOffset, scalarKind, values);
  }

  writeScalarVectorAtBase<T extends number | bigint | boolean>(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    scalarKind: ScalarKind,
    values: ArrayLike<T>,
  ): Vector32Descriptor {
    const stride = scalarByteLength(scalarKind);
    const payloadOffset = this.reserve(values.length * stride, stride);
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

    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (value === undefined) {
        throw new RangeError(`Scalar vector value at index ${index} is undefined.`);
      }
      writeScalar(
        this.view,
        scalarKind,
        payloadAbsoluteOffset + index * stride,
        value,
        this.littleEndian,
      );
    }

    return descriptor;
  }
}
