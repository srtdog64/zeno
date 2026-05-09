import type {
  FieldLayout,
  FixedArrayElementLayout,
  StructLayout,
  VectorElementLayout,
} from "@exornea/zeno-schema";

export interface LayoutManifestField {
  readonly name: string;
  readonly kind: string;
  readonly offset: number;
  readonly byteLength: number;
  readonly alignment: number;
  readonly scalar?: string;
  readonly encoding?: string;
  readonly descriptor?: string;
  readonly element?: string;
  readonly typeName?: string;
  readonly targetTypeName?: string;
}

export interface LayoutManifestStruct {
  readonly name: string;
  readonly byteLength: number;
  readonly alignment: number;
  readonly endianness: "little" | "big";
  readonly layoutHash: string;
  readonly fields: readonly LayoutManifestField[];
}

export interface LayoutManifest {
  readonly version: 1;
  readonly structs: readonly LayoutManifestStruct[];
}

export interface LayoutDiffResult {
  readonly breaking: readonly string[];
  readonly versionRouted: readonly string[];
}

export function createLayoutManifest(layouts: readonly StructLayout[]): LayoutManifest {
  return {
    version: 1,
    structs: layouts.map((layout) => {
      const fields = layout.fields.map(fieldManifest);
      const signature = {
        name: layout.name,
        byteLength: layout.byteLength,
        alignment: layout.alignment,
        endianness: layout.endianness,
        fields,
      };
      return {
        ...signature,
        layoutHash: hashSignature(signature),
      };
    }),
  };
}

export function formatLayoutInspection(manifest: LayoutManifest): string {
  const chunks: string[] = [];
  for (const layout of manifest.structs) {
    chunks.push(`Struct ${layout.name}`);
    chunks.push(
      `byteLength=${layout.byteLength} alignment=${layout.alignment} endian=${layout.endianness} layoutHash=${layout.layoutHash}`,
    );
    chunks.push("field\tkind\toffset\tsize\talign");
    for (const field of layout.fields) {
      chunks.push(
        [
          field.name,
          manifestFieldKind(field),
          String(field.offset),
          String(field.byteLength),
          String(field.alignment),
        ].join("\t"),
      );
    }
    chunks.push("");
  }

  return chunks.join("\n").trimEnd();
}

export function diffLayoutManifests(
  previous: LayoutManifest,
  next: LayoutManifest,
): LayoutDiffResult {
  const breaking: string[] = [];
  const versionRouted: string[] = [];
  const previousLayouts = new Map(previous.structs.map((layout) => [layout.name, layout]));
  const nextLayouts = new Map(next.structs.map((layout) => [layout.name, layout]));

  for (const [name, previousLayout] of previousLayouts) {
    const nextLayout = nextLayouts.get(name);
    if (nextLayout === undefined) {
      breaking.push(`Removed struct ${name}`);
      continue;
    }

    compareLayout(previousLayout, nextLayout, breaking, versionRouted);
  }

  for (const name of nextLayouts.keys()) {
    if (!previousLayouts.has(name)) {
      versionRouted.push(`Added struct ${name}`);
    }
  }

  return { breaking, versionRouted };
}

export function formatLayoutDiff(diff: LayoutDiffResult): string {
  if (diff.breaking.length === 0 && diff.versionRouted.length === 0) {
    return "No layout differences.";
  }

  const lines: string[] = [];
  if (diff.breaking.length > 0) {
    lines.push("BREAKING:");
    lines.push(...diff.breaking.map((item) => `- ${item}`));
  }

  if (diff.versionRouted.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("SAFE ONLY WITH VERSION ROUTING:");
    lines.push(...diff.versionRouted.map((item) => `- ${item}`));
  }

  return lines.join("\n");
}

function compareLayout(
  previous: LayoutManifestStruct,
  next: LayoutManifestStruct,
  breaking: string[],
  versionRouted: string[],
): void {
  compareValue(`${previous.name}.byteLength`, previous.byteLength, next.byteLength, breaking);
  compareValue(`${previous.name}.alignment`, previous.alignment, next.alignment, breaking);
  compareValue(`${previous.name}.endianness`, previous.endianness, next.endianness, breaking);

  const previousFields = new Map(previous.fields.map((field) => [field.name, field]));
  const nextFields = new Map(next.fields.map((field) => [field.name, field]));

  for (const [name, previousField] of previousFields) {
    const nextField = nextFields.get(name);
    if (nextField === undefined) {
      breaking.push(`Removed field ${previous.name}.${name}`);
      continue;
    }

    compareField(previous.name, previousField, nextField, breaking);
  }

  for (const [name, field] of nextFields) {
    if (!previousFields.has(name)) {
      versionRouted.push(
        `Added ${previous.name}.${name} at offset ${field.offset} byteLength ${field.byteLength}`,
      );
    }
  }
}

