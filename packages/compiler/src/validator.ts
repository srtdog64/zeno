import {
  POINTER32_BYTE_LENGTH,
  SPAN32_BYTE_LENGTH,
  VECTOR32_BYTE_LENGTH,
  alignTo,
  scalarByteLength,
  type FieldLayout,
  type StructLayout,
  type VectorElementLayout,
} from "@zeno/schema";

import { createIrDiagnostic, type LayoutDiagnostic } from "./diagnostics.js";
import {
  duplicateDefinition,
  layoutInvariantViolation,
  measure,
  unsupportedAtPhase,
} from "./measurement.js";

export function validateLayouts(layouts: StructLayout[]): LayoutDiagnostic[] {
  const diagnostics: LayoutDiagnostic[] = [];
  const layoutNames = new Set(layouts.map((layout) => layout.name));
  const layoutMap = new Map(layouts.map((layout) => [layout.name, layout]));

  for (const layout of layouts) {
    const fieldNames = new Set<string>();
    for (const field of layout.fields) {
      if (fieldNames.has(field.name)) {
        diagnostics.push(
          createIrDiagnostic(
            "DUPLICATE_FIELD",
            `Field "${field.name}" is duplicated in struct "${layout.name}".`,
            `validateLayouts:${layout.name}.${field.name}`,
            {
              structName: layout.name,
              fieldName: field.name,
              measurement: measure(
                `field "${field.name}" definition`,
                "layout-ir-fixed",
                "phase-0",
              ),
              error: duplicateDefinition(
                `field "${field.name}"`,
                "first declaration",
                "duplicate declaration",
              ),
            },
          ),
        );
      }
      fieldNames.add(field.name);

      if (!isAligned(field)) {
        diagnostics.push(
          invariantDiagnostic(
            layout,
            field,
            "ALIGNMENT_VIOLATION",
            `Field "${field.name}" in struct "${layout.name}" is not aligned to ${field.alignment} bytes.`,
            `field "${field.name}" alignment`,
            `offset must be divisible by ${field.alignment}`,
          ),
        );
      }

      if (!hasValidDescriptorShape(field)) {
        diagnostics.push(
          invariantDiagnostic(
            layout,
            field,
            "LAYOUT_INVARIANT",
            `Field "${field.name}" in struct "${layout.name}" has an invalid descriptor layout.`,
            `field "${field.name}" descriptor`,
            "descriptor fields must use 4-byte alignment and the correct descriptor byte length",
          ),
        );
      }

      if (field.kind === "pointer" && !layoutNames.has(field.targetTypeName)) {
        diagnostics.push(unknownPointerTargetDiagnostic(
          layout,
          field.name,
          field.targetTypeName,
          `validateLayouts:${layout.name}.${field.name}`,
        ));
      }

      if (
        field.kind === "vector" &&
        field.element.kind === "pointer" &&
        !layoutNames.has(field.element.targetTypeName)
      ) {
        diagnostics.push(unknownPointerTargetDiagnostic(
          layout,
          field.name,
          field.element.targetTypeName,
          `validateLayouts:${layout.name}.${field.name}.element`,
        ));
      }

      if (field.kind === "pointer" && !hasValidPointerShape(field)) {
        diagnostics.push(
          invariantDiagnostic(
            layout,
            field,
            "LAYOUT_INVARIANT",
            `Pointer field "${field.name}" in struct "${layout.name}" has an invalid pointer layout.`,
            `field "${field.name}" pointer`,
            "pointer32 must use signed i32 field-relative offsets and raw 0xffffffff null",
          ),
        );
      }

      if (
        field.kind === "vector" &&
        field.element.kind === "pointer" &&
        !hasValidPointerElementShape(field.element)
      ) {
        diagnostics.push(
          invariantDiagnostic(
            layout,
            field,
            "LAYOUT_INVARIANT",
            `Pointer vector field "${field.name}" in struct "${layout.name}" has an invalid pointer element layout.`,
            `field "${field.name}" pointer vector element`,
            "pointer vector elements must use signed i32 element-relative offsets and raw 0xffffffff null",
          ),
        );
      }

      if (field.kind === "vector" && !hasValidVectorElementByteLength(field.element)) {
        diagnostics.push(
          invariantDiagnostic(
            layout,
            field,
            "LAYOUT_INVARIANT",
            `Vector field "${field.name}" in struct "${layout.name}" has an invalid element byte length.`,
            `field "${field.name}" vector element`,
            "vector element byteLength must match its element kind",
          ),
        );
      }

      if (
        field.kind === "vector" &&
        field.element.kind === "struct" &&
        !layoutNames.has(field.element.typeName)
      ) {
        diagnostics.push(unknownStructVectorElementDiagnostic(
          layout,
          field.name,
          field.element.typeName,
          `validateLayouts:${layout.name}.${field.name}.element`,
        ));
      }

      if (
        field.kind === "vector" &&
        field.element.kind === "struct" &&
        layoutNames.has(field.element.typeName) &&
        !isFixedStrideStruct(field.element.typeName, layoutMap, new Set())
      ) {
        diagnostics.push(
          invariantDiagnostic(
            layout,
            field,
            "LAYOUT_INVARIANT",
            `Vector field "${field.name}" in struct "${layout.name}" uses struct element "${field.element.typeName}" with dynamic tail fields; use vector<pointer<T>> for dynamic or graph-shaped elements.`,
            `field "${field.name}" struct vector element`,
            "vector<struct> elements must be fixed-stride; use vector<pointer<T>> for dynamic or graph-shaped elements",
          ),
        );
      }
    }

    for (const field of overlappingFields(layout.fields)) {
      diagnostics.push(
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

    const expectedByteLength = expectedStructByteLength(layout);
    if (layout.byteLength !== expectedByteLength) {
      diagnostics.push(
        createIrDiagnostic(
          "LAYOUT_INVARIANT",
          `Struct "${layout.name}" byteLength is ${layout.byteLength}, expected ${expectedByteLength}.`,
          `validateLayouts:${layout.name}.byteLength`,
          {
            structName: layout.name,
            measurement: measure(
              `struct "${layout.name}" byteLength`,
              "layout-ir-fixed",
              "phase-0",
            ),
            error: layoutInvariantViolation(
              `struct "${layout.name}" byteLength`,
              "byteLength must equal the aligned end of the last field",
            ),
          },
        ),
      );
    }

    if (hasInlineStructCycle(layout.name, layoutMap, new Set())) {
      diagnostics.push(
        createIrDiagnostic(
          "RECURSIVE_STRUCT",
          `Struct "${layout.name}" contains an inline recursive layout. Use pointer<T> for recursive references.`,
          `validateLayouts:${layout.name}.inlineCycle`,
          {
            structName: layout.name,
            measurement: measure(
              `struct "${layout.name}" inline size`,
              "layout-ir-fixed",
              "phase-0",
            ),
            error: unsupportedAtPhase(
              `inline recursive struct "${layout.name}"`,
              "phase-0",
            ),
          },
        ),
      );
    }
  }

  return diagnostics;
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
      measurement: measure(
        `vector "${fieldName}" struct element`,
        "layout-ir-fixed",
        "phase-0",
      ),
      error: unsupportedAtPhase(
        `vector struct element "${typeName}"`,
        "phase-0",
      ),
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
      measurement: measure(
        `pointer "${fieldName}" target`,
        "layout-ir-fixed",
        "phase-0",
      ),
      error: unsupportedAtPhase(
        `pointer target "${targetTypeName}"`,
        "phase-0",
      ),
    },
  );
}

function hasValidPointerShape(
  field: Extract<FieldLayout, { kind: "pointer" }>,
): boolean {
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
    if (
      field.kind === "struct" &&
      hasInlineStructCycle(field.typeName, layouts, active)
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
    case "pointer":
      return element.byteLength === POINTER32_BYTE_LENGTH;
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
  return createIrDiagnostic(
    code,
    message,
    `validateLayouts:${layout.name}.${field.name}`,
    {
      structName: layout.name,
      fieldName: field.name,
      measurement: measure(construct, "layout-ir-fixed", "phase-0"),
      error: layoutInvariantViolation(construct, invariant),
    },
  );
}
