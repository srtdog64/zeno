import ts from "typescript";

import {
  POINTER32_BYTE_LENGTH,
  POINTER32_NULL,
  SPAN32_BYTE_LENGTH,
  VECTOR32_BYTE_LENGTH,
  scalarAlignment,
  scalarByteLength,
  type Encoding,
  type Endianness,
  type FieldLayout,
  type ScalarKind,
  type StructLayout,
  type VectorElementLayout,
} from "@zeno/schema";

import {
  createDiagnostic,
  type LayoutDiagnostic,
} from "./diagnostics.js";
import {
  ambiguousLayout,
  insufficientResolution,
  measure,
  unsupportedAtPhase,
} from "./measurement.js";
import { err, ok, type Result } from "./result.js";

const SCALAR_NAMES = new Set<ScalarKind>([
  "i8",
  "u8",
  "i16",
  "u16",
  "i32",
  "u32",
  "i64",
  "u64",
  "f32",
  "f64",
  "bool",
]);

export interface LoweringContext {
  readonly sourceFile: ts.SourceFile;
  readonly endianness: Endianness;
  readonly lowerStructByName: (
    name: string,
    node: ts.Node,
  ) => Result<StructLayout, LayoutDiagnostic>;
  readonly diagnostics: LayoutDiagnostic[];
  readonly structName: string;
}

export interface LoweredFieldShape {
  readonly alignment: number;
  readonly byteLength: number;
  readonly build: (offset: number) => FieldLayout;
}

export function lowerField(
  property: ts.PropertySignature,
  context: LoweringContext,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  const fieldName = getPropertyName(property.name);
  if (fieldName === undefined) {
    return loweringError(
      createDiagnostic(
        context.sourceFile,
        property.name,
        "UNSUPPORTED_MEMBER",
        "Only identifier property names are supported.",
        {
          structName: context.structName,
          measurement: measure("computed property name", "typescript-syntax", "phase-0"),
          error: unsupportedAtPhase("computed property name", "phase-0"),
        },
      ),
    );
  }

  if (property.type === undefined) {
    return loweringError(
      createDiagnostic(
        context.sourceFile,
        property,
        "MISSING_TYPE",
        `Field "${fieldName}" must have an explicit type annotation.`,
        {
          structName: context.structName,
          fieldName,
          measurement: measure("implicit property type", "typescript-syntax", "phase-0"),
          error: insufficientResolution(
            "implicit property type",
            "typescript-type",
            "typescript-syntax",
            "phase-0",
          ),
        },
      ),
    );
  }

  if (property.questionToken !== undefined) {
    return loweringError(
      createDiagnostic(
        context.sourceFile,
        property.questionToken,
        "UNSUPPORTED_MEMBER",
        `Field "${fieldName}" uses optional property syntax. Optional fields need a schema-evolution policy.`,
        {
          structName: context.structName,
          fieldName,
          measurement: measure("optional property", "typescript-syntax", "phase-0"),
          error: unsupportedAtPhase("optional property", "phase-0"),
        },
      ),
    );
  }

  return lowerTypeNode(property.type, fieldName, context);
}

function lowerTypeNode(
  typeNode: ts.TypeNode,
  fieldName: string,
  context: LoweringContext,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  const syntaxResult = lowerSyntaxTypeNode(typeNode, fieldName, context);
  if (syntaxResult !== undefined) {
    return syntaxResult;
  }

  if (!ts.isTypeReferenceNode(typeNode)) {
    return loweringError(
      createDiagnostic(
        context.sourceFile,
        typeNode,
        "UNSUPPORTED_TYPE",
        `Field "${fieldName}" has an unsupported type expression.`,
        {
          structName: context.structName,
          fieldName,
          measurement: measure(typeNode.getText(context.sourceFile), "typescript-syntax", "phase-0"),
          error: unsupportedAtPhase(typeNode.getText(context.sourceFile), "phase-0"),
        },
      ),
    );
  }

  const referenceName = getReferenceName(typeNode.typeName);
  if (referenceName === undefined) {
    return loweringError(
      createDiagnostic(
        context.sourceFile,
        typeNode,
        "UNSUPPORTED_TYPE",
        `Field "${fieldName}" has an unsupported qualified type name.`,
        {
          structName: context.structName,
          fieldName,
          measurement: measure(typeNode.getText(context.sourceFile), "typescript-syntax", "phase-0"),
          error: unsupportedAtPhase(typeNode.getText(context.sourceFile), "phase-0"),
        },
      ),
    );
  }

  return lowerTypeReferenceNode(typeNode, referenceName, fieldName, context);
}