function compareField(
  layoutName: string,
  previous: LayoutManifestField,
  next: LayoutManifestField,
  breaking: string[],
): void {
  const label = `${layoutName}.${previous.name}`;
  compareValue(`${label}.kind`, previous.kind, next.kind, breaking);
  compareValue(`${label}.offset`, previous.offset, next.offset, breaking);
  compareValue(`${label}.byteLength`, previous.byteLength, next.byteLength, breaking);
  compareValue(`${label}.alignment`, previous.alignment, next.alignment, breaking);
  compareValue(`${label}.scalar`, previous.scalar, next.scalar, breaking);
  compareValue(`${label}.encoding`, previous.encoding, next.encoding, breaking);
  compareValue(`${label}.descriptor`, previous.descriptor, next.descriptor, breaking);
  compareValue(`${label}.element`, previous.element, next.element, breaking);
  compareValue(`${label}.typeName`, previous.typeName, next.typeName, breaking);
  compareValue(`${label}.targetTypeName`, previous.targetTypeName, next.targetTypeName, breaking);
}

function compareValue(
  label: string,
  previous: string | number | undefined,
  next: string | number | undefined,
  breaking: string[],
): void {
  if (previous !== next) {
    breaking.push(`${label} changed: ${String(previous)} -> ${String(next)}`);
  }
}

function fieldManifest(field: FieldLayout): LayoutManifestField {
  const base = {
    name: field.name,
    kind: field.kind,
    offset: field.offset,
    byteLength: field.byteLength,
    alignment: field.alignment,
  };

  switch (field.kind) {
    case "scalar":
      return { ...base, scalar: field.scalar };
    case "fixed-string":
      return { ...base, encoding: field.encoding };
    case "dynamic-string":
      return { ...base, descriptor: field.descriptor, encoding: field.encoding };
    case "dynamic-bytes":
      return { ...base, descriptor: field.descriptor };
    case "struct":
      return { ...base, typeName: field.typeName };
    case "pointer":
      return { ...base, descriptor: field.descriptor, targetTypeName: field.targetTypeName };
    case "fixed-array":
      return { ...base, element: fixedArrayElementKind(field.element) };
    case "vector":
      return { ...base, descriptor: field.descriptor, element: vectorElementKind(field.element) };
    case "fixed-bytes":
      return base;
  }
}

function fixedArrayElementKind(element: FixedArrayElementLayout): string {
  if (element.kind === "scalar") {
    return `scalar:${element.scalar}`;
  }
  if (element.kind === "fixed-string") {
    return `fixed-string:${element.encoding}:${element.byteLength}`;
  }
  if (element.kind === "struct") {
    return `struct:${element.typeName}:${element.byteLength}`;
  }
  return `${element.kind}:${element.byteLength}`;
}

function vectorElementKind(element: VectorElementLayout): string {
  if (element.kind === "scalar") {
    return `scalar:${element.scalar}`;
  }
  if (element.kind === "fixed-string" || element.kind === "dynamic-string") {
    return `${element.kind}:${element.encoding}:${element.byteLength}`;
  }
  if (element.kind === "struct" || element.kind === "dynamic-struct") {
    return `${element.kind}:${element.typeName}:${element.byteLength}`;
  }
  if (element.kind === "pointer") {
    return `pointer:${element.targetTypeName}:${element.byteLength}`;
  }
  return `${element.kind}:${element.byteLength}`;
}

function manifestFieldKind(field: LayoutManifestField): string {
  if (field.scalar !== undefined) {
    return field.scalar;
  }
  if (field.element !== undefined) {
    return field.descriptor === undefined
      ? `${field.kind}<${field.element}>`
      : `${field.descriptor}<${field.element}>`;
  }
  if (field.encoding !== undefined) {
    return `${field.kind}:${field.encoding}`;
  }
  if (field.descriptor !== undefined) {
    return field.descriptor;
  }
  if (field.typeName !== undefined) {
    return `${field.kind}:${field.typeName}`;
  }
  if (field.targetTypeName !== undefined) {
    return `${field.kind}:${field.targetTypeName}`;
  }
  return field.kind;
}

function hashSignature(value: unknown): string {
  const data = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < data.length; index += 1) {
    hash ^= data.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `0x${hash.toString(16).padStart(8, "0")}`;
}
