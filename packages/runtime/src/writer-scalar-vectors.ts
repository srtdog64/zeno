import { writeVector32Descriptor, type Vector32Descriptor } from "./descriptor32.js";
import { scalarByteLength, writeScalar, type ScalarKind } from "./scalar.js";
import { ByteVectorLayoutWriter } from "./writer-byte-vectors.js";

export class ScalarVectorLayoutWriter extends ByteVectorLayoutWriter {
  writeScalarVector<T extends number | bigint | boolean>(
    descriptorOffset: number,
    scalarKind: ScalarKind,
    values: readonly T[],
  ): Vector32Descriptor {
    const stride = scalarByteLength(scalarKind);
    const payloadOffset = this.reserve(values.length * stride, stride);
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
      writeScalar(
        this.view,
        scalarKind,
        this.baseOffset + payloadOffset + index * stride,
        value,
        this.littleEndian,
      );
    });

    return descriptor;
  }
}
