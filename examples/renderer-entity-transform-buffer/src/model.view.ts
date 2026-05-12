import { ProjectionView } from "@exornea/zeno-runtime";

export interface EntityTransformViewInput {
  readonly id: number;
  readonly kind: number;
  readonly flags: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly qx: number;
  readonly qy: number;
  readonly qz: number;
  readonly qw: number;
  readonly scale: number;
  readonly visible: boolean;
}

export const EntityTransformViewByteLength = 48;
export const EntityTransformViewAlignment = 4;
export const EntityTransformViewIdOffset = 0;
export const EntityTransformViewKindOffset = 4;
export const EntityTransformViewFlagsOffset = 8;
export const EntityTransformViewXOffset = 12;
export const EntityTransformViewYOffset = 16;
export const EntityTransformViewZOffset = 20;
export const EntityTransformViewQxOffset = 24;
export const EntityTransformViewQyOffset = 28;
export const EntityTransformViewQzOffset = 32;
export const EntityTransformViewQwOffset = 36;
export const EntityTransformViewScaleOffset = 40;
export const EntityTransformViewVisibleOffset = 44;

export class EntityTransformView extends ProjectionView {
  static readonly byteLength = 48;
  static readonly alignment = 4;
  static readonly idOffset = 0;
  static readonly kindOffset = 4;
  static readonly flagsOffset = 8;
  static readonly xOffset = 12;
  static readonly yOffset = 16;
  static readonly zOffset = 20;
  static readonly qxOffset = 24;
  static readonly qyOffset = 28;
  static readonly qzOffset = 32;
  static readonly qwOffset = 36;
  static readonly scaleOffset = 40;
  static readonly visibleOffset = 44;

  static assertRecordRange(view: DataView, count: number, baseOffset = 0): void {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError(`Invalid record count: ${count}`);
    }
    if (!Number.isSafeInteger(baseOffset) || baseOffset < 0) {
      throw new RangeError(`Invalid base offset: ${baseOffset}`);
    }
    if (baseOffset > view.byteLength) {
      throw new RangeError(`baseOffset ${baseOffset} exceeds DataView length ${view.byteLength}`);
    }

