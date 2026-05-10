import {
  scalarGetterMethod,
  scalarSetterMethod,
  scalarTsType,
  type FieldLayout,
  type StructLayout,
} from "@exornea/zeno-schema";

import { emitFixedArrayFieldAccessor } from "./emitter-fixed-array.js";
import { encodingLiteral, toPascalCase } from "./emitter-names.js";
import { method } from "./emitter-template.js";

export function emitField(layout: StructLayout, field: FieldLayout): string[] {
  // This switch intentionally mirrors the Layout IR field-kind surface.
  // Split it only when a dispatch table removes real emitter complexity.
  switch (field.kind) {
    case "scalar": {
      const getterMethod = scalarGetterMethod(field.scalar);
      const setterMethod = scalarSetterMethod(field.scalar);
      const typeName = scalarTsType(field.scalar);
      const getterArgs =
        field.byteLength === 1 || field.scalar === "bool" ? "" : ", this.littleEndian";
      const instanceOffset = `this.baseOffset + ${field.offset}`;
      const getterBody =
        field.scalar === "bool"
          ? `return this.view.${getterMethod}(${instanceOffset}) !== 0;`
          : `return this.view.${getterMethod}(${instanceOffset}${getterArgs});`;
      const setterBody =
        field.scalar === "bool"
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
      return emitPointerField(layout, field);
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
        case "dynamic-struct":
          return method`
${field.name}View(): DynamicStructVectorView<${field.element.typeName}View> {
  return new DynamicStructVectorView(this.view, ${field.offset}, (view, baseOffset, littleEndian) => new ${field.element.typeName}View(view, baseOffset, littleEndian), this.baseOffset, this.littleEndian);
}`;
        case "pointer":
          return method`
${field.name}View(): PointerVectorView<${field.element.targetTypeName}View> {
  return new PointerVectorView(this.view, ${field.offset}, ${field.element.targetTypeName}View.byteLength, (view, baseOffset, littleEndian) => new ${field.element.targetTypeName}View(view, baseOffset, littleEndian), this.baseOffset, this.littleEndian);
}`;
      }
  }
}

function emitPointerField(
  layout: StructLayout,
  field: Extract<FieldLayout, { kind: "pointer" }>,
): string[] {
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
