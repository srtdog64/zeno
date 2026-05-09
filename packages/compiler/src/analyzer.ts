import ts from "typescript";

import { alignTo, type Endianness, type StructLayout } from "@exornea/zeno-schema";

import {
  createDiagnostic,
  type LayoutDiagnostic,
} from "./diagnostics.js";
import { measure, unsupportedAtPhase } from "./measurement.js";
import { err, ok, type Result } from "./result.js";
import { lowerField } from "./lowering.js";
import { validateLayouts } from "./validator.js";

export interface AnalyzeOptions {
  readonly endianness?: Endianness;
}

export interface AnalyzeResult {
  readonly layouts: StructLayout[];
  readonly diagnostics: LayoutDiagnostic[];
}

interface AnalyzerState {
  readonly sourceFile: ts.SourceFile;
  readonly endianness: Endianness;
  readonly declarations: Map<string, ts.InterfaceDeclaration>;
  readonly layouts: Map<string, StructLayout>;
  readonly diagnostics: LayoutDiagnostic[];
  readonly activeStack: Set<string>;
}

export function analyzeProjectionFile(
  _program: ts.Program | undefined,
  sourceFile: ts.SourceFile,
  options: AnalyzeOptions = {},
): AnalyzeResult {
  return analyzeProjectionSourceFile(sourceFile, options);
}

export function analyzeProjectionSourceFile(
  sourceFile: ts.SourceFile,
  options: AnalyzeOptions = {},
): AnalyzeResult {
  const state: AnalyzerState = {
    sourceFile,
    endianness: options.endianness ?? "little",
    declarations: collectInterfaceDeclarations(sourceFile),
    layouts: new Map<string, StructLayout>(),
    diagnostics: validateSchemaSource(sourceFile),
    activeStack: new Set<string>(),
  };

  for (const structName of state.declarations.keys()) {
    const result = lowerStruct(structName, state, sourceFile);
    if (!result.ok) {
      state.diagnostics.push(result.error);
    }
  }

  const layouts = Array.from(state.layouts.values());
  return {
    layouts,
    diagnostics: [...state.diagnostics, ...validateLayouts(layouts)],
  };
}

function collectInterfaceDeclarations(
  sourceFile: ts.SourceFile,
): Map<string, ts.InterfaceDeclaration> {
  const declarations = new Map<string, ts.InterfaceDeclaration>();

  sourceFile.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node)) {
      declarations.set(node.name.text, node);
    }
  });

  return declarations;
}

function validateSchemaSource(sourceFile: ts.SourceFile): LayoutDiagnostic[] {
  const diagnostics: LayoutDiagnostic[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      if (!isAllowedTypeOnlyImport(statement)) {
        diagnostics.push(schemaStatementDiagnostic(sourceFile, statement, "import"));
      }
      continue;
    }

    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      continue;
    }

    if (ts.isEmptyStatement(statement)) {
      continue;
    }

    diagnostics.push(schemaStatementDiagnostic(sourceFile, statement, statementKind(statement)));
  }

  return diagnostics;
}

function isAllowedTypeOnlyImport(statement: ts.ImportDeclaration): boolean {
  const moduleName = statement.moduleSpecifier;
  if (!ts.isStringLiteral(moduleName)) {
    return false;
  }

  if (moduleName.text === "@exornea/zeno-runtime") {
    return false;
  }

  const importClause = statement.importClause;
  return importClause?.isTypeOnly === true;
}

function schemaStatementDiagnostic(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  construct: string,
): LayoutDiagnostic {
  return createDiagnostic(
    sourceFile,
    node,
    "UNSUPPORTED_SCHEMA_STATEMENT",
    "Zeno schema files only support type-only imports plus interface/type declarations.",
    {
      measurement: measure(`schema ${construct}`, "typescript-syntax", "phase-0"),
      error: unsupportedAtPhase(`schema ${construct}`, "phase-0"),
    },
  );
}

function statementKind(statement: ts.Statement): string {
  if (ts.isVariableStatement(statement)) {
    return "value export";
  }

  if (ts.isFunctionDeclaration(statement)) {
    return "function declaration";
  }

  if (ts.isClassDeclaration(statement)) {
    return "class declaration";
  }

  if (ts.isEnumDeclaration(statement)) {
    return "enum declaration";
  }

  if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) {
    return "export declaration";
  }

  return ts.SyntaxKind[statement.kind] ?? "statement";
}

function lowerStruct(
  name: string,
  state: AnalyzerState,
  node: ts.Node,
): Result<StructLayout, LayoutDiagnostic> {
  const existing = state.layouts.get(name);
  if (existing !== undefined) {
    return ok(existing);
  }

  const declaration = state.declarations.get(name);
  if (declaration === undefined) {
    return err(
      createDiagnostic(
        state.sourceFile,
        node,
        "UNKNOWN_STRUCT",
        `Unknown struct type "${name}".`,
        {
          structName: name,
          error: unsupportedAtPhase(`type reference "${name}"`, "phase-0"),
        },
      ),
    );
  }

  if (state.activeStack.has(name)) {
    return err(
      createDiagnostic(
        state.sourceFile,
        declaration.name,
        "RECURSIVE_STRUCT",
        `Recursive struct "${name}" is not supported yet.`,
        {
          structName: name,
          error: unsupportedAtPhase(`recursive struct "${name}"`, "phase-0"),
        },
      ),
    );
  }

  state.activeStack.add(name);

  const fields = [];
  let runningOffset = 0;
  let alignment = 1;

  for (const member of declaration.members) {
    if (!ts.isPropertySignature(member)) {
      state.diagnostics.push(
        createDiagnostic(
          state.sourceFile,
          member,
          "UNSUPPORTED_MEMBER",
          `Struct "${name}" only supports property signatures.`,
          {
            structName: name,
            error: unsupportedAtPhase(member.getText(state.sourceFile), "phase-0"),
          },
        ),
      );
      continue;
    }

    const lowered = lowerField(member, {
      sourceFile: state.sourceFile,
      endianness: state.endianness,
      diagnostics: state.diagnostics,
      structName: name,
      lowerStructByName: (refName, refNode) => lowerStruct(refName, state, refNode),
    });
    if (!lowered.ok) {
      state.diagnostics.push(lowered.error);
      continue;
    }

    runningOffset = alignTo(runningOffset, lowered.value.alignment);
    fields.push(lowered.value.build(runningOffset));
    runningOffset += lowered.value.byteLength;
    alignment = Math.max(alignment, lowered.value.alignment);
  }

  const layout: StructLayout = {
    kind: "struct",
    name,
    fields,
    alignment,
    byteLength: alignTo(runningOffset, alignment),
    endianness: state.endianness,
  };

  state.layouts.set(name, layout);
  state.activeStack.delete(name);
  return ok(layout);
}