function lowerSyntaxTypeNode(
  typeNode: ts.TypeNode,
  fieldName: string,
  context: LoweringContext,
): Result<LoweredFieldShape, LayoutDiagnostic> | undefined {
  switch (typeNode.kind) {
    case ts.SyntaxKind.NumberKeyword:
      return unsupportedNumberType(typeNode, fieldName, context);
    case ts.SyntaxKind.StringKeyword:
      return lowerBareStringType(fieldName);
    case ts.SyntaxKind.ArrayType:
      return unsupportedBareArrayType(typeNode, fieldName, context);
    default:
      return undefined;
  }
}

function unsupportedNumberType(
  typeNode: ts.TypeNode,
  fieldName: string,
  context: LoweringContext,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  return loweringError(
    createDiagnostic(
      context.sourceFile,
      typeNode,
      "UNSUPPORTED_NUMBER",
      `Field "${fieldName}" uses bare "number". Use a branded scalar alias such as i32 or f64.`,
      {
        structName: context.structName,
        fieldName,
        measurement: measure("number", "typescript-type", "phase-0"),
        error: ambiguousLayout("number", [
          "i8",
          "u8",
          "i16",
          "u16",
          "i32",
          "u32",
          "f32",
          "f64",
        ]),
      },
    ),
  );
}

function lowerBareStringType(fieldName: string): Result<LoweredFieldShape, LayoutDiagnostic> {
  return ok({
    alignment: 4,
    byteLength: SPAN32_BYTE_LENGTH,
    build: (offset) => ({
      kind: "dynamic-string",
      name: fieldName,
      offset,
      alignment: 4,
      byteLength: SPAN32_BYTE_LENGTH,
      encoding: "utf8",
      descriptor: "span32",
    }),
  });
}

function unsupportedBareArrayType(
  typeNode: ts.TypeNode,
  fieldName: string,
  context: LoweringContext,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  return loweringError(
    createDiagnostic(
      context.sourceFile,
      typeNode,
      "UNSUPPORTED_ARRAY",
      `Field "${fieldName}" uses bare array syntax. Use vector<T> instead.`,
      {
        structName: context.structName,
        fieldName,
        measurement: measure("bare array syntax", "typescript-syntax", "phase-0"),
        error: insufficientResolution(
          "bare array syntax",
          "layout-ir-dynamic",
          "layout-ir-fixed",
          "phase-0",
        ),
      },
    ),
  );
}

function lowerTypeReferenceNode(
  typeNode: ts.TypeReferenceNode,
  referenceName: string,
  fieldName: string,
  context: LoweringContext,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  if (SCALAR_NAMES.has(referenceName as ScalarKind)) {
    return lowerScalarReference(referenceName as ScalarKind, fieldName);
  }

  if (referenceName === "fixed_bytes" || referenceName === "fixedBytes") {
    return lowerFixedBytesReference(typeNode, fieldName, context);
  }

  if (
    referenceName === "fixed_utf8" ||
    referenceName === "fixed_ascii" ||
    referenceName === "fixedUtf8" ||
    referenceName === "fixedAscii"
  ) {
    return lowerFixedStringReference(typeNode, referenceName, fieldName, context);
  }

  if (referenceName === "utf8" || referenceName === "ascii") {
    return lowerDynamicStringReference(referenceName, fieldName);
  }

  if (referenceName === "bytes") {
    return lowerDynamicBytesReference(fieldName);
  }

  if (referenceName === "vector") {
    return lowerVectorReference(typeNode, fieldName, context);
  }

  if (referenceName === "pointer") {
    return lowerPointerReference(typeNode, fieldName, context);
  }

  return lowerStructReference(typeNode, referenceName, fieldName, context);
}

