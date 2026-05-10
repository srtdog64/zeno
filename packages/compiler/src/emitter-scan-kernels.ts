import {
  scalarTsType,
  type FieldLayout,
  type ScalarKind,
  type StructLayout,
} from "@exornea/zeno-schema";

import { method } from "./emitter-template.js";

export type ScanKernelMode = "none" | "sum" | "basic" | "full";

export function normalizeScanKernelMode(mode: ScanKernelMode | undefined): ScanKernelMode {
  return mode ?? "full";
}

export function parseScanKernelMode(value: string): ScanKernelMode | null {
  switch (value) {
    case "none":
    case "sum":
    case "basic":
    case "full":
      return value;
    default:
      return null;
  }
}

export function hasScanKernels(layout: StructLayout, mode: ScanKernelMode): boolean {
  if (mode === "none") {
    return false;
  }

  return layout.fields.some((field) => {
    return field.kind === "scalar" && canEmitScalarScanKernel(field, mode);
  });
}

export function emitScanRangeHelper(layout: StructLayout): string[] {
  return method`
private static assertScanRange(
  view: DataView,
  count: number,
  baseOffset: number,
  fieldOffset: number,
  fieldByteLength: number,
): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(\`Invalid record count: \${count}\`);
  }
  if (!Number.isFinite(baseOffset) || !Number.isInteger(baseOffset) || baseOffset < 0) {
    throw new RangeError(\`Invalid base offset: \${baseOffset}\`);
  }
  if (count === 0) {
    return;
  }
  const lastByte = baseOffset + fieldOffset + (count - 1) * ${layout.name}View.byteLength + fieldByteLength;
  if (lastByte > view.byteLength) {
    throw new RangeError(\`scan range exceeds DataView length \${view.byteLength}\`);
  }
}`;
}

export function emitScalarScanKernels(
  layout: StructLayout,
  field: Extract<FieldLayout, { kind: "scalar" }>,
  getterMethod: string,
  littleEndianDefault: "true" | "false",
  pascalName: string,
  mode: ScanKernelMode,
): string[] {
  if (mode === "none") {
    return [];
  }

  return [
    ...emitScalarSumKernel(layout, field, getterMethod, littleEndianDefault, pascalName, mode),
    ...emitScalarMinMaxKernels(layout, field, getterMethod, littleEndianDefault, pascalName, mode),
    ...emitScalarEqualityKernels(
      layout,
      field,
      getterMethod,
      littleEndianDefault,
      pascalName,
      mode,
    ),
  ];
}

function emitScalarSumKernel(
  layout: StructLayout,
  field: Extract<FieldLayout, { kind: "scalar" }>,
  getterMethod: string,
  littleEndianDefault: "true" | "false",
  pascalName: string,
  mode: ScanKernelMode,
): string[] {
  if (!canEmitSumKernel(field.scalar, mode)) {
    return [];
  }

  const endianArg = field.byteLength === 1 ? "" : ", littleEndian";
  return method`
static sum${pascalName}(view: DataView, count: number, baseOffset = 0, littleEndian = ${littleEndianDefault}): number {
  ${layout.name}View.assertScanRange(view, count, baseOffset, ${field.offset}, ${field.byteLength});
  if (count === 0) {
    return 0;
  }
  const start = baseOffset + ${field.offset};
  const limit = start + count * ${layout.byteLength};
  let sum = 0;
  for (let offset = start; offset < limit; offset += ${layout.byteLength}) {
    sum += view.${getterMethod}(offset${endianArg});
  }
  return sum;
}`;
}

