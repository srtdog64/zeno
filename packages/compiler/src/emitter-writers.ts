import {
  scalarTsType,
  type FieldLayout,
  type StructLayout,
  type VectorElementLayout,
} from "@exornea/zeno-schema";

import { emitFixedArrayObjectFieldWrite } from "./emitter-fixed-array.js";
import {
  canEmitObjectWriter,
  hasTailWriterFields,
  isTailWriterField,
  structFieldHasTailFields,
} from "./emitter-capabilities.js";
import { encodingLiteral, toLittleEndianLiteral, toPascalCase } from "./emitter-names.js";
import { method } from "./emitter-template.js";

type VectorFieldLayout = Extract<FieldLayout, { kind: "vector" }>;
type VectorWriterElement<K extends VectorElementLayout["kind"]> = Extract<
  VectorElementLayout,
  { kind: K }
>;
type VectorWriterField<K extends VectorElementLayout["kind"]> = Omit<
  VectorFieldLayout,
  "element"
> & {
  readonly element: VectorWriterElement<K>;
};

interface VectorWriterContext<K extends VectorElementLayout["kind"]> {
  readonly layout: StructLayout;
  readonly layoutMap: ReadonlyMap<string, StructLayout>;
  readonly field: VectorWriterField<K>;
  readonly pascalName: string;
}

type VectorWriterEmitter<K extends VectorElementLayout["kind"]> = (
  context: VectorWriterContext<K>,
) => string[];

export function emitDynamicWriterMethods(
  layout: StructLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
): string[] {
  const fields = layout.fields.filter((field) => isTailWriterField(field, layoutMap));
  if (fields.length === 0) {
    return [];
  }

  const lines: string[] = [
    ...method`
static createWriter(view: DataView, baseOffset = 0, tailOffset = ${layout.name}View.byteLength, littleEndian = ${toLittleEndianLiteral(layout)}): DynamicLayoutWriter {
  return new DynamicLayoutWriter(view, tailOffset, baseOffset, littleEndian);
}`,
    "",
  ];

  for (const field of fields) {
    const pascalName = toPascalCase(field.name);
    switch (field.kind) {
      case "dynamic-string":
        lines.push(
          ...method`
static write${pascalName}(writer: DynamicLayoutWriter, value: string) {
  return writer.writeText(${layout.name}View.${field.name}Offset, value, ${encodingLiteral(field.encoding)});
}`,
        );
        break;
      case "dynamic-bytes":
        lines.push(
          ...method`
static write${pascalName}(writer: DynamicLayoutWriter, value: ArrayLike<number> | Uint8Array) {
  return writer.writeBytes(${layout.name}View.${field.name}Offset, value);
}`,
        );
        break;
      case "vector":
        lines.push(...emitVectorWriterMethod(layout, layoutMap, field, pascalName));
        break;
    }
    lines.push("");
  }

  lines.pop();
  return lines;
}

export function emitObjectWriterMethod(
  layout: StructLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
): string[] {
  if (!canEmitObjectWriter(layout, layoutMap)) {
    return [];
  }

  const hasTailFields = hasTailWriterFields(layout, layoutMap);
  const returnType = hasTailFields ? "DynamicLayoutWriter" : "void";
  const bodyLines: string[] = [];
  if (hasTailFields) {
    bodyLines.push(
      `  const writer = ${layout.name}View.createWriter(view, baseOffset, ${layout.name}View.byteLength, littleEndian);`,
      `  ${layout.name}View.writeInto(view, writer, value, baseOffset, littleEndian);`,
      "  return writer;",
    );
  } else {
    for (const field of layout.fields) {
      bodyLines.push(...emitObjectFieldWrite(layout, layoutMap, field));
    }
  }

  const lines = method`
static write(view: DataView, value: ${layout.name}ViewInput, baseOffset = 0, littleEndian = ${toLittleEndianLiteral(layout)}): ${returnType} {
${bodyLines}
}`;

  if (hasTailFields) {
    const writeIntoLines = layout.fields.flatMap((field) =>
      emitObjectFieldWriteAtBase(layout, layoutMap, field),
    );
    lines.push("");
    lines.push(
      ...method`
static writeInto(view: DataView, writer: DynamicLayoutWriter, value: ${layout.name}ViewInput, baseOffset = 0, littleEndian = ${toLittleEndianLiteral(layout)}): void {
${writeIntoLines}
}`,
    );
  }

  return lines;
}

