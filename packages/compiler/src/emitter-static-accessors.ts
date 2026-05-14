import {
  scalarGetterMethod,
  scalarSetterMethod,
  scalarTsType,
  type FieldLayout,
  type StructLayout,
} from "@exornea/zeno-schema";

import { toLittleEndianLiteral, toPascalCase } from "./emitter-names.js";
import { emitScalarScanKernels, type ScanKernelMode } from "./emitter-scan-kernels.js";
import { method } from "./emitter-template.js";

export function emitStaticFieldAccessor(
  layout: StructLayout,
  field: FieldLayout,
  scanKernelMode: ScanKernelMode,
): string[] {
  if (field.kind === "pointer") {
    return emitStaticPointerAccessor(layout, field);
  }

  return field.kind === "scalar" ? emitStaticScalarAccessor(layout, field, scanKernelMode) : [];
}

function emitStaticScalarAccessor(
  layout: StructLayout,
  field: Extract<FieldLayout, { kind: "scalar" }>,
  scanKernelMode: ScanKernelMode,
): string[] {
  const getterMethod = scalarGetterMethod(field.scalar);
  const setterMethod = scalarSetterMethod(field.scalar);
  const typeName = scalarTsType(field.scalar);
  const littleEndianDefault = toLittleEndianLiteral(layout);
  const endianArg = field.byteLength === 1 || field.scalar === "bool" ? "" : ", littleEndian";
  const indexOffset = `index * ${layout.byteLength} + ${field.offset}`;
  const pascalName = toPascalCase(field.name);

  return [
    `  static get${pascalName}(view: DataView, baseOffset = 0, littleEndian = ${littleEndianDefault}): ${typeName} {`,
    emitStaticScalarReadBody(field, getterMethod, `baseOffset + ${field.offset}`, endianArg),
    "  }",
    `  static set${pascalName}(view: DataView, value: ${typeName}, baseOffset = 0, littleEndian = ${littleEndianDefault}): void {`,
    emitStaticScalarWriteBody(field, setterMethod, `baseOffset + ${field.offset}`, endianArg),
    "  }",
    `  static get${pascalName}At(view: DataView, index: number, littleEndian = ${littleEndianDefault}): ${typeName} {`,
    emitStaticScalarReadBody(field, getterMethod, indexOffset, endianArg),
    "  }",
    `  static set${pascalName}At(view: DataView, value: ${typeName}, index: number, littleEndian = ${littleEndianDefault}): void {`,
    emitStaticScalarWriteBody(field, setterMethod, indexOffset, endianArg),
    "  }",
    ...emitScalarScanKernels(
      layout,
      field,
      getterMethod,
      littleEndianDefault,
      pascalName,
      scanKernelMode,
    ),
  ];
}

function emitStaticScalarReadBody(
  field: Extract<FieldLayout, { kind: "scalar" }>,
  getterMethod: string,
  offsetExpr: string,
  endianArg: string,
): string {
  return field.scalar === "bool"
    ? `    return view.${getterMethod}(${offsetExpr}) !== 0;`
    : `    return view.${getterMethod}(${offsetExpr}${endianArg});`;
}

function emitStaticScalarWriteBody(
  field: Extract<FieldLayout, { kind: "scalar" }>,
  setterMethod: string,
  offsetExpr: string,
  endianArg: string,
): string {
  return field.scalar === "bool"
    ? `    view.${setterMethod}(${offsetExpr}, value ? 1 : 0);`
    : `    view.${setterMethod}(${offsetExpr}, value${endianArg});`;
}

function emitStaticPointerAccessor(
  layout: StructLayout,
  field: Extract<FieldLayout, { kind: "pointer" }>,
): string[] {
  const pascalName = toPascalCase(field.name);
  const littleEndianDefault = toLittleEndianLiteral(layout);
  const indexOffset = `index * ${layout.byteLength} + ${field.offset}`;
  const pointerPosition = `baseOffset + ${field.offset}`;
  return method`
static getRaw${pascalName}RelativeOffset(view: DataView, baseOffset = 0, littleEndian = ${littleEndianDefault}): number {
  return view.getUint32(baseOffset + ${field.offset}, littleEndian);
}
static get${pascalName}RelativeOffset(view: DataView, baseOffset = 0, littleEndian = ${littleEndianDefault}): number | null {
  const rawValue = ${layout.name}View.getRaw${pascalName}RelativeOffset(view, baseOffset, littleEndian);
  if (rawValue === 0xffffffff) {
    return null;
  }
  return view.getInt32(baseOffset + ${field.offset}, littleEndian);
}
static set${pascalName}RelativeOffset(view: DataView, value: number | null, baseOffset = 0, littleEndian = ${littleEndianDefault}): void {
  if (value === null) {
    view.setUint32(baseOffset + ${field.offset}, 0xffffffff, littleEndian);
    return;
  }
  ${layout.name}View.assertPointer32Payload(value);
  view.setInt32(baseOffset + ${field.offset}, value, littleEndian);
}
static getUnchecked${pascalName}TargetOffset(view: DataView, baseOffset = 0, littleEndian = ${littleEndianDefault}): number | null {
  const relativeOffset = ${layout.name}View.get${pascalName}RelativeOffset(view, baseOffset, littleEndian);
  if (relativeOffset === null) {
    return null;
  }
  return ${pointerPosition} + relativeOffset;
}
static get${pascalName}TargetOffset(view: DataView, baseOffset = 0, littleEndian = ${littleEndianDefault}): number | null {
  const targetOffset = ${layout.name}View.getUnchecked${pascalName}TargetOffset(view, baseOffset, littleEndian);
  if (targetOffset === null) {
    return null;
  }
  ${layout.name}View.assertPointerTargetRange(view, targetOffset, ${field.targetTypeName}View.byteLength, ${field.targetTypeName}View.alignment);
  return targetOffset;
}
static setUnchecked${pascalName}TargetOffset(view: DataView, targetOffset: number | null, baseOffset = 0, littleEndian = ${littleEndianDefault}): void {
  if (targetOffset === null) {
    ${layout.name}View.set${pascalName}RelativeOffset(view, null, baseOffset, littleEndian);
    return;
  }
  const relativeOffset = targetOffset - (${pointerPosition});
  ${layout.name}View.set${pascalName}RelativeOffset(view, relativeOffset, baseOffset, littleEndian);
}
static set${pascalName}TargetOffset(view: DataView, targetOffset: number | null, baseOffset = 0, littleEndian = ${littleEndianDefault}): void {
  if (targetOffset !== null) {
    ${layout.name}View.assertPointerTargetRange(view, targetOffset, ${field.targetTypeName}View.byteLength, ${field.targetTypeName}View.alignment);
  }
  ${layout.name}View.setUnchecked${pascalName}TargetOffset(view, targetOffset, baseOffset, littleEndian);
}
static get${pascalName}RelativeOffsetAt(view: DataView, index: number, littleEndian = ${littleEndianDefault}): number | null {
  const rawValue = ${layout.name}View.getRaw${pascalName}RelativeOffset(view, index * ${layout.byteLength}, littleEndian);
  if (rawValue === 0xffffffff) {
    return null;
  }
  return view.getInt32(${indexOffset}, littleEndian);
}
static set${pascalName}RelativeOffsetAt(view: DataView, value: number | null, index: number, littleEndian = ${littleEndianDefault}): void {
  if (value === null) {
    view.setUint32(${indexOffset}, 0xffffffff, littleEndian);
    return;
  }
  ${layout.name}View.assertPointer32Payload(value);
  view.setInt32(${indexOffset}, value, littleEndian);
}`;
}
