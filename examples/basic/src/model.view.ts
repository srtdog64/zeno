import { BytesSpanView, DynamicLayoutWriter, ProjectionView, Utf8SpanView, Utf8VectorView, decodeFixedText, fixedBytesView, writeFixedText } from "@exornea/zeno-runtime";

export interface UserViewInput {
  readonly id: bigint;
  readonly age: number;
  readonly score: number;
  readonly ratio: number;
  readonly handle: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly avatar: ArrayLike<number> | Uint8Array;
}

export const UserViewByteLength = 88;
export const UserViewAlignment = 8;
export const UserViewIdOffset = 0;
export const UserViewAgeOffset = 8;
export const UserViewScoreOffset = 16;
export const UserViewRatioOffset = 24;
export const UserViewHandleOffset = 28;
export const UserViewNameOffset = 60;
export const UserViewTagsOffset = 68;
export const UserViewAvatarOffset = 76;

export class UserView extends ProjectionView {
  static readonly byteLength = 88;
  static readonly alignment = 8;
  static readonly idOffset = 0;
  static readonly ageOffset = 8;
  static readonly scoreOffset = 16;
  static readonly ratioOffset = 24;
  static readonly handleOffset = 28;
  static readonly nameOffset = 60;
  static readonly tagsOffset = 68;
  static readonly avatarOffset = 76;

  constructor(view: DataView, baseOffset = 0, littleEndian = true) {
    super(view, baseOffset, littleEndian);
  }

  static at(view: DataView, baseOffset = 0, littleEndian = true): UserView {
    return new UserView(view, baseOffset, littleEndian);
  }

  moveTo(index: number): this {
    return this.moveToIndex(index, UserView.byteLength);
  }

  moveToUnchecked(index: number): this {
    return this.rebaseUnchecked(index * 88);
  }

  static createWriter(view: DataView, baseOffset = 0, tailOffset = UserView.byteLength, littleEndian = true): DynamicLayoutWriter {
    return new DynamicLayoutWriter(view, tailOffset, baseOffset, littleEndian);
  }

  static writeName(writer: DynamicLayoutWriter, value: string) {
    return writer.writeText(UserView.nameOffset, value, "utf8");
  }

  static writeTags(writer: DynamicLayoutWriter, values: readonly string[]) {
    return writer.writeTextVector(UserView.tagsOffset, values, "utf8");
  }

  static writeAvatar(writer: DynamicLayoutWriter, value: ArrayLike<number> | Uint8Array) {
    return writer.writeBytes(UserView.avatarOffset, value);
  }

  static write(view: DataView, value: UserViewInput, baseOffset = 0, littleEndian = true): DynamicLayoutWriter {
    const writer = UserView.createWriter(view, baseOffset, UserView.byteLength, littleEndian);
    UserView.writeInto(view, writer, value, baseOffset, littleEndian);
    return writer;
  }

  static writeInto(view: DataView, writer: DynamicLayoutWriter, value: UserViewInput, baseOffset = 0, littleEndian = true): void {
    UserView.setId(view, value.id, baseOffset, littleEndian);
    UserView.setAge(view, value.age, baseOffset, littleEndian);
    UserView.setScore(view, value.score, baseOffset, littleEndian);
    UserView.setRatio(view, value.ratio, baseOffset, littleEndian);
    writeFixedText(view.buffer, view.byteOffset + baseOffset + 28, 32, value.handle, "utf8");
    writer.writeTextAtBase(baseOffset, UserView.nameOffset, value.name, "utf8");
    writer.writeTextVectorAtBase(baseOffset, UserView.tagsOffset, value.tags, "utf8");
    writer.writeBytesAtBase(baseOffset, UserView.avatarOffset, value.avatar);
  }

  static getId(view: DataView, baseOffset = 0, littleEndian = true): bigint {
    return view.getBigUint64(baseOffset + 0, littleEndian);
  }
  static setId(view: DataView, value: bigint, baseOffset = 0, littleEndian = true): void {
    view.setBigUint64(baseOffset + 0, value, littleEndian);
  }
  static getIdAt(view: DataView, index: number, littleEndian = true): bigint {
    return view.getBigUint64(index * 88 + 0, littleEndian);
  }
  static setIdAt(view: DataView, value: bigint, index: number, littleEndian = true): void {
    view.setBigUint64(index * 88 + 0, value, littleEndian);
  }

  get id(): bigint {
    return this.view.getBigUint64(this.baseOffset + 0, this.littleEndian);
  }
  set id(value: bigint) {
    this.view.setBigUint64(this.baseOffset + 0, value, this.littleEndian);
  }