const vectorWriterEmitters = {
  "dynamic-string": ({ layout, field, pascalName }) => method`
static write${pascalName}(writer: DynamicLayoutWriter, values: readonly string[]) {
  return writer.writeTextVector(${layout.name}View.${field.name}Offset, values, ${encodingLiteral(field.element.encoding)});
}`,
  "dynamic-bytes": ({ layout, field, pascalName }) => method`
static write${pascalName}(writer: DynamicLayoutWriter, values: readonly (ArrayLike<number> | Uint8Array)[]) {
  return writer.writeBytesVector(${layout.name}View.${field.name}Offset, values);
}`,
  "fixed-bytes": ({ layout, field, pascalName }) => method`
static write${pascalName}(writer: DynamicLayoutWriter, values: readonly (ArrayLike<number> | Uint8Array)[]) {
  return writer.writeFixedBytesVector(${layout.name}View.${field.name}Offset, values, ${field.element.byteLength});
}`,
  "fixed-string": ({ layout, field, pascalName }) => method`
static write${pascalName}(writer: DynamicLayoutWriter, values: readonly string[]) {
  return writer.writeFixedTextVector(${layout.name}View.${field.name}Offset, values, ${field.element.byteLength}, ${encodingLiteral(field.element.encoding)});
}`,
  scalar: ({ layout, field, pascalName }) => method`
static write${pascalName}(writer: DynamicLayoutWriter, values: ArrayLike<${scalarTsType(field.element.scalar)}>) {
  return writer.writeScalarVector(${layout.name}View.${field.name}Offset, "${field.element.scalar}", values);
}`,
  struct: ({ layout, layoutMap, field, pascalName }) => {
    const elementLayout = layoutMap.get(field.element.typeName);
    const alignment = elementLayout?.alignment ?? 1;
    return method`
static write${pascalName}(writer: DynamicLayoutWriter, values: readonly ${field.element.typeName}ViewInput[]) {
  return writer.writeStructVector(${layout.name}View.${field.name}Offset, values, ${field.element.byteLength}, (view, value, baseOffset, littleEndian) => ${field.element.typeName}View.write(view, value, baseOffset, littleEndian), ${alignment});
}`;
  },
  "dynamic-struct": ({ layout, layoutMap, field, pascalName }) => {
    const elementLayout = layoutMap.get(field.element.typeName);
    const alignment = elementLayout?.alignment ?? 1;
    const elementByteLength = elementLayout?.byteLength ?? field.element.byteLength;
    const writeElement =
      elementLayout !== undefined && hasTailWriterFields(elementLayout, layoutMap)
        ? `${field.element.typeName}View.writeInto(view, elementWriter, value, baseOffset, littleEndian)`
        : `${field.element.typeName}View.write(view, value, baseOffset, littleEndian)`;
    return method`
static write${pascalName}(writer: DynamicLayoutWriter, values: readonly ${field.element.typeName}ViewInput[]) {
  return writer.writeDynamicStructVector(${layout.name}View.${field.name}Offset, values, ${elementByteLength}, (view, elementWriter, value, baseOffset, littleEndian) => ${writeElement}, ${alignment});
}`;
  },
  pointer: ({ layout, field, pascalName }) => method`
static write${pascalName}(writer: DynamicLayoutWriter, values: readonly (number | null)[]) {
  return writer.writePointerVector(${layout.name}View.${field.name}Offset, values, ${field.element.targetTypeName}View.byteLength);
}`,
} satisfies {
  readonly [K in VectorElementLayout["kind"]]: VectorWriterEmitter<K>;
};

function emitVectorWriterMethod(
  layout: StructLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
  field: VectorFieldLayout,
  pascalName: string,
): string[] {
  const emitWriter = vectorWriterEmitters[field.element.kind] as VectorWriterEmitter<
    typeof field.element.kind
  >;
  return emitWriter({ layout, layoutMap, field, pascalName });
}

function emitObjectFieldWrite(
  layout: StructLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
  field: FieldLayout,
): string[] {
  const pascalName = toPascalCase(field.name);

  switch (field.kind) {
    case "scalar":
      return [
        `  ${layout.name}View.set${pascalName}(view, value.${field.name}, baseOffset, littleEndian);`,
      ];
    case "fixed-bytes":
      return [
        `  writeFixedBytes(view.buffer, view.byteOffset + baseOffset + ${field.offset}, ${field.byteLength}, value.${field.name});`,
      ];
    case "fixed-string":
      return [
        `  writeFixedText(view.buffer, view.byteOffset + baseOffset + ${field.offset}, ${field.byteLength}, value.${field.name}, ${encodingLiteral(field.encoding)});`,
      ];
    case "dynamic-string":
    case "dynamic-bytes":
      return [`  ${layout.name}View.write${pascalName}(writer, value.${field.name});`];
    case "struct":
      if (structFieldHasTailFields(layoutMap, field.typeName)) {
        return [
          `  ${field.typeName}View.writeInto(view, writer, value.${field.name}, baseOffset + ${field.offset}, littleEndian);`,
        ];
      }
      return [
        `  ${field.typeName}View.write(view, value.${field.name}, baseOffset + ${field.offset}, littleEndian);`,
      ];
    case "pointer":
      return [
        `  ${layout.name}View.set${pascalName}TargetOffset(view, value.${field.name}, baseOffset, littleEndian);`,
      ];
    case "fixed-array":
      return emitFixedArrayObjectFieldWrite(field, encodingLiteral);
    case "vector":
      return [`  ${layout.name}View.write${pascalName}(writer, value.${field.name});`];
  }
}

