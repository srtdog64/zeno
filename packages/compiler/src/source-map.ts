import type { FieldLayout, SourceLocation, StructLayout } from "@exornea/zeno-schema";
import ts from "typescript";

import {
  generatedFieldClassMemberNames,
  generatedFieldOffsetConstantName,
  generatedLayoutClassMemberNames,
  generatedViewByteLengthConstantName,
} from "./emitter-generated-names.js";

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
  return collectAstMappingPoints(code, layouts);
}

function collectAstMappingPoints(code: string, layouts: readonly StructLayout[]): MappingPoint[] {
  const sourceFile = ts.createSourceFile(
    "generated.view.ts",
    code,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );
  const points: MappingPoint[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      pushInterfaceMapping(statement, sourceFile, layouts, points);
      continue;
    }

    if (ts.isClassDeclaration(statement)) {
      pushClassMapping(statement, sourceFile, layouts, points);
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      pushVariableMappings(statement, sourceFile, layouts, points);
    }
  }

  return dedupeMappingPoints(points);
}

function pushInterfaceMapping(
  declaration: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile,
  layouts: readonly StructLayout[],
  points: MappingPoint[],
): void {
  const layout = layoutForGeneratedName(declaration.name.text, layouts, "ViewInput");
  if (layout?.source === undefined) {
    return;
  }

  pushPoint(points, sourceFile, declaration, layout.source);

  for (const member of declaration.members) {
    const field = fieldForMemberName(member.name, layout);
    if (field?.source !== undefined) {
      pushPoint(points, sourceFile, member, field.source);
    }
  }
}

function pushClassMapping(
  declaration: ts.ClassDeclaration,
  sourceFile: ts.SourceFile,
  layouts: readonly StructLayout[],
  points: MappingPoint[],
): void {
  if (declaration.name === undefined) {
    return;
  }

  const layout = layoutForGeneratedName(declaration.name.text, layouts, "View");
  if (layout === undefined) {
    return;
  }

  if (layout.source !== undefined) {
    pushPoint(points, sourceFile, declaration, layout.source);
  }

  for (const member of declaration.members) {
    const source = sourceForClassMember(member, layout);
    if (source !== undefined) {
      pushPoint(points, sourceFile, member, source);
    }
  }
}

function pushVariableMappings(
  statement: ts.VariableStatement,
  sourceFile: ts.SourceFile,
  layouts: readonly StructLayout[],
  points: MappingPoint[],
): void {
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name)) {
      continue;
    }

    const source = sourceForVariableName(declaration.name.text, layouts);
    if (source !== undefined) {
      pushPoint(points, sourceFile, statement, source);
    }
  }
}

function sourceForClassMember(
  member: ts.ClassElement,
  layout: StructLayout,
): SourceLocation | undefined {
  if (ts.isPropertyDeclaration(member)) {
    const field = fieldForMemberName(member.name, layout);
    if (field?.source !== undefined) {
      return field.source;
    }

    if (nameText(member.name) === "byteLength" || nameText(member.name) === "alignment") {
      return layout.source;
    }
  }

  if (
    ts.isGetAccessorDeclaration(member) ||
    ts.isSetAccessorDeclaration(member) ||
    ts.isMethodDeclaration(member)
  ) {
    const memberName = nameText(member.name);
    if (memberName === undefined) {
      return undefined;
    }

    for (const field of layout.fields) {
      if (field.source !== undefined && classMemberMatchesField(memberName, field)) {
        return field.source;
      }
    }

    if (layout.source !== undefined && layoutMemberMatchesLayout(memberName)) {
      return layout.source;
    }
  }

  return undefined;
}

function sourceForVariableName(
  variableName: string,
  layouts: readonly StructLayout[],
): SourceLocation | undefined {
  for (const layout of layouts) {
    if (
      layout.source !== undefined &&
      variableName === generatedViewByteLengthConstantName(layout)
    ) {
      return layout.source;
    }

    for (const field of layout.fields) {
      if (
        field.source !== undefined &&
        variableName === generatedFieldOffsetConstantName(layout, field)
      ) {
        return field.source;
      }
    }
  }

  return undefined;
}

function classMemberMatchesField(memberName: string, field: FieldLayout): boolean {
  return generatedFieldClassMemberNames(field).has(memberName);
}

function layoutMemberMatchesLayout(memberName: string): boolean {
  return generatedLayoutClassMemberNames().has(memberName);
}

function fieldForMemberName(
  memberName: ts.PropertyName | undefined,
  layout: StructLayout,
): FieldLayout | undefined {
  const text = nameText(memberName);
  if (text === undefined) {
    return undefined;
  }

  return layout.fields.find((field) => field.name === text || text === `${field.name}Offset`);
}

function layoutForGeneratedName(
  generatedName: string,
  layouts: readonly StructLayout[],
  suffix: string,
): StructLayout | undefined {
  if (!generatedName.endsWith(suffix)) {
    return undefined;
  }

  const layoutName = generatedName.slice(0, -suffix.length);
  return layouts.find((layout) => layout.name === layoutName);
}

function nameText(name: ts.PropertyName | undefined): string | undefined {
  if (name === undefined) {
    return undefined;
  }

  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  if (ts.isPrivateIdentifier(name)) {
    return name.text;
  }

  return undefined;
}

function pushPoint(
  points: MappingPoint[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  source: SourceLocation,
): void {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  points.push({
    generatedLine: position.line,
    generatedColumn: position.character,
    source,
  });
}

function dedupeMappingPoints(points: readonly MappingPoint[]): MappingPoint[] {
  const seen = new Set<string>();
  const result: MappingPoint[] = [];

  for (const point of points) {
    const key = [
      point.generatedLine,
      point.generatedColumn,
      point.source.fileName,
      point.source.line,
      point.source.character,
    ].join(":");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(point);
  }

  return result.sort((left, right) => {
    if (left.generatedLine !== right.generatedLine) {
      return left.generatedLine - right.generatedLine;
    }
    return left.generatedColumn - right.generatedColumn;
  });
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
