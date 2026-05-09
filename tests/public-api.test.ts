import { describe, expect, it } from "vitest";

import * as compiler from "../packages/compiler/src/index.js";
import * as runtime from "../packages/runtime/src/index.js";
import * as schema from "../packages/schema/src/index.js";

describe("public package runtime exports", () => {
  it("keeps the @exornea/zeno-runtime root export surface stable", () => {
    expect(Object.keys(runtime).sort()).toMatchInlineSnapshot(`
      [
        "BytesSpanView",
        "BytesVectorView",
        "DynamicLayoutWriter",
        "DynamicStructVectorView",
        "FixedArrayView",
        "FixedBytesArrayView",
        "FixedBytesVectorView",
        "FixedScalarArrayView",
        "FixedStringArrayView",
        "FixedStringVectorView",
        "FixedStructArrayView",
        "POINTER32_BYTE_LENGTH",
        "POINTER32_NULL",
        "PointerVectorView",
        "ProjectionView",
        "SCALAR_KINDS",
        "SPAN32_BYTE_LENGTH",
        "ScalarVectorView",
        "StructVectorView",
        "Utf8SpanView",
        "Utf8VectorView",
        "VECTOR32_BYTE_LENGTH",
        "VectorView",
        "ZENO_FRAME_HEADER_BYTE_LENGTH",
        "ZENO_FRAME_LAYOUT_HASH_NONE",
        "ZENO_FRAME_VERSION_MAJOR",
        "assertZenoFrameHeader",
        "assertZenoFramePayload",
        "checkedZenoFramePayloadView",
        "decodeFixedText",
        "decodeFixedUtf8",
        "decodeText",
        "encodeText",
        "fixedBytesView",
        "readScalar",
        "readSpan32Descriptor",
        "readVector32Descriptor",
        "readZenoFrameHeader",
        "scalarByteLength",
        "traversePointerChain",
        "writeFixedBytes",
        "writeFixedText",
        "writeFixedUtf8",
        "writeScalar",
        "writeSpan32Descriptor",
        "writeVector32Descriptor",
        "writeZenoFrameHeader",
        "zenoFramePayloadView",
      ]
    `);
  });

  it("keeps the @exornea/zeno-compiler root export surface stable", () => {
    expect(Object.keys(compiler).sort()).toMatchInlineSnapshot(`
      [
        "MEASUREMENT_LAYERS",
        "ambiguousLayout",
        "analyzeProjectionFile",
        "analyzeProjectionSourceFile",
        "andThen",
        "createDiagnostic",
        "createIrDiagnostic",
        "duplicateDefinition",
        "emitProjectionFile",
        "emitStructView",
        "err",
        "formatDiagnosticLocation",
        "insufficientResolution",
        "isErr",
        "isOk",
        "layerCanObserve",
        "layoutInvariantViolation",
        "lowerField",
        "mapResult",
        "measure",
        "ok",
        "unsupportedAtPhase",
        "validateLayouts",
      ]
    `);
  });

  it("keeps the @exornea/zeno-schema runtime helper export surface stable", () => {
    expect(Object.keys(schema).sort()).toMatchInlineSnapshot(`
      [
        "POINTER32_BYTE_LENGTH",
        "POINTER32_NULL",
        "SCALAR_KINDS",
        "SPAN32_BYTE_LENGTH",
        "VECTOR32_BYTE_LENGTH",
        "alignTo",
        "scalarAlignment",
        "scalarByteLength",
        "scalarGetterMethod",
        "scalarSetterMethod",
        "scalarTsType",
      ]
    `);
  });
});
