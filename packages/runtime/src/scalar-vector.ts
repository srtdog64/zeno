import { readScalar, scalarByteLength, type ScalarKind } from "./scalar.js";
import { VectorView } from "./vector-base.js";

export type ScalarTypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | BigInt64Array
  | BigUint64Array
  | Float32Array
  | Float64Array;

type ScalarTypedArrayConstructor = {
  readonly BYTES_PER_ELEMENT: number;
  new (buffer: ArrayBufferLike, byteOffset: number, length: number): ScalarTypedArray;
};

const HOST_LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

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

  nativeArray(): ScalarTypedArray {
    const TypedArray = scalarTypedArrayConstructor(this.scalarKind);
    const stride = scalarByteLength(this.scalarKind);
    const payloadOffset = this.payloadOffset();
    const byteLength = this.length * stride;

    if (stride > 1 && this.littleEndian !== HOST_LITTLE_ENDIAN) {
      throw new RangeError(
        `Scalar vector ${this.scalarKind} cannot be projected as a native TypedArray when endian differs from host`,
      );
    }

    this.assertRange(payloadOffset, byteLength);
    const byteOffset = this.backingOffset(payloadOffset);
    if (byteOffset % TypedArray.BYTES_PER_ELEMENT !== 0) {
      throw new RangeError(
        `Scalar vector payload byte offset ${byteOffset} is not aligned to ${TypedArray.BYTES_PER_ELEMENT}`,
      );
    }

    return new TypedArray(this.backingBuffer(), byteOffset, this.length);
  }
}

function scalarTypedArrayConstructor(kind: ScalarKind): ScalarTypedArrayConstructor {
  switch (kind) {
    case "i8":
      return Int8Array;
    case "u8":
      return Uint8Array;
    case "i16":
      return Int16Array;
    case "u16":
      return Uint16Array;
    case "i32":
      return Int32Array;
    case "u32":
      return Uint32Array;
    case "i64":
      return BigInt64Array;
    case "u64":
      return BigUint64Array;
    case "f32":
      return Float32Array;
    case "f64":
      return Float64Array;
    case "bool":
      throw new RangeError("bool vectors do not have a native TypedArray projection");
  }
}