function emitObjectFieldWriteAtBase(
  layout: StructLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
  field: FieldLayout,
): string[] {
  const pascalName = toPascalCase(field.name);

  switch (field.kind) {
    case "scalar":
      return [
        `  ${layout.name}View.set${pascalName}(view, value.${field.name}, baseOffset, littleEndian);`,
      ];
    case "fixed-bytes":
      return [
        `  writeFixedBytes(view.buffer, view.byteOffset + baseOffset + ${field.offset}, ${field.byteLength}, value.${field.name});`,
      ];
    case "fixed-string":
      return [
        `  writeFixedText(view.buffer, view.byteOffset + baseOffset + ${field.offset}, ${field.byteLength}, value.${field.name}, ${encodingLiteral(field.encoding)});`,
      ];
    case "dynamic-string":
      return [
        `  writer.writeTextAtBase(baseOffset, ${layout.name}View.${field.name}Offset, value.${field.name}, ${encodingLiteral(field.encoding)});`,
      ];
    case "dynamic-bytes":
      return [
        `  writer.writeBytesAtBase(baseOffset, ${layout.name}View.${field.name}Offset, value.${field.name});`,
      ];
    case "struct":
      if (structFieldHasTailFields(layoutMap, field.typeName)) {
        return [
          `  ${field.typeName}View.writeInto(view, writer, value.${field.name}, baseOffset + ${field.offset}, littleEndian);`,
        ];
      }
      return [
        `  ${field.typeName}View.write(view, value.${field.name}, baseOffset + ${field.offset}, littleEndian);`,
      ];
    case "pointer":
      return [
        `  ${layout.name}View.set${pascalName}TargetOffset(view, value.${field.name}, baseOffset, littleEndian);`,
      ];
    case "fixed-array":
      return emitFixedArrayObjectFieldWrite(field, encodingLiteral);
    case "vector":
      return emitVectorObjectFieldWriteAtBase(layout, layoutMap, field);
  }
}

function emitVectorObjectFieldWriteAtBase(
  layout: StructLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
  field: VectorFieldLayout,
): string[] {
  switch (field.element.kind) {
    case "dynamic-string":
      return [
        `  writer.writeTextVectorAtBase(baseOffset, ${layout.name}View.${field.name}Offset, value.${field.name}, ${encodingLiteral(field.element.encoding)});`,
      ];
    case "dynamic-bytes":
      return [
        `  writer.writeBytesVectorAtBase(baseOffset, ${layout.name}View.${field.name}Offset, value.${field.name});`,
      ];
    case "fixed-bytes":
      return [
        `  writer.writeFixedBytesVectorAtBase(baseOffset, ${layout.name}View.${field.name}Offset, value.${field.name}, ${field.element.byteLength});`,
      ];
    case "fixed-string":
      return [
        `  writer.writeFixedTextVectorAtBase(baseOffset, ${layout.name}View.${field.name}Offset, value.${field.name}, ${field.element.byteLength}, ${encodingLiteral(field.element.encoding)});`,
      ];
    case "scalar":
      return [
        `  writer.writeScalarVectorAtBase(baseOffset, ${layout.name}View.${field.name}Offset, "${field.element.scalar}", value.${field.name});`,
      ];
    case "struct": {
      const elementLayout = layoutMap.get(field.element.typeName);
      const alignment = elementLayout?.alignment ?? 1;
      return [
        `  writer.writeStructVectorAtBase(baseOffset, ${layout.name}View.${field.name}Offset, value.${field.name}, ${field.element.byteLength}, (view, elementValue, elementBaseOffset, elementLittleEndian) => ${field.element.typeName}View.write(view, elementValue, elementBaseOffset, elementLittleEndian), ${alignment});`,
      ];
    }
    case "dynamic-struct": {
      const elementLayout = layoutMap.get(field.element.typeName);
      const alignment = elementLayout?.alignment ?? 1;
      const elementByteLength = elementLayout?.byteLength ?? field.element.byteLength;
      const writeElement =
        elementLayout !== undefined && hasTailWriterFields(elementLayout, layoutMap)
          ? `${field.element.typeName}View.writeInto(view, elementWriter, elementValue, elementBaseOffset, elementLittleEndian)`
          : `${field.element.typeName}View.write(view, elementValue, elementBaseOffset, elementLittleEndian)`;
      return [
        `  writer.writeDynamicStructVectorAtBase(baseOffset, ${layout.name}View.${field.name}Offset, value.${field.name}, ${elementByteLength}, (view, elementWriter, elementValue, elementBaseOffset, elementLittleEndian) => ${writeElement}, ${alignment});`,
      ];
    }
    case "pointer":
      return [
        `  writer.writePointerVectorAtBase(baseOffset, ${layout.name}View.${field.name}Offset, value.${field.name}, ${field.element.targetTypeName}View.byteLength);`,
      ];
  }
}
