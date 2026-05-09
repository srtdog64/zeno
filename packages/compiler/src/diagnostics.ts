import ts from "typescript";

import type { Measurement, ValidationError } from "./measurement.js";

export type DiagnosticCode =
  | "UNSUPPORTED_NUMBER"
  | "UNSUPPORTED_ARRAY"
  | "UNSUPPORTED_TYPE"
  | "UNSUPPORTED_MEMBER"
  | "UNSUPPORTED_SCHEMA_STATEMENT"
  | "MISSING_TYPE"
  | "NON_NUMERIC_LENGTH"
  | "UNKNOWN_STRUCT"
  | "RECURSIVE_STRUCT"
  | "DUPLICATE_FIELD"
  | "ALIGNMENT_VIOLATION"
  | "LAYOUT_INVARIANT";

export type DiagnosticSource =
  | {
      readonly kind: "source";
      readonly fileName: string;
      readonly line: number;
      readonly character: number;
    }
  | {
      readonly kind: "ir-derived";
      readonly description: string;
    };

export interface LayoutDiagnostic {
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly source: DiagnosticSource;
  readonly fileName?: string;
  readonly line?: number;
  readonly character?: number;
  readonly structName?: string;
  readonly fieldName?: string;
  readonly measurement?: Measurement;
  readonly error?: ValidationError;
}

export function createDiagnostic(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  code: DiagnosticCode,
  message: string,
  details: {
    readonly structName?: string;
    readonly fieldName?: string;
    readonly measurement?: Measurement;
    readonly error?: ValidationError;
  } = {},
): LayoutDiagnostic {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    code,
    message,
    source: {
      kind: "source",
      fileName: sourceFile.fileName,
      line: position.line + 1,
      character: position.character + 1,
    },
    fileName: sourceFile.fileName,
    line: position.line + 1,
    character: position.character + 1,
    ...details,
  };
}

export function createIrDiagnostic(
  code: DiagnosticCode,
  message: string,
  description: string,
  details: {
    readonly structName?: string;
    readonly fieldName?: string;
    readonly measurement?: Measurement;
    readonly error?: ValidationError;
  } = {},
): LayoutDiagnostic {
  return {
    code,
    message,
    source: {
      kind: "ir-derived",
      description,
    },
    ...details,
  };
}

export function formatDiagnosticLocation(diagnostic: LayoutDiagnostic): string {
  if (diagnostic.source.kind === "source") {
    return `${diagnostic.source.fileName}:${diagnostic.source.line}:${diagnostic.source.character}`;
  }

  return `<ir-derived:${diagnostic.source.description}>`;
}
