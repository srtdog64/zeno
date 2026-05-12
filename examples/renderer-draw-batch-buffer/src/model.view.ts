import { ProjectionView } from "@exornea/zeno-runtime";

export interface DrawBatchViewInput {
  readonly meshId: number;
  readonly materialId: number;
  readonly pass: number;
  readonly flags: number;
  readonly firstIndex: number;
  readonly indexCount: number;
  readonly firstInstance: number;
  readonly instanceCount: number;
}

export const DrawBatchViewByteLength = 32;
export const DrawBatchViewAlignment = 4;
export const DrawBatchViewMeshIdOffset = 0;
export const DrawBatchViewMaterialIdOffset = 4;
export const DrawBatchViewPassOffset = 8;
export const DrawBatchViewFlagsOffset = 12;
export const DrawBatchViewFirstIndexOffset = 16;
export const DrawBatchViewIndexCountOffset = 20;
export const DrawBatchViewFirstInstanceOffset = 24;
export const DrawBatchViewInstanceCountOffset = 28;

export class DrawBatchView extends ProjectionView {
  static readonly byteLength = 32;
  static readonly alignment = 4;
  static readonly meshIdOffset = 0;
  static readonly materialIdOffset = 4;
  static readonly passOffset = 8;
  static readonly flagsOffset = 12;
  static readonly firstIndexOffset = 16;
  static readonly indexCountOffset = 20;
  static readonly firstInstanceOffset = 24;
  static readonly instanceCountOffset = 28;

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

    const requiredByteLength = count * 32;
    if (!Number.isSafeInteger(requiredByteLength)) {
      throw new RangeError(`record range byte length exceeds safe integer: count=${count}, byteLength=32`);
    }
    if (requiredByteLength > view.byteLength - baseOffset) {
      throw new RangeError(`record range exceeds DataView length ${view.byteLength}: baseOffset=${baseOffset}, count=${count}, byteLength=32`);
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
    const lastByte = baseOffset + fieldOffset + (count - 1) * DrawBatchView.byteLength + fieldByteLength;
    if (lastByte > view.byteLength) {
      throw new RangeError(`scan range exceeds DataView length ${view.byteLength}`);
    }
  }

  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  static at(view: DataView, baseOffset = 0, littleEndian = true): DrawBatchView {
    return new DrawBatchView(view, baseOffset, littleEndian);
  }

  moveTo(index: number): this {
    return this.moveToIndex(index, DrawBatchView.byteLength);
  }

  moveToUnchecked(index: number): this {
    return this.rebaseUnchecked(index * 32);
  }

  static write(view: DataView, value: DrawBatchViewInput, baseOffset = 0, littleEndian = true): void {
    DrawBatchView.setMeshId(view, value.meshId, baseOffset, littleEndian);
    DrawBatchView.setMaterialId(view, value.materialId, baseOffset, littleEndian);
    DrawBatchView.setPass(view, value.pass, baseOffset, littleEndian);
    DrawBatchView.setFlags(view, value.flags, baseOffset, littleEndian);
    DrawBatchView.setFirstIndex(view, value.firstIndex, baseOffset, littleEndian);
    DrawBatchView.setIndexCount(view, value.indexCount, baseOffset, littleEndian);
    DrawBatchView.setFirstInstance(view, value.firstInstance, baseOffset, littleEndian);
    DrawBatchView.setInstanceCount(view, value.instanceCount, baseOffset, littleEndian);
  }

