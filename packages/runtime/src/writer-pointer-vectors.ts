import { writeVector32Descriptor, type Vector32Descriptor } from "./descriptor32.js";
import {
  POINTER32_BYTE_LENGTH,
  POINTER32_NULL,
  pointer32RelativeOffset,
} from "./pointer32.js";
import { assertDataViewRange, assertNonNegativeInteger } from "./range.js";
import { StructVectorLayoutWriter } from "./writer-struct-vectors.js";

export class PointerVectorLayoutWriter extends StructVectorLayoutWriter {
  writePointerVector(
    descriptorOffset: number,
    targetOffsets: readonly (number | null)[],
    targetByteLength: number,
  ): Vector32Descriptor {
    return this.writePointerVectorAtBase(
      this.baseOffset,
      descriptorOffset,
      targetOffsets,
      targetByteLength,
    );
  }

  writePointerVectorAtBase(
    descriptorBaseOffset: number,
    descriptorOffset: number,
    targetOffsets: readonly (number | null)[],
    targetByteLength: number,
  ): Vector32Descriptor {
    assertNonNegativeInteger(targetByteLength, "targetByteLength");

    const payloadOffset = this.reserve(targetOffsets.length * POINTER32_BYTE_LENGTH, 4);
    const payloadAbsoluteOffset = this.baseOffset + payloadOffset;
    const descriptor = {
      relOffset: this.relativeOffsetFromBase(
        descriptorBaseOffset,
        payloadAbsoluteOffset,
        "Vector32.relOffset",
      ),
      count: targetOffsets.length,
    };
    writeVector32Descriptor(
      this.view,
      descriptorBaseOffset + descriptorOffset,
      descriptor,
      this.littleEndian,
    );

    targetOffsets.forEach((targetOffset, index) => {
      const absolutePointerOffset = payloadAbsoluteOffset + index * POINTER32_BYTE_LENGTH;
      if (targetOffset !== null) {
        assertDataViewRange(this.view, targetOffset, targetByteLength);
      }
      const value =
        targetOffset === null
          ? POINTER32_NULL
          : pointer32RelativeOffset(absolutePointerOffset, targetOffset);
      if (value === POINTER32_NULL) {
        this.view.setUint32(absolutePointerOffset, value, this.littleEndian);
      } else {
        this.view.setInt32(absolutePointerOffset, value, this.littleEndian);
      }
    });

    return descriptor;
  }
}
