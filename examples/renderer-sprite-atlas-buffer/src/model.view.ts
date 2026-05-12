import { ProjectionView } from "@exornea/zeno-runtime";

export interface SpriteInstanceViewInput {
  readonly atlasId: number;
  readonly tileId: number;
  readonly flags: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
  readonly color: number;
  readonly visible: boolean;
}

export const SpriteInstanceViewByteLength = 44;
export const SpriteInstanceViewAlignment = 4;
export const SpriteInstanceViewAtlasIdOffset = 0;
export const SpriteInstanceViewTileIdOffset = 2;
export const SpriteInstanceViewFlagsOffset = 4;
export const SpriteInstanceViewXOffset = 8;
export const SpriteInstanceViewYOffset = 12;
export const SpriteInstanceViewZOffset = 16;
export const SpriteInstanceViewU0Offset = 20;
export const SpriteInstanceViewV0Offset = 24;
export const SpriteInstanceViewU1Offset = 28;
export const SpriteInstanceViewV1Offset = 32;
export const SpriteInstanceViewColorOffset = 36;
export const SpriteInstanceViewVisibleOffset = 40;

export class SpriteInstanceView extends ProjectionView {
  static readonly byteLength = 44;
  static readonly alignment = 4;
  static readonly atlasIdOffset = 0;
  static readonly tileIdOffset = 2;
  static readonly flagsOffset = 4;
  static readonly xOffset = 8;
  static readonly yOffset = 12;
  static readonly zOffset = 16;
  static readonly u0Offset = 20;
  static readonly v0Offset = 24;
  static readonly u1Offset = 28;
  static readonly v1Offset = 32;
  static readonly colorOffset = 36;
  static readonly visibleOffset = 40;

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

    const requiredByteLength = count * 44;
    if (!Number.isSafeInteger(requiredByteLength)) {
      throw new RangeError(`record range byte length exceeds safe integer: count=${count}, byteLength=44`);
    }
    if (requiredByteLength > view.byteLength - baseOffset) {
      throw new RangeError(`record range exceeds DataView length ${view.byteLength}: baseOffset=${baseOffset}, count=${count}, byteLength=44`);
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
    const lastByte = baseOffset + fieldOffset + (count - 1) * SpriteInstanceView.byteLength + fieldByteLength;
    if (lastByte > view.byteLength) {
      throw new RangeError(`scan range exceeds DataView length ${view.byteLength}`);
    }
  }

  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  static at(view: DataView, baseOffset = 0, littleEndian = true): SpriteInstanceView {
    return new SpriteInstanceView(view, baseOffset, littleEndian);
  }

  moveTo(index: number): this {
    return this.moveToIndex(index, SpriteInstanceView.byteLength);
  }

  moveToUnchecked(index: number): this {
    return this.rebaseUnchecked(index * 44);
  }

  static write(view: DataView, value: SpriteInstanceViewInput, baseOffset = 0, littleEndian = true): void {
    SpriteInstanceView.setAtlasId(view, value.atlasId, baseOffset, littleEndian);
    SpriteInstanceView.setTileId(view, value.tileId, baseOffset, littleEndian);
    SpriteInstanceView.setFlags(view, value.flags, baseOffset, littleEndian);
    SpriteInstanceView.setX(view, value.x, baseOffset, littleEndian);
    SpriteInstanceView.setY(view, value.y, baseOffset, littleEndian);
    SpriteInstanceView.setZ(view, value.z, baseOffset, littleEndian);
    SpriteInstanceView.setU0(view, value.u0, baseOffset, littleEndian);
    SpriteInstanceView.setV0(view, value.v0, baseOffset, littleEndian);
    SpriteInstanceView.setU1(view, value.u1, baseOffset, littleEndian);
    SpriteInstanceView.setV1(view, value.v1, baseOffset, littleEndian);
    SpriteInstanceView.setColor(view, value.color, baseOffset, littleEndian);
    SpriteInstanceView.setVisible(view, value.visible, baseOffset, littleEndian);
  }