function emitScalarMinMaxKernels(
  layout: StructLayout,
  field: Extract<FieldLayout, { kind: "scalar" }>,
  getterMethod: string,
  littleEndianDefault: "true" | "false",
  pascalName: string,
  mode: ScanKernelMode,
): string[] {
  if (!canEmitMinMaxKernel(field.scalar, mode)) {
    return [];
  }

  const endianArg = field.byteLength === 1 ? "" : ", littleEndian";
  return method`
static min${pascalName}(view: DataView, count: number, baseOffset = 0, littleEndian = ${littleEndianDefault}): number {
  ${layout.name}View.assertScanRange(view, count, baseOffset, ${field.offset}, ${field.byteLength});
  if (count === 0) {
    return Number.POSITIVE_INFINITY;
  }
  const start = baseOffset + ${field.offset};
  const limit = start + count * ${layout.byteLength};
  let minimum = Number.POSITIVE_INFINITY;
  for (let offset = start; offset < limit; offset += ${layout.byteLength}) {
    const value = view.${getterMethod}(offset${endianArg});
    if (value < minimum) {
      minimum = value;
    }
  }
  return minimum;
}
static max${pascalName}(view: DataView, count: number, baseOffset = 0, littleEndian = ${littleEndianDefault}): number {
  ${layout.name}View.assertScanRange(view, count, baseOffset, ${field.offset}, ${field.byteLength});
  if (count === 0) {
    return Number.NEGATIVE_INFINITY;
  }
  const start = baseOffset + ${field.offset};
  const limit = start + count * ${layout.byteLength};
  let maximum = Number.NEGATIVE_INFINITY;
  for (let offset = start; offset < limit; offset += ${layout.byteLength}) {
    const value = view.${getterMethod}(offset${endianArg});
    if (value > maximum) {
      maximum = value;
    }
  }
  return maximum;
}`;
}

function emitScalarEqualityKernels(
  layout: StructLayout,
  field: Extract<FieldLayout, { kind: "scalar" }>,
  getterMethod: string,
  littleEndianDefault: "true" | "false",
  pascalName: string,
  mode: ScanKernelMode,
): string[] {
  if (!canEmitEqualityKernel(field.scalar, mode)) {
    return [];
  }

  const typeName = scalarTsType(field.scalar);
  const endianArg = field.byteLength === 1 || field.scalar === "bool" ? "" : ", littleEndian";
  const readExpression =
    field.scalar === "bool"
      ? `view.${getterMethod}(offset) !== 0`
      : `view.${getterMethod}(offset${endianArg})`;
  return method`
static count${pascalName}WhereEq(view: DataView, count: number, expected: ${typeName}, baseOffset = 0, littleEndian = ${littleEndianDefault}): number {
  ${layout.name}View.assertScanRange(view, count, baseOffset, ${field.offset}, ${field.byteLength});
  let matched = 0;
  const start = baseOffset + ${field.offset};
  const limit = start + count * ${layout.byteLength};
  for (let offset = start; offset < limit; offset += ${layout.byteLength}) {
    if (${readExpression} === expected) {
      matched += 1;
    }
  }
  return matched;
}
static findFirst${pascalName}WhereEq(view: DataView, count: number, expected: ${typeName}, baseOffset = 0, littleEndian = ${littleEndianDefault}): number {
  ${layout.name}View.assertScanRange(view, count, baseOffset, ${field.offset}, ${field.byteLength});
  const start = baseOffset + ${field.offset};
  const limit = start + count * ${layout.byteLength};
  let index = 0;
  for (let offset = start; offset < limit; offset += ${layout.byteLength}) {
    if (${readExpression} === expected) {
      return index;
    }
    index += 1;
  }
  return -1;
}`;
}

function canEmitScalarScanKernel(
  field: Extract<FieldLayout, { kind: "scalar" }>,
  mode: ScanKernelMode,
): boolean {
  return (
    canEmitSumKernel(field.scalar, mode) ||
    canEmitMinMaxKernel(field.scalar, mode) ||
    canEmitEqualityKernel(field.scalar, mode)
  );
}

function canEmitSumKernel(kind: ScalarKind, mode: ScanKernelMode): boolean {
  return mode !== "none" && isNumberSumScalar(kind);
}

function canEmitMinMaxKernel(kind: ScalarKind, mode: ScanKernelMode): boolean {
  return (mode === "basic" || mode === "full") && isNumberSumScalar(kind);
}

function canEmitEqualityKernel(kind: ScalarKind, mode: ScanKernelMode): boolean {
  return mode === "full" && isEqualityKernelScalar(kind);
}

function isNumberSumScalar(kind: ScalarKind): boolean {
  return kind !== "i64" && kind !== "u64" && kind !== "bool";
}

function isEqualityKernelScalar(kind: ScalarKind): boolean {
  return kind !== "i64" && kind !== "u64" && kind !== "f32" && kind !== "f64";
}
