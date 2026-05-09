import { assertDataViewRange } from "./range.js";

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

export function readScalar(
  view: DataView,
  kind: ScalarKind,
  offset: number,
  littleEndian = true,
): number | bigint | boolean {
  assertDataViewRange(view, offset, scalarByteLength(kind));

  switch (kind) {
    case "i8":
      return view.getInt8(offset);
    case "u8":
      return view.getUint8(offset);
    case "i16":
      return view.getInt16(offset, littleEndian);
    case "u16":
      return view.getUint16(offset, littleEndian);
    case "i32":
      return view.getInt32(offset, littleEndian);
    case "u32":
      return view.getUint32(offset, littleEndian);
    case "i64":
      return view.getBigInt64(offset, littleEndian);
    case "u64":
      return view.getBigUint64(offset, littleEndian);
    case "f32":
      return view.getFloat32(offset, littleEndian);
    case "f64":
      return view.getFloat64(offset, littleEndian);
    case "bool":
      return view.getUint8(offset) !== 0;
  }
}

export function writeScalar(
  view: DataView,
  kind: ScalarKind,
  offset: number,
  value: number | bigint | boolean,
  littleEndian = true,
): void {
  assertDataViewRange(view, offset, scalarByteLength(kind));

  switch (kind) {
    case "i8":
      view.setInt8(offset, value as number);
      return;
    case "u8":
      view.setUint8(offset, value as number);
      return;
    case "i16":
      view.setInt16(offset, value as number, littleEndian);
      return;
    case "u16":
      view.setUint16(offset, value as number, littleEndian);
      return;
    case "i32":
      view.setInt32(offset, value as number, littleEndian);
      return;
    case "u32":
      view.setUint32(offset, value as number, littleEndian);
      return;
    case "i64":
      view.setBigInt64(offset, value as bigint, littleEndian);
      return;
    case "u64":
      view.setBigUint64(offset, value as bigint, littleEndian);
      return;
    case "f32":
      view.setFloat32(offset, value as number, littleEndian);
      return;
    case "f64":
      view.setFloat64(offset, value as number, littleEndian);
      return;
    case "bool":
      view.setUint8(offset, value ? 1 : 0);
      return;
  }
}