  static getMeshId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 0, littleEndian);
  }
  static setMeshId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 0, value, littleEndian);
  }
  static getMeshIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 32 + 0, littleEndian);
  }
  static setMeshIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 32 + 0, value, littleEndian);
  }
  static sumMeshId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 0, 4);
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
  static minMeshId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 0, 4);
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
  static maxMeshId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 0, 4);
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
  static countMeshIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 0, 4);
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
  static findFirstMeshIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 0, 4);
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

  get meshId(): number {
    return this.view.getUint32(this.baseOffset + 0, this.littleEndian);
  }
  set meshId(value: number) {
    this.view.setUint32(this.baseOffset + 0, value, this.littleEndian);
  }

  static getMaterialId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 4, littleEndian);
  }
  static setMaterialId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 4, value, littleEndian);
  }
  static getMaterialIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 32 + 4, littleEndian);
  }
  static setMaterialIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 32 + 4, value, littleEndian);
  }
  static sumMaterialId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 4;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minMaterialId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 4;
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
  static maxMaterialId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 4, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 4;
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
  static countMaterialIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 4, 4);
    let matched = 0;
    const start = baseOffset + 4;
    const limit = start + count * 32;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstMaterialIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 4, 4);
    const start = baseOffset + 4;
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

  get materialId(): number {
    return this.view.getUint32(this.baseOffset + 4, this.littleEndian);
  }
  set materialId(value: number) {
    this.view.setUint32(this.baseOffset + 4, value, this.littleEndian);
  }

  static getPass(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 8, littleEndian);
  }
  static setPass(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 8, value, littleEndian);
  }
  static getPassAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 32 + 8, littleEndian);
  }
  static setPassAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 32 + 8, value, littleEndian);
  }
  static sumPass(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 8, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 8;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minPass(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 8, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 8;
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
  static maxPass(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 8, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 8;
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
  static countPassWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 8, 2);
    let matched = 0;
    const start = baseOffset + 8;
    const limit = start + count * 32;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstPassWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 8, 2);
    const start = baseOffset + 8;
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

  get pass(): number {
    return this.view.getUint16(this.baseOffset + 8, this.littleEndian);
  }
  set pass(value: number) {
    this.view.setUint16(this.baseOffset + 8, value, this.littleEndian);
  }

  static getFlags(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 12, littleEndian);
  }
  static setFlags(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 12, value, littleEndian);
  }
  static getFlagsAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 32 + 12, littleEndian);
  }
  static setFlagsAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 32 + 12, value, littleEndian);
  }
  static sumFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 12;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 12;
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
    DrawBatchView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 12;
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
    DrawBatchView.assertScanRange(view, count, baseOffset, 12, 4);
    let matched = 0;
    const start = baseOffset + 12;
    const limit = start + count * 32;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 12, 4);
    const start = baseOffset + 12;
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
    return this.view.getUint32(this.baseOffset + 12, this.littleEndian);
  }
  set flags(value: number) {
    this.view.setUint32(this.baseOffset + 12, value, this.littleEndian);
  }

  static getFirstIndex(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 16, littleEndian);
  }
  static setFirstIndex(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 16, value, littleEndian);
  }
  static getFirstIndexAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 32 + 16, littleEndian);
  }
  static setFirstIndexAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 32 + 16, value, littleEndian);
  }
  static sumFirstIndex(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 16;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minFirstIndex(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 16;
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
  static maxFirstIndex(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 16, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 16;
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
  static countFirstIndexWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 16, 4);
    let matched = 0;
    const start = baseOffset + 16;
    const limit = start + count * 32;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstFirstIndexWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 16, 4);
    const start = baseOffset + 16;
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

  get firstIndex(): number {
    return this.view.getUint32(this.baseOffset + 16, this.littleEndian);
  }
  set firstIndex(value: number) {
    this.view.setUint32(this.baseOffset + 16, value, this.littleEndian);
  }

  static getIndexCount(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 20, littleEndian);
  }
  static setIndexCount(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 20, value, littleEndian);
  }
  static getIndexCountAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 32 + 20, littleEndian);
  }
  static setIndexCountAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 32 + 20, value, littleEndian);
  }
  static sumIndexCount(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 20;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minIndexCount(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 20;
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
  static maxIndexCount(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 20;
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
  static countIndexCountWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 20, 4);
    let matched = 0;
    const start = baseOffset + 20;
    const limit = start + count * 32;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstIndexCountWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 20, 4);
    const start = baseOffset + 20;
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

  get indexCount(): number {
    return this.view.getUint32(this.baseOffset + 20, this.littleEndian);
  }
  set indexCount(value: number) {
    this.view.setUint32(this.baseOffset + 20, value, this.littleEndian);
  }

  static getFirstInstance(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 24, littleEndian);
  }
  static setFirstInstance(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 24, value, littleEndian);
  }
  static getFirstInstanceAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 32 + 24, littleEndian);
  }
  static setFirstInstanceAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 32 + 24, value, littleEndian);
  }
  static sumFirstInstance(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 24, 4);
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
  static minFirstInstance(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 24, 4);
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
  static maxFirstInstance(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 24, 4);
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
  static countFirstInstanceWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 24, 4);
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
  static findFirstFirstInstanceWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 24, 4);
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

  get firstInstance(): number {
    return this.view.getUint32(this.baseOffset + 24, this.littleEndian);
  }
  set firstInstance(value: number) {
    this.view.setUint32(this.baseOffset + 24, value, this.littleEndian);
  }

  static getInstanceCount(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 28, littleEndian);
  }
  static setInstanceCount(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 28, value, littleEndian);
  }
  static getInstanceCountAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 32 + 28, littleEndian);
  }
  static setInstanceCountAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 32 + 28, value, littleEndian);
  }
  static sumInstanceCount(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 28, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 28;
    const limit = start + count * 32;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 32) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minInstanceCount(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 28, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 28;
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
  static maxInstanceCount(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 28, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 28;
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
  static countInstanceCountWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 28, 4);
    let matched = 0;
    const start = baseOffset + 28;
    const limit = start + count * 32;
    for (let offset = start; offset < limit; offset += 32) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstInstanceCountWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    DrawBatchView.assertScanRange(view, count, baseOffset, 28, 4);
    const start = baseOffset + 28;
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

  get instanceCount(): number {
    return this.view.getUint32(this.baseOffset + 28, this.littleEndian);
  }
  set instanceCount(value: number) {
    this.view.setUint32(this.baseOffset + 28, value, this.littleEndian);
  }

}
