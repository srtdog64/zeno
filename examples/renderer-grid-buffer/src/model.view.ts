import { ProjectionView } from "@exornea/zeno-runtime";

export interface DungeonCellViewInput {
  readonly tileId: number;
  readonly glyphId: number;
  readonly flags: number;
  readonly light: number;
  readonly seen: boolean;
}

export const DungeonCellViewByteLength = 12;
export const DungeonCellViewAlignment = 4;
export const DungeonCellViewTileIdOffset = 0;
export const DungeonCellViewGlyphIdOffset = 2;
export const DungeonCellViewFlagsOffset = 4;
export const DungeonCellViewLightOffset = 8;
export const DungeonCellViewSeenOffset = 9;

export class DungeonCellView extends ProjectionView {
  static readonly byteLength = 12;
  static readonly alignment = 4;
  static readonly tileIdOffset = 0;
  static readonly glyphIdOffset = 2;
  static readonly flagsOffset = 4;
  static readonly lightOffset = 8;
  static readonly seenOffset = 9;

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

    const requiredByteLength = count * 12;
    if (!Number.isSafeInteger(requiredByteLength)) {
      throw new RangeError(`record range byte length exceeds safe integer: count=${count}, byteLength=12`);
    }
    if (requiredByteLength > view.byteLength - baseOffset) {
      throw new RangeError(`record range exceeds DataView length ${view.byteLength}: baseOffset=${baseOffset}, count=${count}, byteLength=12`);
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
    const lastByte = baseOffset + fieldOffset + (count - 1) * DungeonCellView.byteLength + fieldByteLength;
    if (lastByte > view.byteLength) {
      throw new RangeError(`scan range exceeds DataView length ${view.byteLength}`);
    }
  }

  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  static at(view: DataView, baseOffset = 0, littleEndian = true): DungeonCellView {
    return new DungeonCellView(view, baseOffset, littleEndian);
  }

  moveTo(index: number): this {
    return this.moveToIndex(index, DungeonCellView.byteLength);
  }

  moveToUnchecked(index: number): this {
    return this.rebaseUnchecked(index * 12);
  }

  static write(view: DataView, value: DungeonCellViewInput, baseOffset = 0, littleEndian = true): void {
    DungeonCellView.setTileId(view, value.tileId, baseOffset, littleEndian);
    DungeonCellView.setGlyphId(view, value.glyphId, baseOffset, littleEndian);
    DungeonCellView.setFlags(view, value.flags, baseOffset, littleEndian);
    DungeonCellView.setLight(view, value.light, baseOffset, littleEndian);
    DungeonCellView.setSeen(view, value.seen, baseOffset, littleEndian);
  }

