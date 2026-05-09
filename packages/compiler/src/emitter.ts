import {
  scalarGetterMethod,
  scalarSetterMethod,
  scalarTsType,
  type FieldLayout,
  type StructLayout,
  type VectorElementLayout,
} from "@exornea/zeno-schema";

import {
  canWriteFixedArrayStructElement,
  collectFixedArrayRuntimeImports,
  emitFixedArrayFieldAccessor,
  emitFixedArrayObjectFieldWrite,
  fixedArrayInputElementType,
} from "./emitter-fixed-array.js";
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

export interface EmitOptions {
  readonly optimizeCursorOffsets?: boolean;
}

export function emitStructView(layout: StructLayout, options: EmitOptions = {}): string {
  return emitProjectionFile([layout], options);
}

export function emitProjectionFile(
  layouts: readonly StructLayout[],
  options: EmitOptions = {},
): string {
  const lines: string[] = [];
  const runtimeImports = collectRuntimeImports(layouts);
  const layoutMap = new Map(layouts.map((layout) => [layout.name, layout]));
  lines.push(`import { ${runtimeImports.join(", ")} } from "@exornea/zeno-runtime";`);
  lines.push("");

  for (const layout of layouts) {
    lines.push(...emitInputInterface(layout));
    lines.push("");
    lines.push(...emitLayoutConstants(layout));
    lines.push("");
    lines.push(...emitStructClass(layout, options, layoutMap));
    lines.push("");
  }

  return lines.join("\n");
}

function collectRuntimeImports(layouts: readonly StructLayout[]): string[] {
  const imports = new Set<string>(["ProjectionView"]);
  const layoutMap = new Map(layouts.map((layout) => [layout.name, layout]));

  for (const layout of layouts) {
    if (hasTailWriterFields(layout, layoutMap)) {
      imports.add("DynamicLayoutWriter");
    }

    for (const field of layout.fields) {
      collectFieldRuntimeImports(field, imports);
    }
  }

  return Array.from(imports).sort();
}

function collectFieldRuntimeImports(
  field: FieldLayout,
  imports: Set<string>,
): void {
  switch (field.kind) {
    case "fixed-bytes":
      imports.add("fixedBytesView");
      imports.add("writeFixedBytes");
      return;
    case "fixed-string":
      imports.add("decodeFixedText");
      imports.add("fixedBytesView");
      imports.add("writeFixedText");
      return;
    case "dynamic-string":
      imports.add("Utf8SpanView");
      return;
    case "dynamic-bytes":
      imports.add("BytesSpanView");
      return;
    case "vector":
      switch (field.element.kind) {
        case "scalar":
          imports.add("ScalarVectorView");
          return;
        case "dynamic-string":
          imports.add("Utf8VectorView");
          return;
        case "dynamic-bytes":
          imports.add("BytesVectorView");
          return;
        case "fixed-bytes":
          imports.add("FixedBytesVectorView");
          return;
        case "fixed-string":
          imports.add("FixedStringVectorView");
          return;
        case "struct":
          imports.add("StructVectorView");
          return;
        case "pointer":
          imports.add("PointerVectorView");
          return;
        default:
          return;
      }
    case "fixed-array":
      collectFixedArrayRuntimeImports(field.element, imports);
      return;
    default:
      return;
  }
}

function emitInputInterface(layout: StructLayout): string[] {
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
          return `readonly ${scalarTsType(field.element.scalar)}[]`;
        case "fixed-bytes":
        case "dynamic-bytes":
          return "readonly (ArrayLike<number> | Uint8Array)[]";
        case "fixed-string":
        case "dynamic-string":
          return "readonly string[]";
        case "struct":
          return `readonly ${field.element.typeName}ViewInput[]`;
        case "pointer":
          return "readonly (number | null)[]";
      }
  }
}

function emitLayoutConstants(layout: StructLayout): string[] {
  const lines: string[] = [];
  lines.push(`export const ${layout.name}ViewByteLength = ${layout.byteLength};`);
  lines.push(`export const ${layout.name}ViewAlignment = ${layout.alignment};`);

  for (const field of layout.fields) {
    lines.push(
      `export const ${layout.name}View${toPascalCase(field.name)}Offset = ${field.offset};`,
    );
  }

  return lines;
}