function lowerScalarReference(
  scalar: ScalarKind,
  fieldName: string,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  return ok({
    alignment: scalarAlignment(scalar),
    byteLength: scalarByteLength(scalar),
    build: (offset) => ({
      kind: "scalar",
      name: fieldName,
      scalar,
      offset,
      alignment: scalarAlignment(scalar),
      byteLength: scalarByteLength(scalar),
    }),
  });
}

function lowerFixedBytesReference(
  typeNode: ts.TypeReferenceNode,
  fieldName: string,
  context: LoweringContext,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  const byteLength = extractNumericTypeArg(typeNode, fieldName, context);
  if (!byteLength.ok) {
    return byteLength;
  }

  return ok({
    alignment: 1,
    byteLength: byteLength.value,
    build: (offset) => ({
      kind: "fixed-bytes",
      name: fieldName,
      offset,
      alignment: 1,
      byteLength: byteLength.value,
    }),
  });
}

function lowerFixedStringReference(
  typeNode: ts.TypeReferenceNode,
  referenceName: string,
  fieldName: string,
  context: LoweringContext,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  const byteLength = extractNumericTypeArg(typeNode, fieldName, context);
  if (!byteLength.ok) {
    return byteLength;
  }

  const encoding = fixedStringEncoding(referenceName);
  return ok({
    alignment: 1,
    byteLength: byteLength.value,
    build: (offset) => ({
      kind: "fixed-string",
      name: fieldName,
      offset,
      alignment: 1,
      byteLength: byteLength.value,
      encoding,
    }),
  });
}

function lowerDynamicStringReference(
  encoding: Encoding,
  fieldName: string,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  return ok({
    alignment: 4,
    byteLength: SPAN32_BYTE_LENGTH,
    build: (offset) => ({
      kind: "dynamic-string",
      name: fieldName,
      offset,
      alignment: 4,
      byteLength: SPAN32_BYTE_LENGTH,
      encoding,
      descriptor: "span32",
    }),
  });
}

function lowerDynamicBytesReference(
  fieldName: string,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  return ok({
    alignment: 4,
    byteLength: SPAN32_BYTE_LENGTH,
    build: (offset) => ({
      kind: "dynamic-bytes",
      name: fieldName,
      offset,
      alignment: 4,
      byteLength: SPAN32_BYTE_LENGTH,
      descriptor: "span32",
    }),
  });
}

function lowerVectorReference(
  typeNode: ts.TypeReferenceNode,
  fieldName: string,
  context: LoweringContext,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  const element = lowerVectorElement(typeNode, fieldName, context);
  if (!element.ok) {
    return element;
  }

  return ok({
    alignment: 4,
    byteLength: VECTOR32_BYTE_LENGTH,
    build: (offset) => ({
      kind: "vector",
      name: fieldName,
      offset,
      alignment: 4,
      byteLength: VECTOR32_BYTE_LENGTH,
      descriptor: "vector32",
      element: element.value,
    }),
  });
}

function lowerPointerReference(
  typeNode: ts.TypeReferenceNode,
  fieldName: string,
  context: LoweringContext,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  const targetTypeName = extractReferenceTypeArg(typeNode, fieldName, context);
  if (!targetTypeName.ok) {
    return targetTypeName;
  }

  return ok({
    alignment: 4,
    byteLength: POINTER32_BYTE_LENGTH,
    build: (offset) => ({
      kind: "pointer",
      name: fieldName,
      offset,
      alignment: 4,
      byteLength: POINTER32_BYTE_LENGTH,
      descriptor: "pointer32",
      targetTypeName: targetTypeName.value,
      nullValue: POINTER32_NULL,
      offsetBase: "field",
      offsetEncoding: "i32",
    }),
  });
}

