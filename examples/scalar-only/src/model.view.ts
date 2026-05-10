import { ProjectionView } from "@exornea/zeno-runtime";

export interface InstanceViewInput {
  readonly entityId: number;
  readonly kind: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly health: number;
  readonly flags: number;
  readonly active: boolean;
}

export const InstanceViewByteLength = 32;
export const InstanceViewAlignment = 4;
export const InstanceViewEntityIdOffset = 0;
export const InstanceViewKindOffset = 4;
export const InstanceViewXOffset = 8;
export const InstanceViewYOffset = 12;
export const InstanceViewZOffset = 16;
export const InstanceViewHealthOffset = 20;
export const InstanceViewFlagsOffset = 24;
export const InstanceViewActiveOffset = 28;

export class InstanceView extends ProjectionView {
  static readonly byteLength = 32;
  static readonly alignment = 4;
  static readonly entityIdOffset = 0;
  static readonly kindOffset = 4;
  static readonly xOffset = 8;
  static readonly yOffset = 12;
  static readonly zOffset = 16;
  static readonly healthOffset = 20;
  static readonly flagsOffset = 24;
  static readonly activeOffset = 28;

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
    return this.rebaseUnchecked(index * 32);
  }

  static write(view: DataView, value: InstanceViewInput, baseOffset = 0, littleEndian = true): void {
    InstanceView.setEntityId(view, value.entityId, baseOffset, littleEndian);
    InstanceView.setKind(view, value.kind, baseOffset, littleEndian);
    InstanceView.setX(view, value.x, baseOffset, littleEndian);
    InstanceView.setY(view, value.y, baseOffset, littleEndian);
    InstanceView.setZ(view, value.z, baseOffset, littleEndian);
    InstanceView.setHealth(view, value.health, baseOffset, littleEndian);
    InstanceView.setFlags(view, value.flags, baseOffset, littleEndian);
    InstanceView.setActive(view, value.active, baseOffset, littleEndian);
  }

  static getEntityId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 0, littleEndian);
  }
  static setEntityId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 0, value, littleEndian);
  }
  static getEntityIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 32 + 0, littleEndian);
  }
  static setEntityIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 32 + 0, value, littleEndian);
  }
  static sumEntityId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 0;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minEntityId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 32;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxEntityId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 32;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countEntityIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 0, 4);
    let matched = 0;
    const start = baseOffset + 0;
    const limit = start + count * 32;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstEntityIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 0, 4);
    const start = baseOffset + 0;
    const limit = start + count * 32;
    let index = 0;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get entityId(): number {
    return this.view.getUint32(this.baseOffset + 0, this.littleEndian);
  }
  set entityId(value: number) {
    this.view.setUint32(this.baseOffset + 0, value, this.littleEndian);
  }

  static getKind(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 4, littleEndian);
  }
  static setKind(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 4, value, littleEndian);
  }
  static getKindAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 32 + 4, littleEndian);
  }
  static setKindAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 32 + 4, value, littleEndian);
  }
  static sumKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 4;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 32;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 32;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countKindWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 4, 2);
    let matched = 0;
    const start = baseOffset + 4;
    const limit = start + count * 32;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstKindWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 4, 2);
    const start = baseOffset + 4;
    const limit = start + count * 32;
    let index = 0;
    for (let offset = start; offset < limit; offset += 32) {
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

  static getX(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 8, littleEndian);
  }
  static setX(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 8, value, littleEndian);
  }
  static getXAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 32 + 8, littleEndian);
  }
  static setXAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 32 + 8, value, littleEndian);
  }
  static sumX(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 8;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
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
    const limit = start + count * 32;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
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
    const limit = start + count * 32;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
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
    return view.getFloat32(index * 32 + 12, littleEndian);
  }
  static setYAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 32 + 12, value, littleEndian);
  }
  static sumY(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 12;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
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
    const limit = start + count * 32;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
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
    const limit = start + count * 32;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
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
    return view.getFloat32(index * 32 + 16, littleEndian);
  }
  static setZAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 32 + 16, value, littleEndian);
  }
  static sumZ(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 16;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
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
    const limit = start + count * 32;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
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
    const limit = start + count * 32;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
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

  static getHealth(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getInt32(baseOffset + 20, littleEndian);
  }
  static setHealth(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setInt32(baseOffset + 20, value, littleEndian);
  }
  static getHealthAt(view: DataView, index: number, littleEndian = true): number {
    return view.getInt32(index * 32 + 20, littleEndian);
  }
  static setHealthAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setInt32(index * 32 + 20, value, littleEndian);
  }
  static sumHealth(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 20;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
      sum += view.getInt32(offset, littleEndian);
    }
    return sum;
  }
  static minHealth(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 20;
    const limit = start + count * 32;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
      const value = view.getInt32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxHealth(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 20;
    const limit = start + count * 32;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
      const value = view.getInt32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countHealthWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 20, 4);
    let matched = 0;
    const start = baseOffset + 20;
    const limit = start + count * 32;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getInt32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstHealthWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 20, 4);
    const start = baseOffset + 20;
    const limit = start + count * 32;
    let index = 0;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getInt32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get health(): number {
    return this.view.getInt32(this.baseOffset + 20, this.littleEndian);
  }
  set health(value: number) {
    this.view.setInt32(this.baseOffset + 20, value, this.littleEndian);
  }

  static getFlags(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 24, littleEndian);
  }
  static setFlags(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 24, value, littleEndian);
  }
  static getFlagsAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 32 + 24, littleEndian);
  }
  static setFlagsAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 32 + 24, value, littleEndian);
  }
  static sumFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 24;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 24;
    const limit = start + count * 32;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 24;
    const limit = start + count * 32;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 32) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    let matched = 0;
    const start = baseOffset + 24;
    const limit = start + count * 32;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 24, 4);
    const start = baseOffset + 24;
    const limit = start + count * 32;
    let index = 0;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get flags(): number {
    return this.view.getUint32(this.baseOffset + 24, this.littleEndian);
  }
  set flags(value: number) {
    this.view.setUint32(this.baseOffset + 24, value, this.littleEndian);
  }

  static getActive(view: DataView, baseOffset = 0, littleEndian = true): boolean {
    return view.getUint8(baseOffset + 28) !== 0;
  }
  static setActive(view: DataView, value: boolean, baseOffset = 0, littleEndian = true): void {
    view.setUint8(baseOffset + 28, value ? 1 : 0);
  }
  static getActiveAt(view: DataView, index: number, littleEndian = true): boolean {
    return view.getUint8(index * 32 + 28) !== 0;
  }
  static setActiveAt(view: DataView, value: boolean, index: number, littleEndian = true): void {
    view.setUint8(index * 32 + 28, value ? 1 : 0);
  }
  static countActiveWhereEq(view: DataView, count: number, expected: boolean, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 28, 1);
    let matched = 0;
    const start = baseOffset + 28;
    const limit = start + count * 32;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint8(offset) !== 0 === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstActiveWhereEq(view: DataView, count: number, expected: boolean, baseOffset = 0, littleEndian = true): number {
    InstanceView.assertScanRange(view, count, baseOffset, 28, 1);
    const start = baseOffset + 28;
    const limit = start + count * 32;
    let index = 0;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint8(offset) !== 0 === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get active(): boolean {
    return this.view.getUint8(this.baseOffset + 28) !== 0;
  }
  set active(value: boolean) {
    this.view.setUint8(this.baseOffset + 28, value ? 1 : 0);
  }

}