function emitStructClass(
  layout: StructLayout,
  options: EmitOptions,
  layoutMap: ReadonlyMap<string, StructLayout>,
): string[] {
  const scalarFields = layout.fields.filter((field) => field.kind === "scalar");
  const littleEndianDefault = toLittleEndianLiteral(layout);
  const lines: string[] = [`export class ${layout.name}View extends ProjectionView {`];
  lines.push(
    ...method`
static readonly byteLength = ${layout.byteLength};
static readonly alignment = ${layout.alignment};
${layout.fields.map((field) => `static readonly ${field.name}Offset = ${field.offset};`)}`,
  );

  if (layout.fields.some((field) => field.kind === "pointer")) {
    lines.push("");
    lines.push(
      ...method`
private static assertPointer32Payload(value: number): void {
  if (!Number.isInteger(value) || value < -0x80000000 || value > 0x7fffffff || value === -1) {
    throw new RangeError(\`pointer32 target offset must encode to signed i32 except -1: \${value}\`);
  }
}

private static assertPointerTargetRange(view: DataView, targetOffset: number, byteLength: number): void {
  if (!Number.isSafeInteger(targetOffset) || targetOffset < 0) {
    throw new RangeError(\`pointer32 target offset must be a non-negative safe integer: \${targetOffset}\`);
  }
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new RangeError(\`pointer32 target byteLength must be a non-negative safe integer: \${byteLength}\`);
  }
  if (byteLength > view.byteLength - targetOffset) {
    throw new RangeError(\`pointer32 target \${targetOffset}..\${targetOffset + byteLength} exceeds DataView length \${view.byteLength}\`);
  }
}`,
    );
  }

  if (options.optimizeCursorOffsets && scalarFields.length > 0) {
    lines.push("");
    lines.push(
      ...method`${scalarFields.map((field) => `private $${field.name}Offset = ${field.offset};`)}`,
    );
  }

  lines.push("");
  if (options.optimizeCursorOffsets && scalarFields.length > 0) {
    lines.push(
      ...method`
constructor(view: DataView, baseOffset = 0, littleEndian = ${littleEndianDefault}) {
  super(view, baseOffset, littleEndian);
  this.$refreshOffsets();
}

private $refreshOffsets(): void {
${scalarFields.map((field) => `  this.$${field.name}Offset = this.baseOffset + ${field.offset};`)}
}

override rebase(baseOffset: number): this {
  super.rebase(baseOffset);
  this.$refreshOffsets();
  return this;
}

override rebaseUnchecked(baseOffset: number): this {
  super.rebaseUnchecked(baseOffset);
  this.$refreshOffsets();
  return this;
}`,
    );
  } else {
    lines.push(
      ...method`
constructor(view: DataView, baseOffset = 0, littleEndian = ${littleEndianDefault}) {
  super(view, baseOffset, littleEndian);
}`,
    );
  }

  lines.push("");
  lines.push(
    ...method`
static at(view: DataView, baseOffset = 0, littleEndian = ${littleEndianDefault}): ${layout.name}View {
  return new ${layout.name}View(view, baseOffset, littleEndian);
}`,
  );
  lines.push("");

  if (options.optimizeCursorOffsets && scalarFields.length > 0) {
    lines.push(
      ...method`
moveTo(index: number): this {
  this.moveToIndex(index, ${layout.name}View.byteLength);
  this.$refreshOffsets();
  return this;
}`,
    );
  } else {
    lines.push(
      ...method`
moveTo(index: number): this {
  return this.moveToIndex(index, ${layout.name}View.byteLength);
}`,
    );
  }
  lines.push("");
  lines.push(
    ...method`
moveToUnchecked(index: number): this {
  return this.rebaseUnchecked(index * ${layout.byteLength});
}`,
  );
  lines.push("");

  const writerLines = emitDynamicWriterMethods(layout, layoutMap);
  for (const line of writerLines) {
    lines.push(line);
  }
  if (writerLines.length > 0) {
    lines.push("");
  }

  const objectWriterLines = emitObjectWriterMethod(layout, layoutMap);
  for (const line of objectWriterLines) {
    lines.push(line);
  }
  if (objectWriterLines.length > 0) {
    lines.push("");
  }

  for (const field of layout.fields) {
    const staticAccessorLines = emitStaticFieldAccessor(layout, field);
    for (const line of staticAccessorLines) {
      lines.push(line);
    }
    if (staticAccessorLines.length > 0) {
      lines.push("");
    }
    for (const line of emitField(layout, field, options)) {
      lines.push(line);
    }
    lines.push("");
  }

  lines.push("}");
  return lines;
}

