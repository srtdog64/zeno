import type { FieldLayout, StructLayout, VectorElementLayout } from "@exornea/zeno-schema";

import { canWriteFixedArrayStructElement } from "./emitter-fixed-array.js";

export function hasTailWriterFields(
  layout: StructLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
): boolean {
  return layout.fields.some((field) => isTailWriterField(field, layoutMap));
}

export function isTailWriterField(
  field: FieldLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
): boolean {
  switch (field.kind) {
    case "dynamic-string":
    case "dynamic-bytes":
      return true;
    case "vector":
      return (
        field.element.kind === "scalar" ||
        field.element.kind === "fixed-bytes" ||
        field.element.kind === "fixed-string" ||
        field.element.kind === "dynamic-string" ||
        field.element.kind === "dynamic-bytes" ||
        field.element.kind === "pointer" ||
        canWriteStructVectorElement(field.element, layoutMap)
      );
    default:
      return false;
  }
}

export function canEmitObjectWriter(
  layout: StructLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
): boolean {
  return layout.fields.every((field) => canWriteObjectField(field, layoutMap));
}

export function canWriteObjectField(
  field: FieldLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
): boolean {
  switch (field.kind) {
    case "scalar":
    case "fixed-bytes":
    case "fixed-string":
    case "dynamic-string":
    case "dynamic-bytes":
    case "struct":
    case "pointer":
      return true;
    case "fixed-array":
      return (
        field.element.kind !== "struct" ||
        canWriteFixedArrayStructElement(field.element, layoutMap, hasTailWriterFields)
      );
    case "vector":
      return (
        (field.element.kind !== "struct" && field.element.kind !== "dynamic-struct") ||
        canWriteStructVectorElement(field.element, layoutMap)
      );
  }
}

export function canWriteStructVectorElement(
  element: VectorElementLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
): boolean {
  if (element.kind !== "struct" && element.kind !== "dynamic-struct") {
    return false;
  }

  const elementLayout = layoutMap.get(element.typeName);
  if (elementLayout === undefined) {
    return false;
  }

  return element.kind === "dynamic-struct"
    ? canEmitObjectWriter(elementLayout, layoutMap)
    : !hasTailWriterFields(elementLayout, layoutMap);
}

export function structFieldHasTailFields(
  layoutMap: ReadonlyMap<string, StructLayout>,
  typeName: string,
): boolean {
  const layout = layoutMap.get(typeName);
  return layout !== undefined && hasTailWriterFields(layout, layoutMap);
}