function lowerStructReference(
  typeNode: ts.TypeReferenceNode,
  referenceName: string,
  fieldName: string,
  context: LoweringContext,
): Result<LoweredFieldShape, LayoutDiagnostic> {
  const structLayout = context.lowerStructByName(referenceName, typeNode);
  if (!structLayout.ok) {
    return structLayout;
  }

  return ok({
    alignment: structLayout.value.alignment,
    byteLength: structLayout.value.byteLength,
    build: (offset) => ({
      kind: "struct",
      name: fieldName,
      offset,
      alignment: structLayout.value.alignment,
      byteLength: structLayout.value.byteLength,
      typeName: structLayout.value.name,
    }),
  });
}

function fixedStringEncoding(referenceName: string): Encoding {
  return referenceName === "fixed_ascii" || referenceName === "fixedAscii"
    ? "ascii"
    : "utf8";
}

function lowerVectorElement(
  vectorType: ts.TypeReferenceNode,
  fieldName: string,
  context: LoweringContext,
): Result<VectorElementLayout, LayoutDiagnostic> {
  const [elementType] = vectorType.typeArguments ?? [];
  if (elementType === undefined) {
    return missingVectorElementType(vectorType, fieldName, context);
  }

  return lowerVectorElementType(elementType, fieldName, context);
}

function lowerVectorElementType(
  elementType: ts.TypeNode,
  fieldName: string,
  context: LoweringContext,
): Result<VectorElementLayout, LayoutDiagnostic> {
  if (ts.isArrayTypeNode(elementType)) {
    return nestedBareArrayElement(elementType, fieldName, context);
  }

  if (elementType.kind === ts.SyntaxKind.StringKeyword) {
    return lowerDynamicStringVectorElement("utf8");
  }

  if (!ts.isTypeReferenceNode(elementType)) {
    return unsupportedVectorElementType(elementType, fieldName, context);
  }

  const referenceName = getReferenceName(elementType.typeName);
  if (referenceName === undefined) {
    return unsupportedQualifiedVectorElementType(elementType, fieldName, context);
  }

  return lowerVectorElementReference(elementType, referenceName, fieldName, context);
}

function missingVectorElementType(
  vectorType: ts.TypeReferenceNode,
  fieldName: string,
  context: LoweringContext,
): Result<VectorElementLayout, LayoutDiagnostic> {
  return loweringError(
    createDiagnostic(
      context.sourceFile,
      vectorType,
      "UNSUPPORTED_TYPE",
      `Field "${fieldName}" must provide a vector element type.`,
      {
        structName: context.structName,
        fieldName,
        measurement: measure("vector without element type", "typescript-type", "phase-0"),
        error: insufficientResolution(
          "vector without element type",
          "typescript-type",
          "typescript-syntax",
          "phase-0",
        ),
      },
    ),
  );
}

function nestedBareArrayElement(
  elementType: ts.ArrayTypeNode,
  fieldName: string,
  context: LoweringContext,
): Result<VectorElementLayout, LayoutDiagnostic> {
  return loweringError(
    createDiagnostic(
      context.sourceFile,
      elementType,
      "UNSUPPORTED_ARRAY",
      `Field "${fieldName}" cannot nest bare arrays inside vector<T>.`,
      {
        structName: context.structName,
        fieldName,
        measurement: measure("nested bare array", "typescript-syntax", "phase-0"),
        error: unsupportedAtPhase("nested bare array", "phase-0"),
      },
    ),
  );
}