function emitDynamicWriterMethods(
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
static write${pascalName}(writer: DynamicLayoutWriter, values: readonly ${scalarTsType(field.element.scalar)}[]) {
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

function emitObjectWriterMethod(
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
    );
  }

  for (const field of layout.fields) {
    bodyLines.push(...emitObjectFieldWrite(layout, field));
  }

  if (hasTailFields) {
    bodyLines.push("  return writer;");
  }

  return method`
static write(view: DataView, value: ${layout.name}ViewInput, baseOffset = 0, littleEndian = ${toLittleEndianLiteral(layout)}): ${returnType} {
${bodyLines}
}`;
}

function emitObjectFieldWrite(layout: StructLayout, field: FieldLayout): string[] {
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

function emitStaticFieldAccessor(layout: StructLayout, field: FieldLayout): string[] {
  if (field.kind === "pointer") {
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
  ${layout.name}View.assertPointerTargetRange(view, targetOffset, ${field.targetTypeName}View.byteLength);
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
    ${layout.name}View.assertPointerTargetRange(view, targetOffset, ${field.targetTypeName}View.byteLength);
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

  if (field.kind !== "scalar") {
    return [];
  }

  const getterMethod = scalarGetterMethod(field.scalar);
  const setterMethod = scalarSetterMethod(field.scalar);
  const typeName = scalarTsType(field.scalar);
  const littleEndianDefault = toLittleEndianLiteral(layout);
  const endianArg = field.byteLength === 1 || field.scalar === "bool" ? "" : ", littleEndian";
  const getterBody =
    field.scalar === "bool"
      ? `    return view.${getterMethod}(baseOffset + ${field.offset}) !== 0;`
      : `    return view.${getterMethod}(baseOffset + ${field.offset}${endianArg});`;
  const setterBody =
    field.scalar === "bool"
      ? `    view.${setterMethod}(baseOffset + ${field.offset}, value ? 1 : 0);`
      : `    view.${setterMethod}(baseOffset + ${field.offset}, value${endianArg});`;
  const indexOffset = `index * ${layout.byteLength} + ${field.offset}`;
  const indexGetterBody =
    field.scalar === "bool"
      ? `    return view.${getterMethod}(${indexOffset}) !== 0;`
      : `    return view.${getterMethod}(${indexOffset}${endianArg});`;
  const indexSetterBody =
    field.scalar === "bool"
      ? `    view.${setterMethod}(${indexOffset}, value ? 1 : 0);`
      : `    view.${setterMethod}(${indexOffset}, value${endianArg});`;
  const pascalName = toPascalCase(field.name);

  return [
    `  static get${pascalName}(view: DataView, baseOffset = 0, littleEndian = ${littleEndianDefault}): ${typeName} {`,
    getterBody,
    "  }",
    `  static set${pascalName}(view: DataView, value: ${typeName}, baseOffset = 0, littleEndian = ${littleEndianDefault}): void {`,
    setterBody,
    "  }",
    `  static get${pascalName}At(view: DataView, index: number, littleEndian = ${littleEndianDefault}): ${typeName} {`,
    indexGetterBody,
    "  }",
    `  static set${pascalName}At(view: DataView, value: ${typeName}, index: number, littleEndian = ${littleEndianDefault}): void {`,
    indexSetterBody,
    "  }",
    ...emitScalarSumKernel(layout, field, getterMethod, littleEndianDefault, pascalName),
  ];
}

function emitScalarSumKernel(
  layout: StructLayout,
  field: Extract<FieldLayout, { kind: "scalar" }>,
  getterMethod: string,
  littleEndianDefault: "true" | "false",
  pascalName: string,
): string[] {
  if (!isNumberSumScalar(field.scalar)) {
    return [];
  }

  const endianArg = field.byteLength === 1 ? "" : ", littleEndian";
  return method`
static sum${pascalName}(view: DataView, count: number, baseOffset = 0, littleEndian = ${littleEndianDefault}): number {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(\`Invalid record count: \${count}\`);
  }
  if (!Number.isFinite(baseOffset) || !Number.isInteger(baseOffset) || baseOffset < 0) {
    throw new RangeError(\`Invalid base offset: \${baseOffset}\`);
  }
  if (count === 0) {
    return 0;
  }
  const start = baseOffset + ${field.offset};
  const limit = start + count * ${layout.byteLength};
  const lastByte = start + (count - 1) * ${layout.byteLength} + ${field.byteLength};
  if (lastByte > view.byteLength) {
    throw new RangeError(\`scan range exceeds DataView length \${view.byteLength}\`);
  }
  let sum = 0;
  for (let offset = start; offset < limit; offset += ${layout.byteLength}) {
    sum += view.${getterMethod}(offset${endianArg});
  }
  return sum;
}`;
}

function isNumberSumScalar(kind: string): boolean {
  return kind !== "i64" && kind !== "u64" && kind !== "bool";
}

function emitField(
  layout: StructLayout,
  field: FieldLayout,
  options: EmitOptions,
): string[] {
  switch (field.kind) {
    case "scalar": {
      const getterMethod = scalarGetterMethod(field.scalar);
      const setterMethod = scalarSetterMethod(field.scalar);
      const typeName = scalarTsType(field.scalar);
      const getterArgs = field.byteLength === 1 || field.scalar === "bool" ? "" : ", this.littleEndian";
      const instanceOffset = options.optimizeCursorOffsets
        ? `this.$${field.name}Offset`
        : `this.baseOffset + ${field.offset}`;
      const getterBody = field.scalar === "bool"
        ? `return this.view.${getterMethod}(${instanceOffset}) !== 0;`
        : `return this.view.${getterMethod}(${instanceOffset}${getterArgs});`;
      const setterBody = field.scalar === "bool"
        ? `this.view.${setterMethod}(${instanceOffset}, value ? 1 : 0);`
        : `this.view.${setterMethod}(${instanceOffset}, value${getterArgs});`;
      return method`
get ${field.name}(): ${typeName} {
  ${getterBody}
}
set ${field.name}(value: ${typeName}) {
  ${setterBody}
}`;
    }
    case "fixed-bytes":
      return method`
${field.name}Bytes(): Uint8Array {
  return fixedBytesView(this.backingBuffer(), this.backingOffset(${field.offset}), ${field.byteLength});
}`;
    case "fixed-string":
      return method`
${field.name}Text(): string {
  return decodeFixedText(this.backingBuffer(), this.backingOffset(${field.offset}), ${field.byteLength}, ${encodingLiteral(field.encoding)});
}
${field.name}Bytes(): Uint8Array {
  return fixedBytesView(this.backingBuffer(), this.backingOffset(${field.offset}), ${field.byteLength});
}`;
    case "dynamic-string":
      return method`
${field.name}View(): Utf8SpanView {
  return new Utf8SpanView(this.view, ${field.offset}, this.baseOffset, this.littleEndian, ${encodingLiteral(field.encoding)});
}`;
    case "dynamic-bytes":
      return method`
${field.name}View(): BytesSpanView {
  return new BytesSpanView(this.view, ${field.offset}, this.baseOffset, this.littleEndian);
}
${field.name}Bytes(): Uint8Array {
  return this.${field.name}View().bytes();
}`;
    case "struct":
      return method`
${field.name}View(): ${field.typeName}View {
  return new ${field.typeName}View(this.view, this.absoluteOffset(${field.offset}), this.littleEndian);
}`;
    case "pointer": {
      const pascalName = toPascalCase(field.name);
      return method`
get raw${pascalName}RelativeOffset(): number {
  return this.view.getUint32(this.baseOffset + ${field.offset}, this.littleEndian);
}
get ${field.name}RelativeOffset(): number | null {
  const rawValue = this.raw${pascalName}RelativeOffset;
  if (rawValue === 0xffffffff) {
    return null;
  }
  return this.view.getInt32(this.baseOffset + ${field.offset}, this.littleEndian);
}
set ${field.name}RelativeOffset(value: number | null) {
  if (value === null) {
    this.view.setUint32(this.baseOffset + ${field.offset}, 0xffffffff, this.littleEndian);
    return;
  }
  if (!Number.isInteger(value) || value < -0x80000000 || value > 0x7fffffff || value === -1) {
    throw new RangeError(\`pointer32 target offset must encode to signed i32 except -1: \${value}\`);
  }
  this.view.setInt32(this.baseOffset + ${field.offset}, value, this.littleEndian);
}
get unchecked${pascalName}TargetOffset(): number | null {
  const relativeOffset = this.${field.name}RelativeOffset;
  if (relativeOffset === null) {
    return null;
  }
  return this.baseOffset + ${field.offset} + relativeOffset;
}
get ${field.name}TargetOffset(): number | null {
  const targetOffset = this.unchecked${pascalName}TargetOffset;
  if (targetOffset === null) {
    return null;
  }
  ${layout.name}View.assertPointerTargetRange(this.view, targetOffset, ${field.targetTypeName}View.byteLength);
  return targetOffset;
}
set unchecked${pascalName}TargetOffset(targetOffset: number | null) {
  if (targetOffset === null) {
    this.${field.name}RelativeOffset = null;
    return;
  }
  const relativeOffset = targetOffset - (this.baseOffset + ${field.offset});
  this.${field.name}RelativeOffset = relativeOffset;
}
set ${field.name}TargetOffset(targetOffset: number | null) {
  if (targetOffset !== null) {
    ${layout.name}View.assertPointerTargetRange(this.view, targetOffset, ${field.targetTypeName}View.byteLength);
  }
  this.unchecked${pascalName}TargetOffset = targetOffset;
}
${field.name}View(): ${field.targetTypeName}View | null {
  const targetOffset = this.${field.name}TargetOffset;
  if (targetOffset === null) {
    return null;
  }
  const target = new ${field.targetTypeName}View(this.view, 0, this.littleEndian);
  target.moveToOffset(targetOffset, ${field.targetTypeName}View.byteLength);
  return target;
}
${field.name}Into(out: ${field.targetTypeName}View): boolean {
  const targetOffset = this.${field.name}TargetOffset;
  if (targetOffset === null) {
    return false;
  }
  out.moveToOffset(targetOffset, ${field.targetTypeName}View.byteLength);
  return true;
}`;
    }
    case "fixed-array":
      return emitFixedArrayFieldAccessor(field, encodingLiteral);
    case "vector":
      switch (field.element.kind) {
        case "scalar":
          return method`
${field.name}View(): ScalarVectorView<${scalarTsType(field.element.scalar)}> {
  return new ScalarVectorView(this.view, ${field.offset}, "${field.element.scalar}", this.baseOffset, this.littleEndian);
}`;
        case "dynamic-string":
          return method`
${field.name}View(): Utf8VectorView {
  return new Utf8VectorView(this.view, ${field.offset}, this.baseOffset, this.littleEndian, ${encodingLiteral(field.element.encoding)});
}`;
        case "dynamic-bytes":
          return method`
${field.name}View(): BytesVectorView {
  return new BytesVectorView(this.view, ${field.offset}, this.baseOffset, this.littleEndian);
}`;
        case "fixed-bytes":
          return method`
${field.name}View(): FixedBytesVectorView {
  return new FixedBytesVectorView(this.view, ${field.offset}, ${field.element.byteLength}, this.baseOffset, this.littleEndian);
}`;
        case "fixed-string":
          return method`
${field.name}View(): FixedStringVectorView {
  return new FixedStringVectorView(this.view, ${field.offset}, ${field.element.byteLength}, this.baseOffset, this.littleEndian, ${encodingLiteral(field.element.encoding)});
}`;
        case "struct":
          return method`
${field.name}View(): StructVectorView<${field.element.typeName}View> {
  return new StructVectorView(this.view, ${field.offset}, ${field.element.byteLength}, (view, baseOffset, littleEndian) => new ${field.element.typeName}View(view, baseOffset, littleEndian), this.baseOffset, this.littleEndian);
}`;
        case "pointer":
          return method`
${field.name}View(): PointerVectorView<${field.element.targetTypeName}View> {
  return new PointerVectorView(this.view, ${field.offset}, ${field.element.targetTypeName}View.byteLength, (view, baseOffset, littleEndian) => new ${field.element.targetTypeName}View(view, baseOffset, littleEndian), this.baseOffset, this.littleEndian);
}`;
      }
  }
}

function toPascalCase(name: string): string {
  return name.slice(0, 1).toUpperCase() + name.slice(1);
}

function toLittleEndianLiteral(layout: StructLayout): "true" | "false" {
  return layout.endianness === "little" ? "true" : "false";
}

function encodingLiteral(encoding: "ascii" | "utf8"): "\"ascii\"" | "\"utf8\"" {
  return encoding === "ascii" ? "\"ascii\"" : "\"utf8\"";
}

function hasTailWriterFields(
  layout: StructLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
): boolean {
  return layout.fields.some((field) => isTailWriterField(field, layoutMap));
}

function isTailWriterField(
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

function canEmitObjectWriter(
  layout: StructLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
): boolean {
  return layout.fields.every((field) => canWriteObjectField(field, layoutMap));
}

function canWriteObjectField(
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
        field.element.kind !== "struct" ||
        canWriteStructVectorElement(field.element, layoutMap)
      );
  }
}

function canWriteStructVectorElement(
  element: VectorElementLayout,
  layoutMap: ReadonlyMap<string, StructLayout>,
): boolean {
  if (element.kind !== "struct") {
    return false;
  }

  const elementLayout = layoutMap.get(element.typeName);
  return elementLayout !== undefined && !hasTailWriterFields(elementLayout, layoutMap);
}
