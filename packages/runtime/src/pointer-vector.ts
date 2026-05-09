import {
  POINTER32_BYTE_LENGTH,
  POINTER32_NULL,
} from "./pointer32.js";
import { assertDataViewRange } from "./range.js";
import { ProjectionView } from "./view-base.js";
import { VectorView } from "./vector-base.js";

export class PointerVectorView<TView extends ProjectionView> extends VectorView<TView | null> {
  constructor(
    view: DataView,
    descriptorOffset: number,
    private readonly targetByteLength: number,
    private readonly factory: (
      view: DataView,
      baseOffset: number,
      littleEndian: boolean,
    ) => TView,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, descriptorOffset, baseOffset, littleEndian);
  }

  rawRelativeOffsetAt(index: number): number {
    this.assertIndex(index);
    const localOffset = this.payloadOffset() + index * POINTER32_BYTE_LENGTH;
    this.assertRange(localOffset, POINTER32_BYTE_LENGTH);
    return this.view.getUint32(this.absoluteOffset(localOffset), this.littleEndian);
  }

  relativeOffsetAt(index: number): number | null {
    const rawRelativeOffset = this.rawRelativeOffsetAt(index);
    if (rawRelativeOffset === POINTER32_NULL) {
      return null;
    }

    const pointerOffset = this.payloadOffset() + index * POINTER32_BYTE_LENGTH;
    return this.view.getInt32(
      this.absoluteOffset(pointerOffset),
      this.littleEndian,
    );
  }

  targetOffsetAt(index: number): number | null {
    const relativeOffset = this.relativeOffsetAt(index);
    if (relativeOffset === null) {
      return null;
    }

    const pointerOffset = this.payloadOffset() + index * POINTER32_BYTE_LENGTH;
    const targetOffset = this.absoluteOffset(pointerOffset) + relativeOffset;
    assertDataViewRange(this.view, targetOffset, this.targetByteLength);
    return targetOffset;
  }

  into(index: number, out: TView): boolean {
    const targetOffset = this.targetOffsetAt(index);
    if (targetOffset === null) {
      return false;
    }

    out.moveToOffset(targetOffset, this.targetByteLength);
    return true;
  }

  at(index: number): TView | null {
    const targetOffset = this.targetOffsetAt(index);
    if (targetOffset === null) {
      return null;
    }

    return this.factory(this.view, targetOffset, this.littleEndian);
  }
}
