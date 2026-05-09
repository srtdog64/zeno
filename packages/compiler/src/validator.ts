import {
  POINTER32_BYTE_LENGTH,
  SPAN32_BYTE_LENGTH,
  VECTOR32_BYTE_LENGTH,
  alignTo,
  scalarByteLength,
  type FieldLayout,
  type FixedArrayElementLayout,
  type StructLayout,
  type VectorElementLayout,
} from "@exornea/zeno-schema";

import { createIrDiagnostic, type LayoutDiagnostic } from "./diagnostics.js";
import {
  duplicateDefinition,
  layoutInvariantViolation,
  measure,
  unsupportedAtPhase,
} from "./measurement.js";

interface ValidationContext {
  readonly layoutNames: ReadonlySet<string>;
  readonly layoutMap: ReadonlyMap<string, StructLayout>;
}

interface FieldValidationContext extends ValidationContext {
  readonly layout: StructLayout;
  readonly field: FieldLayout;
  readonly seenFieldNames: ReadonlySet<string>;
}

interface LayoutValidationContext extends ValidationContext {
  readonly layout: StructLayout;
}

type FieldValidationRule = (context: FieldValidationContext) => LayoutDiagnostic | null;

type FieldKind = FieldLayout["kind"];

type LayoutValidationRule = (context: LayoutValidationContext) => readonly LayoutDiagnostic[];

export function validateLayouts(layouts: StructLayout[]): LayoutDiagnostic[] {
  const diagnostics: LayoutDiagnostic[] = [];
  const context: ValidationContext = {
    layoutNames: new Set(layouts.map((layout) => layout.name)),
    layoutMap: new Map(layouts.map((layout) => [layout.name, layout])),
  };

  for (const layout of layouts) {
    const seenFieldNames = new Set<string>();
    for (const field of layout.fields) {
      const fieldContext = { ...context, layout, field, seenFieldNames };
      for (const rule of commonFieldValidationRules) {
        const diagnostic = rule(fieldContext);
        if (diagnostic !== null) {
          diagnostics.push(diagnostic);
        }
      }
      for (const rule of fieldValidationRulesByKind[field.kind]) {
        const diagnostic = rule(fieldContext);
        if (diagnostic !== null) {
          diagnostics.push(diagnostic);
        }
      }
      seenFieldNames.add(field.name);
    }

    const layoutContext = { ...context, layout };
    for (const rule of layoutValidationRules) {
      diagnostics.push(...rule(layoutContext));
    }
  }

  return diagnostics;
}

const commonFieldValidationRules = [
  validateDuplicateField,
  validateFieldAlignment,
  validateDescriptorShape,
] satisfies readonly FieldValidationRule[];

const fieldValidationRulesByKind = {
  scalar: [],
  "fixed-bytes": [],
  "fixed-string": [],
  "dynamic-string": [],
  "dynamic-bytes": [],
  struct: [],
  pointer: [validatePointerTarget, validatePointerShape],
  "fixed-array": [
    validateFixedArrayElementByteLength,
    validateStructFixedArrayElementTarget,
    validateStructFixedArrayElementStride,
  ],
  vector: [
    validatePointerVectorTarget,
    validatePointerVectorElementShape,
    validateVectorElementByteLength,
    validateStructVectorElementTarget,
    validateStructVectorElementStride,
  ],
} satisfies Record<FieldKind, readonly FieldValidationRule[]>;

const layoutValidationRules = [
  validateNoOverlappingFields,
  validateStructByteLength,
  validateNoInlineStructCycle,
] satisfies readonly LayoutValidationRule[];