  static getTileId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 0, littleEndian);
  }
  static setTileId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 0, value, littleEndian);
  }
  static getTileIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 12 + 0, littleEndian);
  }
  static setTileIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 12 + 0, value, littleEndian);
  }
  static sumTileId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 0, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 0;
    const limit = start + count * 12;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 12) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minTileId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 0, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 12;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 12) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxTileId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 0, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 12;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 12) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countTileIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 0, 2);
    let matched = 0;
    const start = baseOffset + 0;
    const limit = start + count * 12;
    for (let offset = start; offset < limit; offset += 12) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstTileIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 0, 2);
    const start = baseOffset + 0;
    const limit = start + count * 12;
    let index = 0;
    for (let offset = start; offset < limit; offset += 12) {
      if (view.getUint16(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get tileId(): number {
    return this.view.getUint16(this.baseOffset + 0, this.littleEndian);
  }
  set tileId(value: number) {
    this.view.setUint16(this.baseOffset + 0, value, this.littleEndian);
  }

  static getGlyphId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 2, littleEndian);
  }
  static setGlyphId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 2, value, littleEndian);
  }
  static getGlyphIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 12 + 2, littleEndian);
  }
  static setGlyphIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 12 + 2, value, littleEndian);
  }
  static sumGlyphId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 2, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 2;
    const limit = start + count * 12;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 12) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minGlyphId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 2, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 2;
    const limit = start + count * 12;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 12) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxGlyphId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 2, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 2;
    const limit = start + count * 12;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 12) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countGlyphIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 2, 2);
    let matched = 0;
    const start = baseOffset + 2;
    const limit = start + count * 12;
    for (let offset = start; offset < limit; offset += 12) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstGlyphIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 2, 2);
    const start = baseOffset + 2;
    const limit = start + count * 12;
    let index = 0;
    for (let offset = start; offset < limit; offset += 12) {
      if (view.getUint16(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get glyphId(): number {
    return this.view.getUint16(this.baseOffset + 2, this.littleEndian);
  }
  set glyphId(value: number) {
    this.view.setUint16(this.baseOffset + 2, value, this.littleEndian);
  }

  static getFlags(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 4, littleEndian);
  }
  static setFlags(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 4, value, littleEndian);
  }
  static getFlagsAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 12 + 4, littleEndian);
  }
  static setFlagsAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 12 + 4, value, littleEndian);
  }
  static sumFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 4;
    const limit = start + count * 12;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 12) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 12;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 12) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 12;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 12) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 4, 4);
    let matched = 0;
    const start = baseOffset + 4;
    const limit = start + count * 12;
    for (let offset = start; offset < limit; offset += 12) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 4, 4);
    const start = baseOffset + 4;
    const limit = start + count * 12;
    let index = 0;
    for (let offset = start; offset < limit; offset += 12) {
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

  static getLight(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint8(baseOffset + 8);
  }
  static setLight(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint8(baseOffset + 8, value);
  }
  static getLightAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint8(index * 12 + 8);
  }
  static setLightAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint8(index * 12 + 8, value);
  }
  static sumLight(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 8, 1);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 8;
    const limit = start + count * 12;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 12) {
      sum += view.getUint8(offset);
    }
    return sum;
  }
  static minLight(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 8, 1);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 8;
    const limit = start + count * 12;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 12) {
      const value = view.getUint8(offset);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxLight(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 8, 1);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 8;
    const limit = start + count * 12;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 12) {
      const value = view.getUint8(offset);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countLightWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 8, 1);
    let matched = 0;
    const start = baseOffset + 8;
    const limit = start + count * 12;
    for (let offset = start; offset < limit; offset += 12) {
      if (view.getUint8(offset) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstLightWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 8, 1);
    const start = baseOffset + 8;
    const limit = start + count * 12;
    let index = 0;
    for (let offset = start; offset < limit; offset += 12) {
      if (view.getUint8(offset) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get light(): number {
    return this.view.getUint8(this.baseOffset + 8);
  }
  set light(value: number) {
    this.view.setUint8(this.baseOffset + 8, value);
  }

  static getSeen(view: DataView, baseOffset = 0, littleEndian = true): boolean {
    return view.getUint8(baseOffset + 9) !== 0;
  }
  static setSeen(view: DataView, value: boolean, baseOffset = 0, littleEndian = true): void {
    view.setUint8(baseOffset + 9, value ? 1 : 0);
  }
  static getSeenAt(view: DataView, index: number, littleEndian = true): boolean {
    return view.getUint8(index * 12 + 9) !== 0;
  }
  static setSeenAt(view: DataView, value: boolean, index: number, littleEndian = true): void {
    view.setUint8(index * 12 + 9, value ? 1 : 0);
  }
  static countSeenWhereEq(view: DataView, count: number, expected: boolean, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 9, 1);
    let matched = 0;
    const start = baseOffset + 9;
    const limit = start + count * 12;
    for (let offset = start; offset < limit; offset += 12) {
      if (view.getUint8(offset) !== 0 === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstSeenWhereEq(view: DataView, count: number, expected: boolean, baseOffset = 0, littleEndian = true): number {
    DungeonCellView.assertScanRange(view, count, baseOffset, 9, 1);
    const start = baseOffset + 9;
    const limit = start + count * 12;
    let index = 0;
    for (let offset = start; offset < limit; offset += 12) {
      if (view.getUint8(offset) !== 0 === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get seen(): boolean {
    return this.view.getUint8(this.baseOffset + 9) !== 0;
  }
  set seen(value: boolean) {
    this.view.setUint8(this.baseOffset + 9, value ? 1 : 0);
  }

}

export interface VisibleEntityViewInput {
  readonly id: number;
  readonly kind: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly glyphId: number;
  readonly flags: number;
}

export const VisibleEntityViewByteLength = 28;
export const VisibleEntityViewAlignment = 4;
export const VisibleEntityViewIdOffset = 0;
export const VisibleEntityViewKindOffset = 4;
export const VisibleEntityViewXOffset = 8;
export const VisibleEntityViewYOffset = 12;
export const VisibleEntityViewZOffset = 16;
export const VisibleEntityViewGlyphIdOffset = 20;
export const VisibleEntityViewFlagsOffset = 24;

export class VisibleEntityView extends ProjectionView {
  static readonly byteLength = 28;
  static readonly alignment = 4;
  static readonly idOffset = 0;
  static readonly kindOffset = 4;
  static readonly xOffset = 8;
  static readonly yOffset = 12;
  static readonly zOffset = 16;
  static readonly glyphIdOffset = 20;
  static readonly flagsOffset = 24;

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

    const requiredByteLength = count * 28;
    if (!Number.isSafeInteger(requiredByteLength)) {
      throw new RangeError(`record range byte length exceeds safe integer: count=${count}, byteLength=28`);
    }
    if (requiredByteLength > view.byteLength - baseOffset) {
      throw new RangeError(`record range exceeds DataView length ${view.byteLength}: baseOffset=${baseOffset}, count=${count}, byteLength=28`);
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
    const lastByte = baseOffset + fieldOffset + (count - 1) * VisibleEntityView.byteLength + fieldByteLength;
    if (lastByte > view.byteLength) {
      throw new RangeError(`scan range exceeds DataView length ${view.byteLength}`);
    }
  }

  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  static at(view: DataView, baseOffset = 0, littleEndian = true): VisibleEntityView {
    return new VisibleEntityView(view, baseOffset, littleEndian);
  }

  moveTo(index: number): this {
    return this.moveToIndex(index, VisibleEntityView.byteLength);
  }

  moveToUnchecked(index: number): this {
    return this.rebaseUnchecked(index * 28);
  }

  static write(view: DataView, value: VisibleEntityViewInput, baseOffset = 0, littleEndian = true): void {
    VisibleEntityView.setId(view, value.id, baseOffset, littleEndian);
    VisibleEntityView.setKind(view, value.kind, baseOffset, littleEndian);
    VisibleEntityView.setX(view, value.x, baseOffset, littleEndian);
    VisibleEntityView.setY(view, value.y, baseOffset, littleEndian);
    VisibleEntityView.setZ(view, value.z, baseOffset, littleEndian);
    VisibleEntityView.setGlyphId(view, value.glyphId, baseOffset, littleEndian);
    VisibleEntityView.setFlags(view, value.flags, baseOffset, littleEndian);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 0, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 0, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 0, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 0, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 0, 4);
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

  static getKind(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 4, littleEndian);
  }
  static setKind(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 4, value, littleEndian);
  }
  static getKindAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 28 + 4, littleEndian);
  }
  static setKindAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 28 + 4, value, littleEndian);
  }
  static sumKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 4, 2);
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
  static minKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 4, 2);
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
  static maxKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 4, 2);
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
  static countKindWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 4, 2);
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
  static findFirstKindWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 4, 2);
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
    return view.getFloat32(index * 28 + 8, littleEndian);
  }
  static setXAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 28 + 8, value, littleEndian);
  }
  static sumX(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 8, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 8, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 8, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 12, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 12, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 12, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 16, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 16, 4);
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
    VisibleEntityView.assertScanRange(view, count, baseOffset, 16, 4);
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

  static getGlyphId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 20, littleEndian);
  }
  static setGlyphId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 20, value, littleEndian);
  }
  static getGlyphIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 28 + 20, littleEndian);
  }
  static setGlyphIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 28 + 20, value, littleEndian);
  }
  static sumGlyphId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 20, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 20;
    const limit = start + count * 28;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 28) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minGlyphId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 20, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 20;
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
  static maxGlyphId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 20, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 20;
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
  static countGlyphIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 20, 2);
    let matched = 0;
    const start = baseOffset + 20;
    const limit = start + count * 28;
    for (let offset = start; offset < limit; offset += 28) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstGlyphIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 20, 2);
    const start = baseOffset + 20;
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

  get glyphId(): number {
    return this.view.getUint16(this.baseOffset + 20, this.littleEndian);
  }
  set glyphId(value: number) {
    this.view.setUint16(this.baseOffset + 20, value, this.littleEndian);
  }

  static getFlags(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 24, littleEndian);
  }
  static setFlags(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 24, value, littleEndian);
  }
  static getFlagsAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 28 + 24, littleEndian);
  }
  static setFlagsAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 28 + 24, value, littleEndian);
  }
  static sumFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 24, 4);
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
  static minFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 24, 4);
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
  static maxFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 24, 4);
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
  static countFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 24, 4);
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
  static findFirstFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    VisibleEntityView.assertScanRange(view, count, baseOffset, 24, 4);
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

  get flags(): number {
    return this.view.getUint32(this.baseOffset + 24, this.littleEndian);
  }
  set flags(value: number) {
    this.view.setUint32(this.baseOffset + 24, value, this.littleEndian);
  }

}

