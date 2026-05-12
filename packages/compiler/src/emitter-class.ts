import { type FieldLayout, type StructLayout } from "@exornea/zeno-schema";

import { emitField } from "./emitter-fields.js";
import {
  generatedFieldOffsetConstantName,
  generatedViewAlignmentConstantName,
  generatedViewByteLengthConstantName,
} from "./emitter-generated-names.js";
import { toLittleEndianLiteral } from "./emitter-names.js";
import type { EmitOptions } from "./emitter-options.js";
import {
  emitScanRangeHelper,
  hasScanKernels,
  normalizeScanKernelMode,
} from "./emitter-scan-kernels.js";
import { emitStaticFieldAccessor } from "./emitter-static-accessors.js";
import { method } from "./emitter-template.js";
import { emitDynamicWriterMethods, emitObjectWriterMethod } from "./emitter-writers.js";

export function emitLayoutConstants(layout: StructLayout): string[] {
  const lines: string[] = [];
  lines.push(`export const ${generatedViewByteLengthConstantName(layout)} = ${layout.byteLength};`);
  lines.push(`export const ${generatedViewAlignmentConstantName(layout)} = ${layout.alignment};`);

  for (const field of layout.fields) {
    lines.push(
      `export const ${generatedFieldOffsetConstantName(layout, field)} = ${field.offset};`,
    );
  }

  return lines;
}

export function emitStructClass(
  layout: StructLayout,
  options: EmitOptions,
  layoutMap: ReadonlyMap<string, StructLayout>,
): string[] {
  const littleEndianDefault = toLittleEndianLiteral(layout);
  const scanKernelMode = normalizeScanKernelMode(options.scanKernels);
  const lines: string[] = [`export class ${layout.name}View extends ProjectionView {`];
  lines.push(
    ...method`
static readonly byteLength = ${layout.byteLength};
static readonly alignment = ${layout.alignment};
${layout.fields.map((field) => `static readonly ${field.name}Offset = ${field.offset};`)}`,
  );

  if (layout.fields.some((field) => field.kind === "pointer")) {
    lines.push("");
    lines.push(...emitPointerHelpers());
  }

  if (hasScanKernels(layout, scanKernelMode)) {
    lines.push("");
    lines.push(...emitScanRangeHelper(layout));
  }

  lines.push("");
  lines.push(
    ...method`
constructor(view: DataView, baseOffset = 0, littleEndian = ${littleEndianDefault}) {
  super(view, baseOffset, littleEndian);
}`,
  );

  lines.push("");
  lines.push(
    ...method`
static at(view: DataView, baseOffset = 0, littleEndian = ${littleEndianDefault}): ${layout.name}View {
  return new ${layout.name}View(view, baseOffset, littleEndian);
}`,
  );
  lines.push("");

  lines.push(
    ...method`
moveTo(index: number): this {
  return this.moveToIndex(index, ${layout.name}View.byteLength);
}`,
  );
  lines.push("");
  lines.push(
    ...method`
moveToUnchecked(index: number): this {
  return this.rebaseUnchecked(index * ${layout.byteLength});
}`,
  );
  lines.push("");

  lines.push(...emitLayerBlock(emitDynamicWriterMethods(layout, layoutMap)));
  lines.push(...emitLayerBlock(emitObjectWriterMethod(layout, layoutMap)));

  for (const field of layout.fields) {
    lines.push(...emitLayerBlock(emitStaticFieldAccessor(layout, field, scanKernelMode)));
    lines.push(...emitLayerBlock(emitField(layout, field)));
  }

  lines.push("}");
  return lines;
}

export function collectStructDependencies(
  layout: StructLayout,
  knownLayoutNames: ReadonlySet<string>,
): string[] {
  const dependencies = new Set<string>();
  for (const field of layout.fields) {
    collectFieldDependencies(field, dependencies, knownLayoutNames);
  }
  dependencies.delete(layout.name);
  return [...dependencies].sort((left, right) => left.localeCompare(right));
}

function collectFieldDependencies(
  field: FieldLayout,
  dependencies: Set<string>,
  knownLayoutNames: ReadonlySet<string>,
): void {
  switch (field.kind) {
    case "struct":
      addKnownDependency(field.typeName, dependencies, knownLayoutNames);
      return;
    case "pointer":
      addKnownDependency(field.targetTypeName, dependencies, knownLayoutNames);
      return;
    case "fixed-array":
      if (field.element.kind === "struct") {
        addKnownDependency(field.element.typeName, dependencies, knownLayoutNames);
      }
      return;
    case "vector":
      switch (field.element.kind) {
        case "struct":
        case "dynamic-struct":
          addKnownDependency(field.element.typeName, dependencies, knownLayoutNames);
          return;
        case "pointer":
          addKnownDependency(field.element.targetTypeName, dependencies, knownLayoutNames);
          return;
        default:
          return;
      }
    default:
      return;
  }
}

function addKnownDependency(
  name: string,
  dependencies: Set<string>,
  knownLayoutNames: ReadonlySet<string>,
): void {
  if (knownLayoutNames.has(name)) {
    dependencies.add(name);
  }
}

function emitLayerBlock(lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : [...lines, ""];
}

function emitPointerHelpers(): string[] {
  return method`
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
}`;
}