function validateDuplicateField({
  layout,
  field,
  seenFieldNames,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (!seenFieldNames.has(field.name)) {
    return null;
  }

  return createIrDiagnostic(
    "DUPLICATE_FIELD",
    `Field "${field.name}" is duplicated in struct "${layout.name}".`,
    `validateLayouts:${layout.name}.${field.name}`,
    {
      structName: layout.name,
      fieldName: field.name,
      measurement: measure(`field "${field.name}" definition`, "layout-ir-fixed", "phase-0"),
      error: duplicateDefinition(
        `field "${field.name}"`,
        "first declaration",
        "duplicate declaration",
      ),
    },
  );
}

function validateFieldAlignment({
  layout,
  field,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (isAligned(field)) {
    return null;
  }

  return invariantDiagnostic(
    layout,
    field,
    "ALIGNMENT_VIOLATION",
    `Field "${field.name}" in struct "${layout.name}" is not aligned to ${field.alignment} bytes.`,
    `field "${field.name}" alignment`,
    `offset must be divisible by ${field.alignment}`,
  );
}

function validateDescriptorShape({
  layout,
  field,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (hasValidDescriptorShape(field)) {
    return null;
  }

  return invariantDiagnostic(
    layout,
    field,
    "LAYOUT_INVARIANT",
    `Field "${field.name}" in struct "${layout.name}" has an invalid descriptor layout.`,
    `field "${field.name}" descriptor`,
    "descriptor fields must use 4-byte alignment and the correct descriptor byte length",
  );
}

function validatePointerTarget({
  layout,
  field,
  layoutNames,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (field.kind !== "pointer" || layoutNames.has(field.targetTypeName)) {
    return null;
  }

  return unknownPointerTargetDiagnostic(
    layout,
    field.name,
    field.targetTypeName,
    `validateLayouts:${layout.name}.${field.name}`,
  );
}

function validatePointerVectorTarget({
  layout,
  field,
  layoutNames,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (
    field.kind !== "vector" ||
    field.element.kind !== "pointer" ||
    layoutNames.has(field.element.targetTypeName)
  ) {
    return null;
  }

  return unknownPointerTargetDiagnostic(
    layout,
    field.name,
    field.element.targetTypeName,
    `validateLayouts:${layout.name}.${field.name}.element`,
  );
}

function validatePointerShape({ layout, field }: FieldValidationContext): LayoutDiagnostic | null {
  if (field.kind !== "pointer" || hasValidPointerShape(field)) {
    return null;
  }

  return invariantDiagnostic(
    layout,
    field,
    "LAYOUT_INVARIANT",
    `Pointer field "${field.name}" in struct "${layout.name}" has an invalid pointer layout.`,
    `field "${field.name}" pointer`,
    "pointer32 must use signed i32 field-relative offsets and raw 0xffffffff null",
  );
}

function validatePointerVectorElementShape({
  layout,
  field,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (
    field.kind !== "vector" ||
    field.element.kind !== "pointer" ||
    hasValidPointerElementShape(field.element)
  ) {
    return null;
  }

  return invariantDiagnostic(
    layout,
    field,
    "LAYOUT_INVARIANT",
    `Pointer vector field "${field.name}" in struct "${layout.name}" has an invalid pointer element layout.`,
    `field "${field.name}" pointer vector element`,
    "pointer vector elements must use signed i32 element-relative offsets and raw 0xffffffff null",
  );
}

function validateVectorElementByteLength({
  layout,
  field,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (field.kind !== "vector" || hasValidVectorElementByteLength(field.element)) {
    return null;
  }

  return invariantDiagnostic(
    layout,
    field,
    "LAYOUT_INVARIANT",
    `Vector field "${field.name}" in struct "${layout.name}" has an invalid element byte length.`,
    `field "${field.name}" vector element`,
    "vector element byteLength must match its element kind",
  );
}

function validateFixedArrayElementByteLength({
  layout,
  field,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (
    field.kind !== "fixed-array" ||
    (field.length > 0 &&
      hasValidFixedArrayElementByteLength(field.element) &&
      field.byteLength === field.length * field.element.byteLength)
  ) {
    return null;
  }

  return invariantDiagnostic(
    layout,
    field,
    "LAYOUT_INVARIANT",
    `Fixed array field "${field.name}" in struct "${layout.name}" has an invalid element layout.`,
    `field "${field.name}" fixed array element`,
    "fixed array length must be positive and byteLength must equal length * element byteLength",
  );
}

function validateStructVectorElementTarget({
  layout,
  field,
  layoutNames,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (
    field.kind !== "vector" ||
    (field.element.kind !== "struct" && field.element.kind !== "dynamic-struct") ||
    layoutNames.has(field.element.typeName)
  ) {
    return null;
  }

  return unknownStructVectorElementDiagnostic(
    layout,
    field.name,
    field.element.typeName,
    `validateLayouts:${layout.name}.${field.name}.element`,
  );
}

function validateStructFixedArrayElementTarget({
  layout,
  field,
  layoutNames,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (
    field.kind !== "fixed-array" ||
    field.element.kind !== "struct" ||
    layoutNames.has(field.element.typeName)
  ) {
    return null;
  }

  return unknownStructElementDiagnostic(
    layout,
    field.name,
    field.element.typeName,
    `validateLayouts:${layout.name}.${field.name}.element`,
    "Fixed array",
  );
}

function validateStructVectorElementStride({
  layout,
  field,
  layoutNames,
  layoutMap,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (
    field.kind !== "vector" ||
    field.element.kind !== "struct" ||
    !layoutNames.has(field.element.typeName) ||
    isFixedStrideStruct(field.element.typeName, layoutMap, new Set())
  ) {
    return null;
  }

  return invariantDiagnostic(
    layout,
    field,
    "LAYOUT_INVARIANT",
    `Vector field "${field.name}" in struct "${layout.name}" uses struct element "${field.element.typeName}" with dynamic tail fields; use vector<pointer<T>> for dynamic or graph-shaped elements.`,
    `field "${field.name}" struct vector element`,
    "vector<struct> elements must be fixed-stride; use vector<pointer<T>> for dynamic or graph-shaped elements",
  );
}

function validateStructFixedArrayElementStride({
  layout,
  field,
  layoutNames,
  layoutMap,
}: FieldValidationContext): LayoutDiagnostic | null {
  if (
    field.kind !== "fixed-array" ||
    field.element.kind !== "struct" ||
    !layoutNames.has(field.element.typeName) ||
    isFixedStrideStruct(field.element.typeName, layoutMap, new Set())
  ) {
    return null;
  }

  return invariantDiagnostic(
    layout,
    field,
    "LAYOUT_INVARIANT",
    `Fixed array field "${field.name}" in struct "${layout.name}" uses struct element "${field.element.typeName}" with dynamic tail fields; use fixedArray<pointer<T>, N> only after pointer fixed arrays have an ABI policy.`,
    `field "${field.name}" fixed array struct element`,
    "fixedArray<struct, N> elements must be fixed-stride",
  );
}

function validateNoOverlappingFields({
  layout,
}: LayoutValidationContext): readonly LayoutDiagnostic[] {
  return overlappingFields(layout.fields).map((field) =>
    invariantDiagnostic(
      layout,
      field,
      "LAYOUT_INVARIANT",
      `Field "${field.name}" in struct "${layout.name}" overlaps a previous field.`,
      `field "${field.name}" offset range`,
      "field ranges must not overlap",
    ),
  );
}

function validateStructByteLength({
  layout,
}: LayoutValidationContext): readonly LayoutDiagnostic[] {
  const expectedByteLength = expectedStructByteLength(layout);
  if (layout.byteLength === expectedByteLength) {
    return [];
  }

  return [
    createIrDiagnostic(
      "LAYOUT_INVARIANT",
      `Struct "${layout.name}" byteLength is ${layout.byteLength}, expected ${expectedByteLength}.`,
      `validateLayouts:${layout.name}.byteLength`,
      {
        structName: layout.name,
        measurement: measure(`struct "${layout.name}" byteLength`, "layout-ir-fixed", "phase-0"),
        error: layoutInvariantViolation(
          `struct "${layout.name}" byteLength`,
          "byteLength must equal the aligned end of the last field",
        ),
      },
    ),
  ];
}

function validateNoInlineStructCycle({
  layout,
  layoutMap,
}: LayoutValidationContext): readonly LayoutDiagnostic[] {
  if (!hasInlineStructCycle(layout.name, layoutMap, new Set())) {
    return [];
  }

  return [
    createIrDiagnostic(
      "RECURSIVE_STRUCT",
      `Struct "${layout.name}" contains an inline recursive layout. Use pointer<T> for recursive references.`,
      `validateLayouts:${layout.name}.inlineCycle`,
      {
        structName: layout.name,
        measurement: measure(`struct "${layout.name}" inline size`, "layout-ir-fixed", "phase-0"),
        error: unsupportedAtPhase(`inline recursive struct "${layout.name}"`, "phase-0"),
      },
    ),
  ];
}

function unknownStructVectorElementDiagnostic(
  layout: StructLayout,
  fieldName: string,
  typeName: string,
  description: string,
): LayoutDiagnostic {
  return createIrDiagnostic(
    "UNKNOWN_STRUCT",
    `Vector field "${fieldName}" in struct "${layout.name}" targets unknown struct "${typeName}".`,
    description,
    {
      structName: layout.name,
      fieldName,
      measurement: measure(`vector "${fieldName}" struct element`, "layout-ir-fixed", "phase-0"),
      error: unsupportedAtPhase(`vector struct element "${typeName}"`, "phase-0"),
    },
  );
}

function unknownStructElementDiagnostic(
  layout: StructLayout,
  fieldName: string,
  typeName: string,
  description: string,
  label: "Vector" | "Fixed array",
): LayoutDiagnostic {
  return createIrDiagnostic(
    "UNKNOWN_STRUCT",
    `${label} field "${fieldName}" in struct "${layout.name}" targets unknown struct "${typeName}".`,
    description,
    {
      structName: layout.name,
      fieldName,
      measurement: measure(
        `${label.toLowerCase()} "${fieldName}" struct element`,
        "layout-ir-fixed",
        "phase-0",
      ),
      error: unsupportedAtPhase(`${label.toLowerCase()} struct element "${typeName}"`, "phase-0"),
    },
  );
}

function unknownPointerTargetDiagnostic(
  layout: StructLayout,
  fieldName: string,
  targetTypeName: string,
  description: string,
): LayoutDiagnostic {
  return createIrDiagnostic(
    "UNKNOWN_STRUCT",
    `Pointer field "${fieldName}" in struct "${layout.name}" targets unknown struct "${targetTypeName}".`,
    description,
    {
      structName: layout.name,
      fieldName,
      measurement: measure(`pointer "${fieldName}" target`, "layout-ir-fixed", "phase-0"),
      error: unsupportedAtPhase(`pointer target "${targetTypeName}"`, "phase-0"),
    },
  );
}

function hasValidPointerShape(field: Extract<FieldLayout, { kind: "pointer" }>): boolean {
  return (
    field.descriptor === "pointer32" &&
    field.nullValue === 0xffffffff &&
    field.offsetBase === "field" &&
    field.offsetEncoding === "i32"
  );
}

function hasValidPointerElementShape(
  element: Extract<VectorElementLayout, { kind: "pointer" }>,
): boolean {
  return (
    element.descriptor === "pointer32" &&
    element.nullValue === 0xffffffff &&
    element.offsetBase === "element" &&
    element.offsetEncoding === "i32"
  );
}

function hasInlineStructCycle(
  layoutName: string,
  layouts: ReadonlyMap<string, StructLayout>,
  active: Set<string>,
): boolean {
  if (active.has(layoutName)) {
    return true;
  }

  const layout = layouts.get(layoutName);
  if (layout === undefined) {
    return false;
  }

  active.add(layoutName);
  for (const field of layout.fields) {
    if (field.kind === "struct" && hasInlineStructCycle(field.typeName, layouts, active)) {
      active.delete(layoutName);
      return true;
    }
    if (
      field.kind === "fixed-array" &&
      field.element.kind === "struct" &&
      hasInlineStructCycle(field.element.typeName, layouts, active)
    ) {
      active.delete(layoutName);
      return true;
    }
  }
  active.delete(layoutName);
  return false;
}

function isFixedStrideStruct(
  layoutName: string,
  layouts: ReadonlyMap<string, StructLayout>,
  active: Set<string>,
): boolean {
  if (active.has(layoutName)) {
    return false;
  }

  const layout = layouts.get(layoutName);
  if (layout === undefined) {
    return false;
  }

  active.add(layoutName);
  for (const field of layout.fields) {
    switch (field.kind) {
      case "dynamic-string":
      case "dynamic-bytes":
      case "vector":
        active.delete(layoutName);
        return false;
      case "fixed-array":
        if (
          field.element.kind === "struct" &&
          !isFixedStrideStruct(field.element.typeName, layouts, active)
        ) {
          active.delete(layoutName);
          return false;
        }
        break;
      case "struct":
        if (!isFixedStrideStruct(field.typeName, layouts, active)) {
          active.delete(layoutName);
          return false;
        }
        break;
      default:
        break;
    }
  }
  active.delete(layoutName);
  return true;
}

function isAligned(field: FieldLayout): boolean {
  if (field.alignment <= 0) {
    return false;
  }

  return field.offset % field.alignment === 0;
}

function hasValidDescriptorShape(field: FieldLayout): boolean {
  switch (field.kind) {
    case "dynamic-string":
    case "dynamic-bytes":
      return field.alignment >= 4 && field.byteLength === SPAN32_BYTE_LENGTH;
    case "vector":
      return field.alignment >= 4 && field.byteLength === VECTOR32_BYTE_LENGTH;
    case "pointer":
      return field.alignment >= 4 && field.byteLength === POINTER32_BYTE_LENGTH;
    default:
      return true;
  }
}

function hasValidVectorElementByteLength(element: VectorElementLayout): boolean {
  switch (element.kind) {
    case "scalar":
      return element.byteLength === scalarByteLength(element.scalar);
    case "dynamic-string":
    case "dynamic-bytes":
      return element.byteLength === SPAN32_BYTE_LENGTH;
    case "fixed-bytes":
    case "fixed-string":
    case "struct":
      return element.byteLength > 0;
    case "dynamic-struct":
      return element.byteLength === POINTER32_BYTE_LENGTH;
    case "pointer":
      return element.byteLength === POINTER32_BYTE_LENGTH;
  }
}

function hasValidFixedArrayElementByteLength(element: FixedArrayElementLayout): boolean {
  switch (element.kind) {
    case "scalar":
      return element.byteLength === scalarByteLength(element.scalar);
    case "fixed-bytes":
    case "fixed-string":
    case "struct":
      return element.byteLength > 0;
  }
}

function overlappingFields(fields: readonly FieldLayout[]): FieldLayout[] {
  const sortedFields = [...fields].sort((left, right) => left.offset - right.offset);
  const overlaps: FieldLayout[] = [];
  let previousEnd = 0;

  for (const field of sortedFields) {
    if (field.offset < previousEnd) {
      overlaps.push(field);
    }
    previousEnd = Math.max(previousEnd, field.offset + field.byteLength);
  }

  return overlaps;
}

function expectedStructByteLength(layout: StructLayout): number {
  const end = layout.fields.reduce(
    (maxEnd, field) => Math.max(maxEnd, field.offset + field.byteLength),
    0,
  );
  return alignTo(end, layout.alignment);
}

function invariantDiagnostic(
  layout: StructLayout,
  field: FieldLayout,
  code: "ALIGNMENT_VIOLATION" | "LAYOUT_INVARIANT",
  message: string,
  construct: string,
  invariant: string,
): LayoutDiagnostic {
  return createIrDiagnostic(code, message, `validateLayouts:${layout.name}.${field.name}`, {
    structName: layout.name,
    fieldName: field.name,
    measurement: measure(construct, "layout-ir-fixed", "phase-0"),
    error: layoutInvariantViolation(construct, invariant),
  });
}
