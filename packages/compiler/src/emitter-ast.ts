import ts from "typescript";

interface ParsedSourceFile extends ts.SourceFile {
  readonly parseDiagnostics: readonly ts.Diagnostic[];
}

export interface AstCheckedGeneratedSource {
  readonly code: string;
  readonly sourceFile: ts.SourceFile;
}

export function emitAstCheckedSource(
  sourceText: string,
  fileName: string,
): AstCheckedGeneratedSource {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  ) as ParsedSourceFile;

  if (sourceFile.parseDiagnostics.length > 0) {
    throw new Error(formatParseDiagnostics(sourceFile));
  }

  return {
    code: sourceText,
    sourceFile,
  };
}

function formatParseDiagnostics(sourceFile: ParsedSourceFile): string {
  const diagnostics = sourceFile.parseDiagnostics.map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    if (diagnostic.start === undefined) {
      return message;
    }

    const position = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
    return `${sourceFile.fileName}:${position.line + 1}:${position.character + 1} ${message}`;
  });

  return `Generated TypeScript failed to parse:\n${diagnostics.join("\n")}`;
}
