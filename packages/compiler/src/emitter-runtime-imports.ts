import type { FieldLayout, StructLayout, VectorElementLayout } from "@exornea/zeno-schema";

import { hasTailWriterFields } from "./emitter-capabilities.js";
import { collectFixedArrayRuntimeImports } from "./emitter-fixed-array.js";

export function collectRuntimeImports(layouts: readonly StructLayout[]): string[] {
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

function collectFieldRuntimeImports(field: FieldLayout, imports: Set<string>): void {
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
      collectVectorRuntimeImports(field.element.kind, imports);
      return;
    case "fixed-array":
      collectFixedArrayRuntimeImports(field.element, imports);
      return;
    default:
      return;
  }
}

function collectVectorRuntimeImports(
  elementKind: VectorElementLayout["kind"],
  imports: Set<string>,
): void {
  switch (elementKind) {
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
    case "dynamic-struct":
      imports.add("DynamicStructVectorView");
      return;
    case "pointer":
      imports.add("PointerVectorView");
      return;
    default:
      return;
  }
}
