import { ProjectionView } from "@exornea/zeno-runtime";

export interface InstanceViewInput {
  readonly id: number;
  readonly meshId: number;
  readonly materialId: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  readonly color: number;
}

export const InstanceViewByteLength = 28;
export const InstanceViewAlignment = 4;
export const InstanceViewIdOffset = 0;
export const InstanceViewMeshIdOffset = 4;
export const InstanceViewMaterialIdOffset = 6;
export const InstanceViewXOffset = 8;
export const InstanceViewYOffset = 12;
export const InstanceViewZOffset = 16;
export const InstanceViewScaleOffset = 20;
export const InstanceViewColorOffset = 24;

export class InstanceView extends ProjectionView {
  static readonly byteLength = 28;
  static readonly alignment = 4;
  static readonly idOffset = 0;
  static readonly meshIdOffset = 4;
  static readonly materialIdOffset = 6;
  static readonly xOffset = 8;
  static readonly yOffset = 12;
  static readonly zOffset = 16;
  static readonly scaleOffset = 20;
  static readonly colorOffset = 24;

  private static assertScanRange(
    view: DataView,
    count: number,
    baseOffset: number,
    fieldOffset: number,
    fieldByteLength: number,
  ): void {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`Invalid record count: ${count}`);
    }
    if (!Number.isFinite(baseOffset) || !Number.isInteger(baseOffset) || baseOffset < 0) {
      throw new RangeError(`Invalid base offset: ${baseOffset}`);
    }
    if (count === 0) {
      return;
    }
    const lastByte = baseOffset + fieldOffset + (count - 1) * InstanceView.byteLength + fieldByteLength;
    if (lastByte > view.byteLength) {
      throw new RangeError(`scan range exceeds DataView length ${view.byteLength}`);
    }
  }

  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  static at(view: DataView, baseOffset = 0, littleEndian = true): InstanceView {
    return new InstanceView(view, baseOffset, littleEndian);
  }

  moveTo(index: number): this {
    return this.moveToIndex(index, InstanceView.byteLength);
  }

  moveToUnchecked(index: number): this {
    return this.rebaseUnchecked(index * 28);
  }

  static write(view: DataView, value: InstanceViewInput, baseOffset = 0, littleEndian = true): void {
    InstanceView.setId(view, value.id, baseOffset, littleEndian);
    InstanceView.setMeshId(view, value.meshId, baseOffset, littleEndian);
    InstanceView.setMaterialId(view, value.materialId, baseOffset, littleEndian);
    InstanceView.setX(view, value.x, baseOffset, littleEndian);
    InstanceView.setY(view, value.y, baseOffset, littleEndian);
    InstanceView.setZ(view, value.z, baseOffset, littleEndian);
    InstanceView.setScale(view, value.scale, baseOffset, littleEndian);
    InstanceView.setColor(view, value.color, baseOffset, littleEndian);
  }

  static getId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 0, littleEndian);
  }
  static setId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 0, value, littleEndian);
  }
  static getIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 28 + 0, littleEndian);
  }
  static setIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 28 + 0, value, littleEndian);
  }
  static sumId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 0;
    const limit = start + count * 28;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 28) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 28;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 28;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 0, 4);
    let matched = 0;
    const start = baseOffset + 0;
    const limit = start + count * 28;
    for (let offset = start; offset < limit; offset += 28) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 0, 4);
    const start = baseOffset + 0;
    const limit = start + count * 28;
    let index = 0;
    for (let offset = start; offset < limit; offset += 28) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get id(): number {
    return this.view.getUint32(this.baseOffset + 0, this.littleEndian);
  }
  set id(value: number) {
    this.view.setUint32(this.baseOffset + 0, value, this.littleEndian);
  }

  static getMeshId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 4, littleEndian);
  }
  static setMeshId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 4, value, littleEndian);
  }
  static getMeshIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 28 + 4, littleEndian);
  }
  static setMeshIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 28 + 4, value, littleEndian);
  }
  static sumMeshId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 4;
    const limit = start + count * 28;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 28) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minMeshId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 28;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxMeshId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 28;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countMeshIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 4, 2);
    let matched = 0;
    const start = baseOffset + 4;
    const limit = start + count * 28;
    for (let offset = start; offset < limit; offset += 28) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstMeshIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 4, 2);
    const start = baseOffset + 4;
    const limit = start + count * 28;
    let index = 0;
    for (let offset = start; offset < limit; offset += 28) {
      if (view.getUint16(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get meshId(): number {
    return this.view.getUint16(this.baseOffset + 4, this.littleEndian);
  }
  set meshId(value: number) {
    this.view.setUint16(this.baseOffset + 4, value, this.littleEndian);
  }

  static getMaterialId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 6, littleEndian);
  }
  static setMaterialId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 6, value, littleEndian);
  }
  static getMaterialIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 28 + 6, littleEndian);
  }
  static setMaterialIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 28 + 6, value, littleEndian);
  }
  static sumMaterialId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 6, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 6;
    const limit = start + count * 28;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 28) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minMaterialId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 6, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 6;
    const limit = start + count * 28;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxMaterialId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 6, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 6;
    const limit = start + count * 28;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countMaterialIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 6, 2);
    let matched = 0;
    const start = baseOffset + 6;
    const limit = start + count * 28;
    for (let offset = start; offset < limit; offset += 28) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstMaterialIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 6, 2);
    const start = baseOffset + 6;
    const limit = start + count * 28;
    let index = 0;
    for (let offset = start; offset < limit; offset += 28) {
      if (view.getUint16(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get materialId(): number {
    return this.view.getUint16(this.baseOffset + 6, this.littleEndian);
  }
  set materialId(value: number) {
    this.view.setUint16(this.baseOffset + 6, value, this.littleEndian);
  }

  static getX(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 8, littleEndian);
  }
  static setX(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 8, value, littleEndian);
  }
  static getXAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 28 + 8, littleEndian);
  }
  static setXAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 28 + 8, value, littleEndian);
  }
  static sumX(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 8;
    const limit = start + count * 28;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 28) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minX(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 8;
    const limit = start + count * 28;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxX(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 8;
    const limit = start + count * 28;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get x(): number {
    return this.view.getFloat32(this.baseOffset + 8, this.littleEndian);
  }
  set x(value: number) {
    this.view.setFloat32(this.baseOffset + 8, value, this.littleEndian);
  }

  static getY(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 12, littleEndian);
  }
  static setY(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 12, value, littleEndian);
  }
  static getYAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 28 + 12, littleEndian);
  }
  static setYAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 28 + 12, value, littleEndian);
  }
  static sumY(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 12;
    const limit = start + count * 28;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 28) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minY(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 12;
    const limit = start + count * 28;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxY(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 12;
    const limit = start + count * 28;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get y(): number {
    return this.view.getFloat32(this.baseOffset + 12, this.littleEndian);
  }
  set y(value: number) {
    this.view.setFloat32(this.baseOffset + 12, value, this.littleEndian);
  }

  static getZ(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 16, littleEndian);
  }
  static setZ(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 16, value, littleEndian);
  }
  static getZAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 28 + 16, littleEndian);
  }
  static setZAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 28 + 16, value, littleEndian);
  }
  static sumZ(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 16;
    const limit = start + count * 28;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 28) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minZ(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 16;
    const limit = start + count * 28;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxZ(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 16;
    const limit = start + count * 28;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get z(): number {
    return this.view.getFloat32(this.baseOffset + 16, this.littleEndian);
  }
  set z(value: number) {
    this.view.setFloat32(this.baseOffset + 16, value, this.littleEndian);
  }

  static getScale(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 20, littleEndian);
  }
  static setScale(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 20, value, littleEndian);
  }
  static getScaleAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 28 + 20, littleEndian);
  }
  static setScaleAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 28 + 20, value, littleEndian);
  }
  static sumScale(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 20;
    const limit = start + count * 28;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 28) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minScale(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 20;
    const limit = start + count * 28;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxScale(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 20;
    const limit = start + count * 28;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get scale(): number {
    return this.view.getFloat32(this.baseOffset + 20, this.littleEndian);
  }
  set scale(value: number) {
    this.view.setFloat32(this.baseOffset + 20, value, this.littleEndian);
  }

  static getColor(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 24, littleEndian);
  }
  static setColor(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 24, value, littleEndian);
  }
  static getColorAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 28 + 24, littleEndian);
  }
  static setColorAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 28 + 24, value, littleEndian);
  }
  static sumColor(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 24;
    const limit = start + count * 28;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 28) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minColor(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 24;
    const limit = start + count * 28;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxColor(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 24;
    const limit = start + count * 28;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 28) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countColorWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    let matched = 0;
    const start = baseOffset + 24;
    const limit = start + count * 28;
    for (let offset = start; offset < limit; offset += 28) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstColorWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    const start = baseOffset + 24;
    const limit = start + count * 28;
    let index = 0;
    for (let offset = start; offset < limit; offset += 28) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get color(): number {
    return this.view.getUint32(this.baseOffset + 24, this.littleEndian);
  }
  set color(value: number) {
    this.view.setUint32(this.baseOffset + 24, value, this.littleEndian);
  }

}

//# sourceMappingURL=schema.view.ts.map
