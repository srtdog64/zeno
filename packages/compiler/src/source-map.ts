import type { FieldLayout, SourceLocation, StructLayout } from "@exornea/zeno-schema";

export interface ProjectionSourceMap {
  version: 3;
  file: string;
  sources: string[];
  names: string[];
  mappings: string;
}

interface MappingPoint {
  readonly generatedLine: number;
  readonly generatedColumn: number;
  readonly source: SourceLocation;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function createProjectionSourceMap(
  code: string,
  layouts: readonly StructLayout[],
  generatedFile: string,
): ProjectionSourceMap {
  const sourceIndexes = new Map<string, number>();
  const sources: string[] = [];
  const mappings = collectMappingPoints(code, layouts);

  for (const point of mappings) {
    const fileName = sourceFileName(point.source, generatedFile);
    if (!sourceIndexes.has(fileName)) {
      sourceIndexes.set(fileName, sources.length);
      sources.push(fileName);
    }
  }

  return {
    version: 3,
    file: baseName(generatedFile),
    sources,
    names: [],
    mappings: encodeMappings(mappings, sourceIndexes, generatedFile),
  };
}

function collectMappingPoints(code: string, layouts: readonly StructLayout[]): MappingPoint[] {
  const lines = code.split("\n");
  const points: MappingPoint[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const source = findSourceForLine(line, layouts);
    if (source === undefined) {
      continue;
    }

    points.push({
      generatedLine: index,
      generatedColumn: firstNonWhitespaceColumn(line),
      source,
    });
  }

  return points;
}

function findSourceForLine(
  line: string,
  layouts: readonly StructLayout[],
): SourceLocation | undefined {
  for (const layout of layouts) {
    if (layout.source !== undefined && line.includes(` ${layout.name}View`)) {
      return layout.source;
    }

    const fieldSource = findFieldSourceForLine(line, layout);
    if (fieldSource !== undefined) {
      return fieldSource;
    }
  }

  return undefined;
}

function findFieldSourceForLine(line: string, layout: StructLayout): SourceLocation | undefined {
  for (const field of layout.fields) {
    if (field.source === undefined) {
      continue;
    }

    const pascalName = toPascalCase(field.name);
    if (
      line.includes(`${layout.name}View${pascalName}Offset`) ||
      line.includes(`readonly ${field.name}:`) ||
      line.includes(`readonly ${field.name}Offset`) ||
      line.includes(`get${pascalName}`) ||
      line.includes(`set${pascalName}`) ||
      line.includes(`sum${pascalName}`) ||
      line.includes(`write${pascalName}`) ||
      line.includes(`get ${field.name}`) ||
      line.includes(`set ${field.name}`) ||
      line.includes(`${field.name}View`) ||
      line.includes(`${field.name}Bytes`) ||
      line.includes(`${field.name}Text`) ||
      pointerAccessorMatches(line, field, pascalName)
    ) {
      return field.source;
    }
  }

  return undefined;
}

function pointerAccessorMatches(line: string, field: FieldLayout, pascalName: string): boolean {
  if (field.kind !== "pointer") {
    return false;
  }

  return (
    line.includes(`raw${pascalName}RelativeOffset`) ||
    line.includes(`${field.name}RelativeOffset`) ||
    line.includes(`${field.name}TargetOffset`) ||
    line.includes(`${field.name}Into`)
  );
}

function encodeMappings(
  points: readonly MappingPoint[],
  sourceIndexes: ReadonlyMap<string, number>,
  generatedFile: string,
): string {
  let mappings = "";
  let currentGeneratedLine = 0;
  let previousSource = 0;
  let previousOriginalLine = 0;
  let previousOriginalColumn = 0;

  for (const point of points) {
    while (currentGeneratedLine < point.generatedLine) {
      mappings += ";";
      currentGeneratedLine += 1;
    }

    const sourceIndex = sourceIndexes.get(sourceFileName(point.source, generatedFile));
    if (sourceIndex === undefined) {
      continue;
    }

    mappings += [
      encodeVlq(point.generatedColumn),
      encodeVlq(sourceIndex - previousSource),
      encodeVlq(point.source.line - 1 - previousOriginalLine),
      encodeVlq(point.source.character - 1 - previousOriginalColumn),
    ].join("");

    previousSource = sourceIndex;
    previousOriginalLine = point.source.line - 1;
    previousOriginalColumn = point.source.character - 1;
  }

  return mappings;
}

function encodeVlq(value: number): string {
  let vlq = value < 0 ? (-value << 1) + 1 : value << 1;
  let encoded = "";

  do {
    let digit = vlq & 31;
    vlq >>>= 5;
    if (vlq > 0) {
      digit |= 32;
    }
    encoded += BASE64[digit];
  } while (vlq > 0);

  return encoded;
}

function firstNonWhitespaceColumn(line: string): number {
  const match = /\S/.exec(line);
  return match?.index ?? 0;
}

function toPascalCase(name: string): string {
  return name.slice(0, 1).toUpperCase() + name.slice(1);
}

function normalizePath(fileName: string): string {
  return fileName.replaceAll("\\", "/");
}

function sourceFileName(source: SourceLocation, generatedFile: string): string {
  const generatedDirectory = directoryName(generatedFile);
  const sourcePath = normalizePath(source.fileName);
  return relativePath(generatedDirectory, sourcePath);
}

function baseName(fileName: string): string {
  const normalized = normalizePath(fileName);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(index + 1);
}

function directoryName(fileName: string): string {
  const normalized = normalizePath(fileName);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function relativePath(fromDirectory: string, toFile: string): string {
  if (fromDirectory === "") {
    return baseName(toFile);
  }

  const fromParts = pathParts(fromDirectory);
  const toParts = pathParts(toFile);
  if (fromParts.length === 0 || toParts.length === 0 || fromParts[0] !== toParts[0]) {
    return baseName(toFile);
  }

  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common += 1;
  }

  const up = fromParts.slice(common).map(() => "..");
  const down = toParts.slice(common);
  const relative = [...up, ...down].join("/");
  return relative === "" ? baseName(toFile) : relative;
}

function pathParts(fileName: string): string[] {
  return normalizePath(fileName)
    .split("/")
    .filter((part) => part !== "");
}
