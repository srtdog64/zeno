export type Endianness = "little" | "big";

export type ScalarKind =
  | "i8"
  | "u8"
  | "i16"
  | "u16"
  | "i32"
  | "u32"
  | "i64"
  | "u64"
  | "f32"
  | "f64"
  | "bool";

export const SCALAR_KINDS = [
  "i8",
  "u8",
  "i16",
  "u16",
  "i32",
  "u32",
  "i64",
  "u64",
  "f32",
  "f64",
  "bool",
] as const satisfies readonly ScalarKind[];

export type Encoding = "ascii" | "utf8";

export type DescriptorKind = "span32" | "vector32" | "pointer32";

export interface FieldLayoutBase {
  name: string;
  offset: number;
  byteLength: number;
  alignment: number;
}

export interface ScalarFieldLayout extends FieldLayoutBase {
  kind: "scalar";
  scalar: ScalarKind;
}

export interface FixedBytesFieldLayout extends FieldLayoutBase {
  kind: "fixed-bytes";
}

export interface FixedStringFieldLayout extends FieldLayoutBase {
  kind: "fixed-string";
  encoding: Encoding;
}

export interface DynamicStringFieldLayout extends FieldLayoutBase {
  kind: "dynamic-string";
  encoding: Encoding;
  descriptor: "span32";
}

export interface DynamicBytesFieldLayout extends FieldLayoutBase {
  kind: "dynamic-bytes";
  descriptor: "span32";
}

export interface StructFieldLayout extends FieldLayoutBase {
  kind: "struct";
  typeName: string;
}

export interface PointerFieldLayout extends FieldLayoutBase {
  kind: "pointer";
  descriptor: "pointer32";
  targetTypeName: string;
  nullValue: 0xffffffff;
  offsetBase: "field";
  offsetEncoding: "i32";
}

export interface ScalarVectorElementLayout {
  kind: "scalar";
  scalar: ScalarKind;
  byteLength: number;
}

export interface FixedBytesVectorElementLayout {
  kind: "fixed-bytes";
  byteLength: number;
}

export interface FixedStringVectorElementLayout {
  kind: "fixed-string";
  encoding: Encoding;
  byteLength: number;
}

export interface DynamicStringVectorElementLayout {
  kind: "dynamic-string";
  encoding: Encoding;
  descriptor: "span32";
  byteLength: number;
}

export interface DynamicBytesVectorElementLayout {
  kind: "dynamic-bytes";
  descriptor: "span32";
  byteLength: number;
}

export interface StructVectorElementLayout {
  kind: "struct";
  typeName: string;
  byteLength: number;
}

export interface PointerVectorElementLayout {
  kind: "pointer";
  descriptor: "pointer32";
  targetTypeName: string;
  byteLength: number;
  nullValue: 0xffffffff;
  offsetBase: "element";
  offsetEncoding: "i32";
}

export type VectorElementLayout =
  | ScalarVectorElementLayout
  | FixedBytesVectorElementLayout
  | FixedStringVectorElementLayout
  | DynamicStringVectorElementLayout
  | DynamicBytesVectorElementLayout
  | StructVectorElementLayout
  | PointerVectorElementLayout;

export interface VectorFieldLayout extends FieldLayoutBase {
  kind: "vector";
  descriptor: "vector32";
  element: VectorElementLayout;
}

export type FieldLayout =
  | ScalarFieldLayout
  | FixedBytesFieldLayout
  | FixedStringFieldLayout
  | DynamicStringFieldLayout
  | DynamicBytesFieldLayout
  | StructFieldLayout
  | PointerFieldLayout
  | VectorFieldLayout;

export interface StructLayout {
  kind: "struct";
  name: string;
  byteLength: number;
  alignment: number;
  endianness: Endianness;
  fields: FieldLayout[];
}

export const SPAN32_BYTE_LENGTH = 8;
export const VECTOR32_BYTE_LENGTH = 8;
export const POINTER32_BYTE_LENGTH = 4;
export const POINTER32_NULL = 0xffffffff;

export function scalarByteLength(kind: ScalarKind): number {
  switch (kind) {
    case "i8":
    case "u8":
    case "bool":
      return 1;
    case "i16":
    case "u16":
      return 2;
    case "i32":
    case "u32":
    case "f32":
      return 4;
    case "i64":
    case "u64":
    case "f64":
      return 8;
  }
}

export function scalarAlignment(kind: ScalarKind): number {
  return scalarByteLength(kind);
}

export function scalarTsType(kind: ScalarKind): "number" | "bigint" | "boolean" {
  switch (kind) {
    case "i64":
    case "u64":
      return "bigint";
    case "bool":
      return "boolean";
    default:
      return "number";
  }
}

export function scalarGetterMethod(kind: ScalarKind): string {
  switch (kind) {
    case "i8":
      return "getInt8";
    case "u8":
      return "getUint8";
    case "i16":
      return "getInt16";
    case "u16":
      return "getUint16";
    case "i32":
      return "getInt32";
    case "u32":
      return "getUint32";
    case "i64":
      return "getBigInt64";
    case "u64":
      return "getBigUint64";
    case "f32":
      return "getFloat32";
    case "f64":
      return "getFloat64";
    case "bool":
      return "getUint8";
  }
}

export function scalarSetterMethod(kind: ScalarKind): string {
  switch (kind) {
    case "i8":
      return "setInt8";
    case "u8":
      return "setUint8";
    case "i16":
      return "setInt16";
    case "u16":
      return "setUint16";
    case "i32":
      return "setInt32";
    case "u32":
      return "setUint32";
    case "i64":
      return "setBigInt64";
    case "u64":
      return "setBigUint64";
    case "f32":
      return "setFloat32";
    case "f64":
      return "setFloat64";
    case "bool":
      return "setUint8";
  }
}

export function alignTo(offset: number, alignment: number): number {
  const remainder = offset % alignment;
  if (remainder === 0) {
    return offset;
  }

  return offset + alignment - remainder;
}