  static getAge(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getInt32(baseOffset + 8, littleEndian);
  }
  static setAge(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setInt32(baseOffset + 8, value, littleEndian);
  }
  static getAgeAt(view: DataView, index: number, littleEndian = true): number {
    return view.getInt32(index * 88 + 8, littleEndian);
  }
  static setAgeAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setInt32(index * 88 + 8, value, littleEndian);
  }
  static sumAge(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`Invalid record count: ${count}`);
    }
    if (!Number.isFinite(baseOffset) || !Number.isInteger(baseOffset) || baseOffset < 0) {
      throw new RangeError(`Invalid base offset: ${baseOffset}`);
    }
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 8;
    const limit = start + count * 88;
    const lastByte = start + (count - 1) * 88 + 4;
    if (lastByte > view.byteLength) {
      throw new RangeError(`scan range exceeds DataView length ${view.byteLength}`);
    }
    let sum = 0;
    for (let offset = start; offset < limit; offset += 88) {
      sum += view.getInt32(offset, littleEndian);
    }
    return sum;
  }

  get age(): number {
    return this.view.getInt32(this.baseOffset + 8, this.littleEndian);
  }
  set age(value: number) {
    this.view.setInt32(this.baseOffset + 8, value, this.littleEndian);
  }

  static getScore(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat64(baseOffset + 16, littleEndian);
  }
  static setScore(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat64(baseOffset + 16, value, littleEndian);
  }
  static getScoreAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat64(index * 88 + 16, littleEndian);
  }
  static setScoreAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat64(index * 88 + 16, value, littleEndian);
  }
  static sumScore(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`Invalid record count: ${count}`);
    }
    if (!Number.isFinite(baseOffset) || !Number.isInteger(baseOffset) || baseOffset < 0) {
      throw new RangeError(`Invalid base offset: ${baseOffset}`);
    }
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 16;
    const limit = start + count * 88;
    const lastByte = start + (count - 1) * 88 + 8;
    if (lastByte > view.byteLength) {
      throw new RangeError(`scan range exceeds DataView length ${view.byteLength}`);
    }
    let sum = 0;
    for (let offset = start; offset < limit; offset += 88) {
      sum += view.getFloat64(offset, littleEndian);
    }
    return sum;
  }

  get score(): number {
    return this.view.getFloat64(this.baseOffset + 16, this.littleEndian);
  }
  set score(value: number) {
    this.view.setFloat64(this.baseOffset + 16, value, this.littleEndian);
  }

  static getRatio(view: DataView, baseOffset = 0, littleEndian = true): number {
    return view.getFloat32(baseOffset + 24, littleEndian);
  }
  static setRatio(view: DataView, value: number, baseOffset = 0, littleEndian = true): void {
    view.setFloat32(baseOffset + 24, value, littleEndian);
  }
  static getRatioAt(view: DataView, index: number, littleEndian = true): number {
    return view.getFloat32(index * 88 + 24, littleEndian);
  }
  static setRatioAt(view: DataView, value: number, index: number, littleEndian = true): void {
    view.setFloat32(index * 88 + 24, value, littleEndian);
  }
  static sumRatio(view: DataView, count: number, baseOffset = 0, littleEndian = true): number {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`Invalid record count: ${count}`);
    }
    if (!Number.isFinite(baseOffset) || !Number.isInteger(baseOffset) || baseOffset < 0) {
      throw new RangeError(`Invalid base offset: ${baseOffset}`);
    }
    if (count === 0) {
      return 0;
    }
    const start = baseOffset + 24;
    const limit = start + count * 88;
    const lastByte = start + (count - 1) * 88 + 4;
    if (lastByte > view.byteLength) {
      throw new RangeError(`scan range exceeds DataView length ${view.byteLength}`);
    }
    let sum = 0;
    for (let offset = start; offset < limit; offset += 88) {
      sum += view.getFloat32(offset, littleEndian);
    }
    return sum;
  }

  get ratio(): number {
    return this.view.getFloat32(this.baseOffset + 24, this.littleEndian);
  }
  set ratio(value: number) {
    this.view.setFloat32(this.baseOffset + 24, value, this.littleEndian);
  }

  handleText(): string {
    return decodeFixedText(this.backingBuffer(), this.backingOffset(28), 32, "utf8");
  }
  handleBytes(): Uint8Array {
    return fixedBytesView(this.backingBuffer(), this.backingOffset(28), 32);
  }

  nameView(): Utf8SpanView {
    return new Utf8SpanView(this.view, 60, this.baseOffset, this.littleEndian, "utf8");
  }

  tagsView(): Utf8VectorView {
    return new Utf8VectorView(this.view, 68, this.baseOffset, this.littleEndian, "utf8");
  }

  avatarView(): BytesSpanView {
    return new BytesSpanView(this.view, 76, this.baseOffset, this.littleEndian);
  }
  avatarBytes(): Uint8Array {
    return this.avatarView().bytes();
  }

}