function unsupportedVectorElementType(
  elementType: ts.TypeNode,
  fieldName: string,
  context: LoweringContext,
): Result<VectorElementLayout, LayoutDiagnostic> {
  return loweringError(
    createDiagnostic(
      context.sourceFile,
      elementType,
      "UNSUPPORTED_TYPE",
      `Field "${fieldName}" has an unsupported vector element type.`,
      {
        structName: context.structName,
        fieldName,
        measurement: measure(elementType.getText(context.sourceFile), "typescript-syntax", "phase-0"),
        error: unsupportedAtPhase(elementType.getText(context.sourceFile), "phase-0"),
      },
    ),
  );
}

function unsupportedQualifiedVectorElementType(
  elementType: ts.TypeReferenceNode,
  fieldName: string,
  context: LoweringContext,
): Result<VectorElementLayout, LayoutDiagnostic> {
  return loweringError(
    createDiagnostic(
      context.sourceFile,
      elementType,
      "UNSUPPORTED_TYPE",
      `Field "${fieldName}" has an unsupported qualified vector element type.`,
      {
        structName: context.structName,
        fieldName,
        measurement: measure(elementType.getText(context.sourceFile), "typescript-syntax", "phase-0"),
        error: unsupportedAtPhase(elementType.getText(context.sourceFile), "phase-0"),
      },
    ),
  );
}

function lowerVectorElementReference(
  elementType: ts.TypeReferenceNode,
  referenceName: string,
  fieldName: string,
  context: LoweringContext,
): Result<VectorElementLayout, LayoutDiagnostic> {
  if (SCALAR_NAMES.has(referenceName as ScalarKind)) {
    return lowerScalarVectorElement(referenceName as ScalarKind);
  }

  if (referenceName === "fixed_bytes" || referenceName === "fixedBytes") {
    return lowerFixedBytesVectorElement(elementType, fieldName, context);
  }

  if (
    referenceName === "fixed_utf8" ||
    referenceName === "fixed_ascii" ||
    referenceName === "fixedUtf8" ||
    referenceName === "fixedAscii"
  ) {
    return lowerFixedStringVectorElement(elementType, referenceName, fieldName, context);
  }

  if (referenceName === "utf8" || referenceName === "ascii") {
    return lowerDynamicStringVectorElement(referenceName);
  }

  if (referenceName === "bytes") {
    return lowerDynamicBytesVectorElement();
  }

  if (referenceName === "pointer") {
    return lowerPointerVectorElement(elementType, fieldName, context);
  }

  return lowerStructVectorElement(elementType, referenceName, context);
}

function lowerScalarVectorElement(
  scalar: ScalarKind,
): Result<VectorElementLayout, LayoutDiagnostic> {
  return ok({
    kind: "scalar",
    scalar,
    byteLength: scalarByteLength(scalar),
  });
}

function lowerFixedBytesVectorElement(
  elementType: ts.TypeReferenceNode,
  fieldName: string,
  context: LoweringContext,
): Result<VectorElementLayout, LayoutDiagnostic> {
  const byteLength = extractNumericTypeArg(elementType, fieldName, context);
  if (!byteLength.ok) {
    return byteLength;
  }
  return ok({
    kind: "fixed-bytes",
    byteLength: byteLength.value,
  });
}

function lowerFixedStringVectorElement(
  elementType: ts.TypeReferenceNode,
  referenceName: string,
  fieldName: string,
  context: LoweringContext,
): Result<VectorElementLayout, LayoutDiagnostic> {
  const byteLength = extractNumericTypeArg(elementType, fieldName, context);
  if (!byteLength.ok) {
    return byteLength;
  }
  return ok({
    kind: "fixed-string",
    encoding: fixedStringEncoding(referenceName),
    byteLength: byteLength.value,
  });
}

function lowerDynamicStringVectorElement(
  encoding: Encoding,
): Result<VectorElementLayout, LayoutDiagnostic> {
  return ok({
    kind: "dynamic-string",
    encoding,
    descriptor: "span32",
    byteLength: SPAN32_BYTE_LENGTH,
  });
}