export interface DirtyRangeViewInput {
  readonly start: number;
  readonly count: number;
}

export const DirtyRangeViewByteLength = 8;
export const DirtyRangeViewAlignment = 4;
export const DirtyRangeViewStartOffset = 0;
export const DirtyRangeViewCountOffset = 4;

export class DirtyRangeView extends ProjectionView {
  static readonly byteLength = 8;
  static readonly alignment = 4;
  static readonly startOffset = 0;
  static readonly countOffset = 4;

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

    const requiredByteLength = count * 8;
    if (!Number.isSafeInteger(requiredByteLength)) {
      throw new RangeError(`record range byte length exceeds safe integer: count=${count}, byteLength=8`);
    }
    if (requiredByteLength > view.byteLength - baseOffset) {
      throw new RangeError(`record range exceeds DataView length ${view.byteLength}: baseOffset=${baseOffset}, count=${count}, byteLength=8`);
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
    const lastByte = baseOffset + fieldOffset + (count - 1) * DirtyRangeView.byteLength + fieldByteLength;
    if (lastByte > view.byteLength) {
      throw new RangeError(`scan range exceeds DataView length ${view.byteLength}`);
    }
  }

  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  static at(view: DataView, baseOffset = 0, littleEndian = true): DirtyRangeView {
    return new DirtyRangeView(view, baseOffset, littleEndian);
  }