    const requiredByteLength = count * 48;
    if (!Number.isSafeInteger(requiredByteLength)) {
      throw new RangeError(`record range byte length exceeds safe integer: count=${count}, byteLength=48`);
    }
    if (requiredByteLength > view.byteLength - baseOffset) {
      throw new RangeError(`record range exceeds DataView length ${view.byteLength}: baseOffset=${baseOffset}, count=${count}, byteLength=48`);
    }
  }

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
    const lastByte = baseOffset + fieldOffset + (count - 1) * EntityTransformView.byteLength + fieldByteLength;
    if (lastByte > view.byteLength) {
      throw new RangeError(`scan range exceeds DataView length ${view.byteLength}`);
    }
  }

  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  static at(view: DataView, baseOffset = 0, littleEndian = true): EntityTransformView {
    return new EntityTransformView(view, baseOffset, littleEndian);
  }

  moveTo(index: number): this {
    return this.moveToIndex(index, EntityTransformView.byteLength);
  }

  moveToUnchecked(index: number): this {
    return this.rebaseUnchecked(index * 48);
  }

  static write(view: DataView, value: EntityTransformViewInput, baseOffset = 0, littleEndian = true): void {
    EntityTransformView.setId(view, value.id, baseOffset, littleEndian);
    EntityTransformView.setKind(view, value.kind, baseOffset, littleEndian);
    EntityTransformView.setFlags(view, value.flags, baseOffset, littleEndian);
    EntityTransformView.setX(view, value.x, baseOffset, littleEndian);
    EntityTransformView.setY(view, value.y, baseOffset, littleEndian);
    EntityTransformView.setZ(view, value.z, baseOffset, littleEndian);
    EntityTransformView.setQx(view, value.qx, baseOffset, littleEndian);
    EntityTransformView.setQy(view, value.qy, baseOffset, littleEndian);
    EntityTransformView.setQz(view, value.qz, baseOffset, littleEndian);
    EntityTransformView.setQw(view, value.qw, baseOffset, littleEndian);
    EntityTransformView.setScale(view, value.scale, baseOffset, littleEndian);
    EntityTransformView.setVisible(view, value.visible, baseOffset, littleEndian);
  }

  static getId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 0, littleEndian);
  }
  static setId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 0, value, littleEndian);
  }
  static getIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 48 + 0, littleEndian);
  }
  static setIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 48 + 0, value, littleEndian);
  }
  static sumId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 0;
    const limit = start + count * 48;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 48) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 48;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 48;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 0, 4);
    let matched = 0;
    const start = baseOffset + 0;
    const limit = start + count * 48;
    for (let offset = start; offset < limit; offset += 48) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 0, 4);
    const start = baseOffset + 0;
    const limit = start + count * 48;
    let index = 0;
    for (let offset = start; offset < limit; offset += 48) {
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

  static getKind(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 4, littleEndian);
  }
  static setKind(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 4, value, littleEndian);
  }
  static getKindAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 48 + 4, littleEndian);
  }
  static setKindAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 48 + 4, value, littleEndian);
  }
  static sumKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 4;
    const limit = start + count * 48;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 48) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 48;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 48;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countKindWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 4, 2);
    let matched = 0;
    const start = baseOffset + 4;
    const limit = start + count * 48;
    for (let offset = start; offset < limit; offset += 48) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstKindWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 4, 2);
    const start = baseOffset + 4;
    const limit = start + count * 48;
    let index = 0;
    for (let offset = start; offset < limit; offset += 48) {
      if (view.getUint16(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get kind(): number {
    return this.view.getUint16(this.baseOffset + 4, this.littleEndian);
  }
  set kind(value: number) {
    this.view.setUint16(this.baseOffset + 4, value, this.littleEndian);
  }

  static getFlags(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 8, littleEndian);
  }
  static setFlags(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 8, value, littleEndian);
  }
  static getFlagsAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 48 + 8, littleEndian);
  }
  static setFlagsAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 48 + 8, value, littleEndian);
  }
  static sumFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 8;
    const limit = start + count * 48;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 48) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 8;
    const limit = start + count * 48;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 8;
    const limit = start + count * 48;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 8, 4);
    let matched = 0;
    const start = baseOffset + 8;
    const limit = start + count * 48;
    for (let offset = start; offset < limit; offset += 48) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 8, 4);
    const start = baseOffset + 8;
    const limit = start + count * 48;
    let index = 0;
    for (let offset = start; offset < limit; offset += 48) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get flags(): number {
    return this.view.getUint32(this.baseOffset + 8, this.littleEndian);
  }
  set flags(value: number) {
    this.view.setUint32(this.baseOffset + 8, value, this.littleEndian);
  }

  static getX(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 12, littleEndian);
  }
  static setX(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 12, value, littleEndian);
  }
  static getXAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 48 + 12, littleEndian);
  }
  static setXAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 48 + 12, value, littleEndian);
  }
  static sumX(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 12;
    const limit = start + count * 48;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 48) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minX(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 12;
    const limit = start + count * 48;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxX(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 12;
    const limit = start + count * 48;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get x(): number {
    return this.view.getFloat32(this.baseOffset + 12, this.littleEndian);
  }
  set x(value: number) {
    this.view.setFloat32(this.baseOffset + 12, value, this.littleEndian);
  }

  static getY(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 16, littleEndian);
  }
  static setY(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 16, value, littleEndian);
  }
  static getYAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 48 + 16, littleEndian);
  }
  static setYAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 48 + 16, value, littleEndian);
  }
  static sumY(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 16;
    const limit = start + count * 48;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 48) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minY(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 16;
    const limit = start + count * 48;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxY(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 16;
    const limit = start + count * 48;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get y(): number {
    return this.view.getFloat32(this.baseOffset + 16, this.littleEndian);
  }
  set y(value: number) {
    this.view.setFloat32(this.baseOffset + 16, value, this.littleEndian);
  }

  static getZ(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 20, littleEndian);
  }
  static setZ(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 20, value, littleEndian);
  }
  static getZAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 48 + 20, littleEndian);
  }
  static setZAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 48 + 20, value, littleEndian);
  }
  static sumZ(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 20;
    const limit = start + count * 48;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 48) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minZ(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 20;
    const limit = start + count * 48;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxZ(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 20;
    const limit = start + count * 48;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get z(): number {
    return this.view.getFloat32(this.baseOffset + 20, this.littleEndian);
  }
  set z(value: number) {
    this.view.setFloat32(this.baseOffset + 20, value, this.littleEndian);
  }

  static getQx(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 24, littleEndian);
  }
  static setQx(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 24, value, littleEndian);
  }
  static getQxAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 48 + 24, littleEndian);
  }
  static setQxAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 48 + 24, value, littleEndian);
  }
  static sumQx(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 24;
    const limit = start + count * 48;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 48) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minQx(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 24;
    const limit = start + count * 48;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxQx(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 24;
    const limit = start + count * 48;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get qx(): number {
    return this.view.getFloat32(this.baseOffset + 24, this.littleEndian);
  }
  set qx(value: number) {
    this.view.setFloat32(this.baseOffset + 24, value, this.littleEndian);
  }

  static getQy(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 28, littleEndian);
  }
  static setQy(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 28, value, littleEndian);
  }
  static getQyAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 48 + 28, littleEndian);
  }
  static setQyAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 48 + 28, value, littleEndian);
  }
  static sumQy(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 28, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 28;
    const limit = start + count * 48;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 48) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minQy(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 28, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 28;
    const limit = start + count * 48;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxQy(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 28, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 28;
    const limit = start + count * 48;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get qy(): number {
    return this.view.getFloat32(this.baseOffset + 28, this.littleEndian);
  }
  set qy(value: number) {
    this.view.setFloat32(this.baseOffset + 28, value, this.littleEndian);
  }

  static getQz(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 32, littleEndian);
  }
  static setQz(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 32, value, littleEndian);
  }
  static getQzAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 48 + 32, littleEndian);
  }
  static setQzAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 48 + 32, value, littleEndian);
  }
  static sumQz(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 32, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 32;
    const limit = start + count * 48;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 48) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minQz(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 32, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 32;
    const limit = start + count * 48;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxQz(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 32, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 32;
    const limit = start + count * 48;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get qz(): number {
    return this.view.getFloat32(this.baseOffset + 32, this.littleEndian);
  }
  set qz(value: number) {
    this.view.setFloat32(this.baseOffset + 32, value, this.littleEndian);
  }

  static getQw(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 36, littleEndian);
  }
  static setQw(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 36, value, littleEndian);
  }
  static getQwAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 48 + 36, littleEndian);
  }
  static setQwAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 48 + 36, value, littleEndian);
  }
  static sumQw(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 36, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 36;
    const limit = start + count * 48;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 48) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minQw(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 36, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 36;
    const limit = start + count * 48;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxQw(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 36, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 36;
    const limit = start + count * 48;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get qw(): number {
    return this.view.getFloat32(this.baseOffset + 36, this.littleEndian);
  }
  set qw(value: number) {
    this.view.setFloat32(this.baseOffset + 36, value, this.littleEndian);
  }

  static getScale(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 40, littleEndian);
  }
  static setScale(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 40, value, littleEndian);
  }
  static getScaleAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 48 + 40, littleEndian);
  }
  static setScaleAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 48 + 40, value, littleEndian);
  }
  static sumScale(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 40, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 40;
    const limit = start + count * 48;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 48) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minScale(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 40, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 40;
    const limit = start + count * 48;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxScale(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 40, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 40;
    const limit = start + count * 48;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 48) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get scale(): number {
    return this.view.getFloat32(this.baseOffset + 40, this.littleEndian);
  }
  set scale(value: number) {
    this.view.setFloat32(this.baseOffset + 40, value, this.littleEndian);
  }

  static getVisible(view: DataView, baseOffset = 0, littleEndian = true): boolean {
    return view.getUint8(baseOffset + 44) !== 0;
  }
  static setVisible(view: DataView, value: boolean, baseOffset = 0, littleEndian = true): void {
    view.setUint8(baseOffset + 44, value ? 1 : 0);
  }
  static getVisibleAt(view: DataView, index: number, littleEndian = true): boolean {
    return view.getUint8(index * 48 + 44) !== 0;
  }
  static setVisibleAt(view: DataView, value: boolean, index: number, littleEndian = true): void {
    view.setUint8(index * 48 + 44, value ? 1 : 0);
  }
  static countVisibleWhereEq(view: DataView, count: number, expected: boolean, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 44, 1);
    let matched = 0;
    const start = baseOffset + 44;
    const limit = start + count * 48;
    for (let offset = start; offset < limit; offset += 48) {
      if (view.getUint8(offset) !== 0 === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstVisibleWhereEq(view: DataView, count: number, expected: boolean, baseOffset = 0, littleEndian = true): number {
    EntityTransformView.assertScanRange(view, count, baseOffset, 44, 1);
    const start = baseOffset + 44;
    const limit = start + count * 48;
    let index = 0;
    for (let offset = start; offset < limit; offset += 48) {
      if (view.getUint8(offset) !== 0 === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get visible(): boolean {
    return this.view.getUint8(this.baseOffset + 44) !== 0;
  }
  set visible(value: boolean) {
    this.view.setUint8(this.baseOffset + 44, value ? 1 : 0);
  }

}