function lowerDynamicBytesVectorElement(): Result<VectorElementLayout, LayoutDiagnostic> {
  return ok({
    kind: "dynamic-bytes",
    descriptor: "span32",
    byteLength: SPAN32_BYTE_LENGTH,
  });
}

function lowerPointerVectorElement(
  elementType: ts.TypeReferenceNode,
  fieldName: string,
  context: LoweringContext,
): Result<VectorElementLayout, LayoutDiagnostic> {
  const targetTypeName = extractReferenceTypeArg(elementType, fieldName, context);
  if (!targetTypeName.ok) {
    return targetTypeName;
  }

  return ok({
    kind: "pointer",
    descriptor: "pointer32",
    targetTypeName: targetTypeName.value,
    byteLength: POINTER32_BYTE_LENGTH,
    nullValue: POINTER32_NULL,
    offsetBase: "element",
    offsetEncoding: "i32",
  });
}

function lowerStructVectorElement(
  elementType: ts.TypeReferenceNode,
  referenceName: string,
  context: LoweringContext,
): Result<VectorElementLayout, LayoutDiagnostic> {
  const structLayout = context.lowerStructByName(referenceName, elementType);
  if (!structLayout.ok) {
    return structLayout;
  }

  return ok({
    kind: "struct",
    typeName: structLayout.value.name,
    byteLength: structLayout.value.byteLength,
  });
}

function extractNumericTypeArg(
  typeNode: ts.TypeReferenceNode,
  fieldName: string,
  context: LoweringContext,
): Result<number, LayoutDiagnostic> {
  const [arg] = typeNode.typeArguments ?? [];
  if (
    arg !== undefined &&
    ts.isLiteralTypeNode(arg) &&
    ts.isNumericLiteral(arg.literal)
  ) {
    return ok(Number(arg.literal.text));
  }

  return loweringError(
      createDiagnostic(
      context.sourceFile,
      typeNode,
      "NON_NUMERIC_LENGTH",
      `Field "${fieldName}" must use a numeric literal length.`,
      {
        structName: context.structName,
        fieldName,
        measurement: measure(
          `${getReferenceName(typeNode.typeName) ?? "type"} length`,
          "typescript-type",
          "phase-0",
        ),
        error: insufficientResolution(
          `${getReferenceName(typeNode.typeName) ?? "type"} length`,
          "layout-ir-fixed",
          "typescript-type",
          "phase-0",
        ),
      },
    ),
  );
}

function extractReferenceTypeArg(
  typeNode: ts.TypeReferenceNode,
  fieldName: string,
  context: LoweringContext,
): Result<string, LayoutDiagnostic> {
  const [arg] = typeNode.typeArguments ?? [];
  if (arg !== undefined && ts.isTypeReferenceNode(arg)) {
    const referenceName = getReferenceName(arg.typeName);
    if (referenceName !== undefined) {
      return ok(referenceName);
    }
  }

  return loweringError(
      createDiagnostic(
      context.sourceFile,
      typeNode,
      "UNSUPPORTED_TYPE",
      `Field "${fieldName}" must use pointer<T> with a named struct target.`,
      {
        structName: context.structName,
        fieldName,
        measurement: measure("pointer target", "typescript-type", "phase-0"),
        error: insufficientResolution(
          "pointer target",
          "layout-ir-fixed",
          "typescript-type",
          "phase-0",
        ),
      },
    ),
  );
}

function loweringError<T>(diagnostic: LayoutDiagnostic): Result<T, LayoutDiagnostic> {
  return err(diagnostic);
}

function getReferenceName(typeName: ts.EntityName): string | undefined {
  if (ts.isIdentifier(typeName)) {
    return typeName.text;
  }

  if (ts.isQualifiedName(typeName)) {
    return typeName.right.text;
  }

  return undefined;
}

function getPropertyName(propertyName: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName)) {
    return propertyName.text;
  }

  return undefined;
}