  moveTo(index: number): this {
    return this.moveToIndex(index, DirtyRangeView.byteLength);
  }

  moveToUnchecked(index: number): this {
    return this.rebaseUnchecked(index * 8);
  }

  static write(view: DataView, value: DirtyRangeViewInput, baseOffset = 0, littleEndian = true): void {
    DirtyRangeView.setStart(view, value.start, baseOffset, littleEndian);
    DirtyRangeView.setCount(view, value.count, baseOffset, littleEndian);
  }

  static getStart(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 0, littleEndian);
  }
  static setStart(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 0, value, littleEndian);
  }
  static getStartAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 8 + 0, littleEndian);
  }
  static setStartAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 8 + 0, value, littleEndian);
  }
  static sumStart(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DirtyRangeView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 0;
    const limit = start + count * 8;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 8) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minStart(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DirtyRangeView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 8;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 8) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxStart(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DirtyRangeView.assertScanRange(view, count, baseOffset, 0, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 8;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 8) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countStartWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DirtyRangeView.assertScanRange(view, count, baseOffset, 0, 4);
    let matched = 0;
    const start = baseOffset + 0;
    const limit = start + count * 8;
    for (let offset = start; offset < limit; offset += 8) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstStartWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DirtyRangeView.assertScanRange(view, count, baseOffset, 0, 4);
    const start = baseOffset + 0;
    const limit = start + count * 8;
    let index = 0;
    for (let offset = start; offset < limit; offset += 8) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get start(): number {
    return this.view.getUint32(this.baseOffset + 0, this.littleEndian);
  }
  set start(value: number) {
    this.view.setUint32(this.baseOffset + 0, value, this.littleEndian);
  }

  static getCount(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 4, littleEndian);
  }
  static setCount(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 4, value, littleEndian);
  }
  static getCountAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 8 + 4, littleEndian);
  }
  static setCountAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 8 + 4, value, littleEndian);
  }
  static sumCount(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DirtyRangeView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 4;
    const limit = start + count * 8;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 8) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minCount(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DirtyRangeView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 8;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 8) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxCount(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DirtyRangeView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 8;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 8) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countCountWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DirtyRangeView.assertScanRange(view, count, baseOffset, 4, 4);
    let matched = 0;
    const start = baseOffset + 4;
    const limit = start + count * 8;
    for (let offset = start; offset < limit; offset += 8) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstCountWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DirtyRangeView.assertScanRange(view, count, baseOffset, 4, 4);
    const start = baseOffset + 4;
    const limit = start + count * 8;
    let index = 0;
    for (let offset = start; offset < limit; offset += 8) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get count(): number {
    return this.view.getUint32(this.baseOffset + 4, this.littleEndian);
  }
  set count(value: number) {
    this.view.setUint32(this.baseOffset + 4, value, this.littleEndian);
  }

}