  static getAtlasId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 0, littleEndian);
  }
  static setAtlasId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 0, value, littleEndian);
  }
  static getAtlasIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 44 + 0, littleEndian);
  }
  static setAtlasIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 44 + 0, value, littleEndian);
  }
  static sumAtlasId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 0, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 0;
    const limit = start + count * 44;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 44) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minAtlasId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 0, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 44;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxAtlasId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 0, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 44;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countAtlasIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 0, 2);
    let matched = 0;
    const start = baseOffset + 0;
    const limit = start + count * 44;
    for (let offset = start; offset < limit; offset += 44) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstAtlasIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 0, 2);
    const start = baseOffset + 0;
    const limit = start + count * 44;
    let index = 0;
    for (let offset = start; offset < limit; offset += 44) {
      if (view.getUint16(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get atlasId(): number {
    return this.view.getUint16(this.baseOffset + 0, this.littleEndian);
  }
  set atlasId(value: number) {
    this.view.setUint16(this.baseOffset + 0, value, this.littleEndian);
  }

  static getTileId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 2, littleEndian);
  }
  static setTileId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 2, value, littleEndian);
  }
  static getTileIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 44 + 2, littleEndian);
  }
  static setTileIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 44 + 2, value, littleEndian);
  }
  static sumTileId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 2, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 2;
    const limit = start + count * 44;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 44) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minTileId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 2, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 2;
    const limit = start + count * 44;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxTileId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 2, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 2;
    const limit = start + count * 44;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countTileIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 2, 2);
    let matched = 0;
    const start = baseOffset + 2;
    const limit = start + count * 44;
    for (let offset = start; offset < limit; offset += 44) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstTileIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 2, 2);
    const start = baseOffset + 2;
    const limit = start + count * 44;
    let index = 0;
    for (let offset = start; offset < limit; offset += 44) {
      if (view.getUint16(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get tileId(): number {
    return this.view.getUint16(this.baseOffset + 2, this.littleEndian);
  }
  set tileId(value: number) {
    this.view.setUint16(this.baseOffset + 2, value, this.littleEndian);
  }

  static getFlags(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 4, littleEndian);
  }
  static setFlags(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 4, value, littleEndian);
  }
  static getFlagsAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 44 + 4, littleEndian);
  }
  static setFlagsAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 44 + 4, value, littleEndian);
  }
  static sumFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 4;
    const limit = start + count * 44;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 44) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 44;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 44;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 4, 4);
    let matched = 0;
    const start = baseOffset + 4;
    const limit = start + count * 44;
    for (let offset = start; offset < limit; offset += 44) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 4, 4);
    const start = baseOffset + 4;
    const limit = start + count * 44;
    let index = 0;
    for (let offset = start; offset < limit; offset += 44) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get flags(): number {
    return this.view.getUint32(this.baseOffset + 4, this.littleEndian);
  }
  set flags(value: number) {
    this.view.setUint32(this.baseOffset + 4, value, this.littleEndian);
  }

  static getX(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 8, littleEndian);
  }
  static setX(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 8, value, littleEndian);
  }
  static getXAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 44 + 8, littleEndian);
  }
  static setXAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 44 + 8, value, littleEndian);
  }
  static sumX(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 8;
    const limit = start + count * 44;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 44) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minX(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 8;
    const limit = start + count * 44;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxX(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 8;
    const limit = start + count * 44;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
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
    return view.getFloat32(index * 44 + 12, littleEndian);
  }
  static setYAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 44 + 12, value, littleEndian);
  }
  static sumY(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 12;
    const limit = start + count * 44;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 44) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minY(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 12;
    const limit = start + count * 44;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxY(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 12;
    const limit = start + count * 44;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
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
    return view.getFloat32(index * 44 + 16, littleEndian);
  }
  static setZAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 44 + 16, value, littleEndian);
  }
  static sumZ(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 16;
    const limit = start + count * 44;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 44) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minZ(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 16;
    const limit = start + count * 44;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxZ(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 16;
    const limit = start + count * 44;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
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

  static getU0(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 20, littleEndian);
  }
  static setU0(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 20, value, littleEndian);
  }
  static getU0At(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 44 + 20, littleEndian);
  }
  static setU0At(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 44 + 20, value, littleEndian);
  }
  static sumU0(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 20;
    const limit = start + count * 44;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 44) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minU0(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 20;
    const limit = start + count * 44;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxU0(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 20;
    const limit = start + count * 44;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get u0(): number {
    return this.view.getFloat32(this.baseOffset + 20, this.littleEndian);
  }
  set u0(value: number) {
    this.view.setFloat32(this.baseOffset + 20, value, this.littleEndian);
  }

  static getV0(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 24, littleEndian);
  }
  static setV0(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 24, value, littleEndian);
  }
  static getV0At(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 44 + 24, littleEndian);
  }
  static setV0At(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 44 + 24, value, littleEndian);
  }
  static sumV0(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 24;
    const limit = start + count * 44;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 44) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minV0(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 24;
    const limit = start + count * 44;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxV0(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 24;
    const limit = start + count * 44;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get v0(): number {
    return this.view.getFloat32(this.baseOffset + 24, this.littleEndian);
  }
  set v0(value: number) {
    this.view.setFloat32(this.baseOffset + 24, value, this.littleEndian);
  }

  static getU1(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 28, littleEndian);
  }
  static setU1(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 28, value, littleEndian);
  }
  static getU1At(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 44 + 28, littleEndian);
  }
  static setU1At(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 44 + 28, value, littleEndian);
  }
  static sumU1(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 28, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 28;
    const limit = start + count * 44;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 44) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minU1(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 28, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 28;
    const limit = start + count * 44;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxU1(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 28, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 28;
    const limit = start + count * 44;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get u1(): number {
    return this.view.getFloat32(this.baseOffset + 28, this.littleEndian);
  }
  set u1(value: number) {
    this.view.setFloat32(this.baseOffset + 28, value, this.littleEndian);
  }

  static getV1(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 32, littleEndian);
  }
  static setV1(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 32, value, littleEndian);
  }
  static getV1At(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 44 + 32, littleEndian);
  }
  static setV1At(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 44 + 32, value, littleEndian);
  }
  static sumV1(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 32, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 32;
    const limit = start + count * 44;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 44) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }
  static minV1(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 32, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 32;
    const limit = start + count * 44;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getFloat32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxV1(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 32, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 32;
    const limit = start + count * 44;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getFloat32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }

  get v1(): number {
    return this.view.getFloat32(this.baseOffset + 32, this.littleEndian);
  }
  set v1(value: number) {
    this.view.setFloat32(this.baseOffset + 32, value, this.littleEndian);
  }

  static getColor(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 36, littleEndian);
  }
  static setColor(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 36, value, littleEndian);
  }
  static getColorAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 44 + 36, littleEndian);
  }
  static setColorAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 44 + 36, value, littleEndian);
  }
  static sumColor(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 36, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 36;
    const limit = start + count * 44;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 44) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minColor(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 36, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 36;
    const limit = start + count * 44;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxColor(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 36, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 36;
    const limit = start + count * 44;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 44) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countColorWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 36, 4);
    let matched = 0;
    const start = baseOffset + 36;
    const limit = start + count * 44;
    for (let offset = start; offset < limit; offset += 44) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstColorWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 36, 4);
    const start = baseOffset + 36;
    const limit = start + count * 44;
    let index = 0;
    for (let offset = start; offset < limit; offset += 44) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get color(): number {
    return this.view.getUint32(this.baseOffset + 36, this.littleEndian);
  }
  set color(value: number) {
    this.view.setUint32(this.baseOffset + 36, value, this.littleEndian);
  }

  static getVisible(view: DataView, baseOffset = 0, littleEndian = true): boolean {
    return view.getUint8(baseOffset + 40) !== 0;
  }
  static setVisible(view: DataView, value: boolean, baseOffset = 0, littleEndian = true): void {
    view.setUint8(baseOffset + 40, value ? 1 : 0);
  }
  static getVisibleAt(view: DataView, index: number, littleEndian = true): boolean {
    return view.getUint8(index * 44 + 40) !== 0;
  }
  static setVisibleAt(view: DataView, value: boolean, index: number, littleEndian = true): void {
    view.setUint8(index * 44 + 40, value ? 1 : 0);
  }
  static countVisibleWhereEq(view: DataView, count: number, expected: boolean, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 40, 1);
    let matched = 0;
    const start = baseOffset + 40;
    const limit = start + count * 44;
    for (let offset = start; offset < limit; offset += 44) {
      if (view.getUint8(offset) !== 0 === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstVisibleWhereEq(view: DataView, count: number, expected: boolean, baseOffset = 0, littleEndian = true): number {
    SpriteInstanceView.assertScanRange(view, count, baseOffset, 40, 1);
    const start = baseOffset + 40;
    const limit = start + count * 44;
    let index = 0;
    for (let offset = start; offset < limit; offset += 44) {
      if (view.getUint8(offset) !== 0 === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get visible(): boolean {
    return this.view.getUint8(this.baseOffset + 40) !== 0;
  }
  set visible(value: boolean) {
    this.view.setUint8(this.baseOffset + 40, value ? 1 : 0);
  }

}
