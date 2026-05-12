import { ProjectionView } from "@exornea/zeno-runtime";

export interface AssetRowViewInput {
  readonly projectId: number;
  readonly kind: number;
  readonly extension: number;
  readonly pathHash: number;
  readonly byteLength: number;
  readonly depth: number;
  readonly flags: number;
}

export const AssetRowViewByteLength = 24;
export const AssetRowViewAlignment = 4;
export const AssetRowViewProjectIdOffset = 0;
export const AssetRowViewKindOffset = 2;
export const AssetRowViewExtensionOffset = 4;
export const AssetRowViewPathHashOffset = 8;
export const AssetRowViewByteLengthOffset = 12;
export const AssetRowViewDepthOffset = 16;
export const AssetRowViewFlagsOffset = 20;

export class AssetRowView extends ProjectionView {
  static readonly byteLength = 24;
  static readonly alignment = 4;
  static readonly projectIdOffset = 0;
  static readonly kindOffset = 2;
  static readonly extensionOffset = 4;
  static readonly pathHashOffset = 8;
  static readonly byteLengthOffset = 12;
  static readonly depthOffset = 16;
  static readonly flagsOffset = 20;

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

    const requiredByteLength = count * 24;
    if (!Number.isSafeInteger(requiredByteLength)) {
      throw new RangeError(`record range byte length exceeds safe integer: count=${count}, byteLength=24`);
    }
    if (requiredByteLength > view.byteLength - baseOffset) {
      throw new RangeError(`record range exceeds DataView length ${view.byteLength}: baseOffset=${baseOffset}, count=${count}, byteLength=24`);
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
    const lastByte = baseOffset + fieldOffset + (count - 1) * AssetRowView.byteLength + fieldByteLength;
    if (lastByte > view.byteLength) {
      throw new RangeError(`scan range exceeds DataView length ${view.byteLength}`);
    }
  }

  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  static at(view: DataView, baseOffset = 0, littleEndian = true): AssetRowView {
    return new AssetRowView(view, baseOffset, littleEndian);
  }

  moveTo(index: number): this {
    return this.moveToIndex(index, AssetRowView.byteLength);
  }

  moveToUnchecked(index: number): this {
    return this.rebaseUnchecked(index * 24);
  }

  static write(view: DataView, value: AssetRowViewInput, baseOffset = 0, littleEndian = true): void {
    AssetRowView.setProjectId(view, value.projectId, baseOffset, littleEndian);
    AssetRowView.setKind(view, value.kind, baseOffset, littleEndian);
    AssetRowView.setExtension(view, value.extension, baseOffset, littleEndian);
    AssetRowView.setPathHash(view, value.pathHash, baseOffset, littleEndian);
    AssetRowView.setByteLength(view, value.byteLength, baseOffset, littleEndian);
    AssetRowView.setDepth(view, value.depth, baseOffset, littleEndian);
    AssetRowView.setFlags(view, value.flags, baseOffset, littleEndian);
  }

