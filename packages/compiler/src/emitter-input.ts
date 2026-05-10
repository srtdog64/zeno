import { scalarTsType, type FieldLayout, type StructLayout } from "@exornea/zeno-schema";

import { fixedArrayInputElementType } from "./emitter-fixed-array.js";

export function emitInputInterface(layout: StructLayout): string[] {
  const lines = [`export interface ${layout.name}ViewInput {`];

  for (const field of layout.fields) {
    lines.push(`  readonly ${field.name}: ${fieldInputType(field)};`);
  }

  lines.push("}");
  return lines;
}

function fieldInputType(field: FieldLayout): string {
  switch (field.kind) {
    case "scalar":
      return scalarTsType(field.scalar);
    case "fixed-bytes":
    case "dynamic-bytes":
      return "ArrayLike<number> | Uint8Array";
    case "fixed-string":
    case "dynamic-string":
      return "string";
    case "struct":
      return `${field.typeName}ViewInput`;
    case "pointer":
      return "number | null";
    case "fixed-array":
      return `readonly ${fixedArrayInputElementType(field.element)}[]`;
    case "vector":
      switch (field.element.kind) {
        case "scalar":
          return `ArrayLike<${scalarTsType(field.element.scalar)}>`;
        case "fixed-bytes":
        case "dynamic-bytes":
          return "readonly (ArrayLike<number> | Uint8Array)[]";
        case "fixed-string":
        case "dynamic-string":
          return "readonly string[]";
        case "struct":
        case "dynamic-struct":
          return `readonly ${field.element.typeName}ViewInput[]`;
        case "pointer":
          return "readonly (number | null)[]";
      }
  }
}
