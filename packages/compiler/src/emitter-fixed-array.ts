import {
  scalarTsType,
  type FieldLayout,
  type FixedArrayElementLayout,
  type StructLayout,
} from "@zeno/schema";

import { method } from "./emitter-template.js";

export function collectFixedArrayRuntimeImports(
  element: FixedArrayElementLayout,
  imports: Set<string>,
): void {
  switch (element.kind) {
    case "scalar":
      imports.add("FixedScalarArrayView");
      imports.add("writeScalar");
      return;
    case "fixed-bytes":
      imports.add("FixedBytesArrayView");
      imports.add("writeFixedBytes");
      return;
    case "fixed-string":
      imports.add("FixedStringArrayView");
      imports.add("writeFixedText");
      return;
    case "struct":
      imports.add("FixedStructArrayView");
      return;
  }
}

export function fixedArrayInputElementType(element: FixedArrayElementLayout): string {
  switch (element.kind) {
    case "scalar":
      return scalarTsType(element.scalar);
    case "fixed-bytes":
      return "ArrayLike<number> | Uint8Array";
    case "fixed-string":
      return "string";
    case "struct":
      return `${element.typeName}ViewInput`;
  }
}

export function emitFixedArrayObjectFieldWrite(
  field: Extract<FieldLayout, { kind: "fixed-array" }>,
  encodingLiteral: (encoding: "ascii" | "utf8") => "\"ascii\"" | "\"utf8\"",
): string[] {
  const lines = [
    `  if (value.${field.name}.length !== ${field.length}) {`,
    `    throw new RangeError(\`Fixed array field "${field.name}" expects ${field.length} elements, got \${value.${field.name}.length}\`);`,
    "  }",
    `  for (let index = 0; index < ${field.length}; index += 1) {`,
  ];
  const elementOffset = `baseOffset + ${field.offset} + index * ${field.element.byteLength}`;

  switch (field.element.kind) {
    case "scalar":
      lines.push(
        `    writeScalar(view, "${field.element.scalar}", ${elementOffset}, value.${field.name}[index]!, littleEndian);`,
      );
      break;
    case "fixed-bytes":
      lines.push(
        `    writeFixedBytes(view.buffer, view.byteOffset + ${elementOffset}, ${field.element.byteLength}, value.${field.name}[index]!);`,
      );
      break;
    case "fixed-string":
      lines.push(
        `    writeFixedText(view.buffer, view.byteOffset + ${elementOffset}, ${field.element.byteLength}, value.${field.name}[index]!, ${encodingLiteral(field.element.encoding)});`,
      );
      break;
    case "struct":
      lines.push(
        `    ${field.element.typeName}View.write(view, value.${field.name}[index]!, ${elementOffset}, littleEndian);`,
      );
      break;
  }

  lines.push("  }");
  return lines;
}

export function emitFixedArrayFieldAccessor(
  field: Extract<FieldLayout, { kind: "fixed-array" }>,
  encodingLiteral: (encoding: "ascii" | "utf8") => "\"ascii\"" | "\"utf8\"",
): string[] {
  switch (field.element.kind) {
    case "scalar":
      return method`
${field.name}View(): FixedScalarArrayView<${scalarTsType(field.element.scalar)}> {
  return new FixedScalarArrayView(this.view, ${field.offset}, ${field.length}, "${field.element.scalar}", this.baseOffset, this.littleEndian);
}`;
    case "fixed-bytes":
      return method`
${field.name}View(): FixedBytesArrayView {
  return new FixedBytesArrayView(this.view, ${field.offset}, ${field.length}, ${field.element.byteLength}, this.baseOffset, this.littleEndian);
}`;
    case "fixed-string":
      return method`
${field.name}View(): FixedStringArrayView {
  return new FixedStringArrayView(this.view, ${field.offset}, ${field.length}, ${field.element.byteLength}, this.baseOffset, this.littleEndian, ${encodingLiteral(field.element.encoding)});
}`;
    case "struct":
      return method`
${field.name}View(): FixedStructArrayView<${field.element.typeName}View> {
  return new FixedStructArrayView(this.view, ${field.offset}, ${field.length}, ${field.element.byteLength}, (view, baseOffset, littleEndian) => new ${field.element.typeName}View(view, baseOffset, littleEndian), this.baseOffset, this.littleEndian);
}`;
  }
}

export function canWriteFixedArrayStructElement(
  element: FixedArrayElementLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
  hasTailWriterFields: (
    layout: StructLayout,
    layoutMap: ReadonlyMap<string, StructLayout>,
  ) => boolean,
): boolean {
  if (element.kind !== "struct") {
    return false;
  }

  const elementLayout = layoutMap.get(element.typeName);
  return elementLayout !== undefined && !hasTailWriterFields(elementLayout, layoutMap);
}
