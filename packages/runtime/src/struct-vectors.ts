import { ProjectionView } from "./view-base.js";
import { VectorView } from "./vector-base.js";

export class StructVectorView<TView extends ProjectionView> extends VectorView<TView> {
  constructor(
    view: DataView,
    descriptorOffset: number,
    private readonly elementByteLength: number,
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

  at(index: number): TView {
    this.assertIndex(index);
    const localOffset = this.payloadOffset() + index * this.elementByteLength;
    this.assertRange(localOffset, this.elementByteLength);
    return this.factory(this.view, this.absoluteOffset(localOffset), this.littleEndian);
  }
}

export class DynamicStructVectorView<
  TView extends ProjectionView,
> extends VectorView<TView> {
  constructor(
    view: DataView,
    descriptorOffset: number,
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

  at(index: number): TView {
    this.assertIndex(index);
    const tableOffset = this.payloadOffset() + index * 4;
    this.assertRange(tableOffset, 4);
    const elementOffset = this.view.getUint32(
      this.absoluteOffset(tableOffset),
      this.littleEndian,
    );
    this.assertRange(elementOffset, 0);
    return this.factory(this.view, this.absoluteOffset(elementOffset), this.littleEndian);
  }
}
