import { readScalar, scalarByteLength, type ScalarKind } from "./scalar.js";
import { VectorView } from "./vector-base.js";

export class ScalarVectorView<T extends number | bigint | boolean> extends VectorView<T> {
  constructor(
    view: DataView,
    descriptorOffset: number,
    private readonly scalarKind: ScalarKind,
    baseOffset = 0,
    littleEndian = true,
  ) {
    super(view, descriptorOffset, baseOffset, littleEndian);
  }

  at(index: number): T {
    const stride = scalarByteLength(this.scalarKind);
    const localOffset = this.elementOffsetAt(index, stride);
    this.assertRange(localOffset, stride);
    return readScalar(
      this.view,
      this.scalarKind,
      this.absoluteOffset(localOffset),
      this.littleEndian,
    ) as T;
  }
}