  static getProjectId(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 0, littleEndian);
  }
  static setProjectId(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 0, value, littleEndian);
  }
  static getProjectIdAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 24 + 0, littleEndian);
  }
  static setProjectIdAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 24 + 0, value, littleEndian);
  }
  static sumProjectId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 0, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 0;
    const limit = start + count * 24;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 24) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minProjectId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 0, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 24;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxProjectId(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 0, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 0;
    const limit = start + count * 24;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countProjectIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 0, 2);
    let matched = 0;
    const start = baseOffset + 0;
    const limit = start + count * 24;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstProjectIdWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 0, 2);
    const start = baseOffset + 0;
    const limit = start + count * 24;
    let index = 0;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint16(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get projectId(): number {
    return this.view.getUint16(this.baseOffset + 0, this.littleEndian);
  }
  set projectId(value: number) {
    this.view.setUint16(this.baseOffset + 0, value, this.littleEndian);
  }

  static getKind(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 2, littleEndian);
  }
  static setKind(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 2, value, littleEndian);
  }
  static getKindAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 24 + 2, littleEndian);
  }
  static setKindAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 24 + 2, value, littleEndian);
  }
  static sumKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 2, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 2;
    const limit = start + count * 24;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 24) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 2, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 2;
    const limit = start + count * 24;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxKind(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 2, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 2;
    const limit = start + count * 24;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countKindWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 2, 2);
    let matched = 0;
    const start = baseOffset + 2;
    const limit = start + count * 24;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstKindWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 2, 2);
    const start = baseOffset + 2;
    const limit = start + count * 24;
    let index = 0;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint16(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get kind(): number {
    return this.view.getUint16(this.baseOffset + 2, this.littleEndian);
  }
  set kind(value: number) {
    this.view.setUint16(this.baseOffset + 2, value, this.littleEndian);
  }

  static getExtension(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 4, littleEndian);
  }
  static setExtension(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 4, value, littleEndian);
  }
  static getExtensionAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 24 + 4, littleEndian);
  }
  static setExtensionAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 24 + 4, value, littleEndian);
  }
  static sumExtension(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 4;
    const limit = start + count * 24;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 24) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minExtension(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 24;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxExtension(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 4, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 4;
    const limit = start + count * 24;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countExtensionWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 4, 2);
    let matched = 0;
    const start = baseOffset + 4;
    const limit = start + count * 24;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstExtensionWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 4, 2);
    const start = baseOffset + 4;
    const limit = start + count * 24;
    let index = 0;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint16(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get extension(): number {
    return this.view.getUint16(this.baseOffset + 4, this.littleEndian);
  }
  set extension(value: number) {
    this.view.setUint16(this.baseOffset + 4, value, this.littleEndian);
  }

  static getPathHash(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 8, littleEndian);
  }
  static setPathHash(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 8, value, littleEndian);
  }
  static getPathHashAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 24 + 8, littleEndian);
  }
  static setPathHashAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 24 + 8, value, littleEndian);
  }
  static sumPathHash(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 8;
    const limit = start + count * 24;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 24) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minPathHash(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 8;
    const limit = start + count * 24;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxPathHash(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 8, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 8;
    const limit = start + count * 24;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countPathHashWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 8, 4);
    let matched = 0;
    const start = baseOffset + 8;
    const limit = start + count * 24;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstPathHashWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 8, 4);
    const start = baseOffset + 8;
    const limit = start + count * 24;
    let index = 0;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get pathHash(): number {
    return this.view.getUint32(this.baseOffset + 8, this.littleEndian);
  }
  set pathHash(value: number) {
    this.view.setUint32(this.baseOffset + 8, value, this.littleEndian);
  }

  static getByteLength(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 12, littleEndian);
  }
  static setByteLength(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 12, value, littleEndian);
  }
  static getByteLengthAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 24 + 12, littleEndian);
  }
  static setByteLengthAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 24 + 12, value, littleEndian);
  }
  static sumByteLength(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 12;
    const limit = start + count * 24;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 24) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minByteLength(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 12;
    const limit = start + count * 24;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxByteLength(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 12, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 12;
    const limit = start + count * 24;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countByteLengthWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 12, 4);
    let matched = 0;
    const start = baseOffset + 12;
    const limit = start + count * 24;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstByteLengthWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 12, 4);
    const start = baseOffset + 12;
    const limit = start + count * 24;
    let index = 0;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get byteLength(): number {
    return this.view.getUint32(this.baseOffset + 12, this.littleEndian);
  }
  set byteLength(value: number) {
    this.view.setUint32(this.baseOffset + 12, value, this.littleEndian);
  }

  static getDepth(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint16(baseOffset + 16, littleEndian);
  }
  static setDepth(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint16(baseOffset + 16, value, littleEndian);
  }
  static getDepthAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint16(index * 24 + 16, littleEndian);
  }
  static setDepthAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint16(index * 24 + 16, value, littleEndian);
  }
  static sumDepth(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 16, 2);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 16;
    const limit = start + count * 24;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 24) {
      sum += view.getUint16(offset, littleEndian);
    }
    return sum;
  }
  static minDepth(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 16, 2);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 16;
    const limit = start + count * 24;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint16(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxDepth(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 16, 2);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 16;
    const limit = start + count * 24;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint16(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countDepthWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 16, 2);
    let matched = 0;
    const start = baseOffset + 16;
    const limit = start + count * 24;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint16(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstDepthWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 16, 2);
    const start = baseOffset + 16;
    const limit = start + count * 24;
    let index = 0;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint16(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get depth(): number {
    return this.view.getUint16(this.baseOffset + 16, this.littleEndian);
  }
  set depth(value: number) {
    this.view.setUint16(this.baseOffset + 16, value, this.littleEndian);
  }

  static getFlags(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getUint32(baseOffset + 20, littleEndian);
  }
  static setFlags(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setUint32(baseOffset + 20, value, littleEndian);
  }
  static getFlagsAt(view: DataView, index: number, littleEndian = true): number {
    return view.getUint32(index * 24 + 20, littleEndian);
  }
  static setFlagsAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setUint32(index * 24 + 20, value, littleEndian);
  }
  static sumFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 20;
    const limit = start + count * 24;
    let sum = 0;
    for (let offset = start; offset < limit; offset += 24) {
      sum += view.getUint32(offset, littleEndian);
    }
    return sum;
  }
  static minFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.POSITIVE_INFINITY;
    }
    const start = baseOffset + 20;
    const limit = start + count * 24;
    let minimum = Number.POSITIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint32(offset, littleEndian);
      if (value < minimum) {
        minimum = value;
      }
    }
    return minimum;
  }
  static maxFlags(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 20, 4);
    if (count === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const start = baseOffset + 20;
    const limit = start + count * 24;
    let maximum = Number.NEGATIVE_INFINITY;
    for (let offset = start; offset < limit; offset += 24) {
      const value = view.getUint32(offset, littleEndian);
      if (value > maximum) {
        maximum = value;
      }
    }
    return maximum;
  }
  static countFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 20, 4);
    let matched = 0;
    const start = baseOffset + 20;
    const limit = start + count * 24;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint32(offset, littleEndian) === expected) {
        matched += 1;
      }
    }
    return matched;
  }
  static findFirstFlagsWhereEq(view: DataView, count: number, expected: number, baseOffset = 0, littleEndian = true): number {
    AssetRowView.assertScanRange(view, count, baseOffset, 20, 4);
    const start = baseOffset + 20;
    const limit = start + count * 24;
    let index = 0;
    for (let offset = start; offset < limit; offset += 24) {
      if (view.getUint32(offset, littleEndian) === expected) {
        return index;
      }
      index += 1;
    }
    return -1;
  }

  get flags(): number {
    return this.view.getUint32(this.baseOffset + 20, this.littleEndian);
  }
  set flags(value: number) {
    this.view.setUint32(this.baseOffset + 20, value, this.littleEndian);
  }

}
