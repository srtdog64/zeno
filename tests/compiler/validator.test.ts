import { describe, expect, it } from "vitest";

import type { StructLayout } from "../../packages/schema/src/index.js";
import { validateLayouts } from "../../packages/compiler/src/index.js";

describe("validateLayouts", () => {
  it("classifies duplicate fields as duplicate definitions with IR-derived source", () => {
    const layout: StructLayout = {
      kind: "struct",
      name: "Broken",
      byteLength: 8,
      alignment: 4,
      endianness: "little",
      fields: [
        {
          kind: "scalar",
          name: "id",
          scalar: "i32",
          offset: 0,
          byteLength: 4,
          alignment: 4,
        },
        {
          kind: "scalar",
          name: "id",
          scalar: "i32",
          offset: 4,
          byteLength: 4,
          alignment: 4,
        },
      ],
    };

    const diagnostics = validateLayouts([layout]);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("DUPLICATE_FIELD");
    expect(diagnostics[0]?.source.kind).toBe("ir-derived");
    expect(diagnostics[0]?.line).toBeUndefined();
    expect(diagnostics[0]?.error?.kind).toBe("DuplicateDefinition");
  });

  it("classifies misaligned fields as layout invariant violations", () => {
    const layout: StructLayout = {
      kind: "struct",
      name: "Broken",
      byteLength: 8,
      alignment: 4,
      endianness: "little",
      fields: [
        {
          kind: "scalar",
          name: "id",
          scalar: "i32",
          offset: 2,
          byteLength: 4,
          alignment: 4,
        },
      ],
    };

    const diagnostics = validateLayouts([layout]);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("ALIGNMENT_VIOLATION");
    expect(diagnostics[0]?.source.kind).toBe("ir-derived");
    expect(diagnostics[0]?.line).toBeUndefined();
    expect(diagnostics[0]?.error?.kind).toBe("LayoutInvariantViolation");
  });

  it("rejects struct byteLength that does not match the aligned field range", () => {
    const layout: StructLayout = {
      kind: "struct",
      name: "Broken",
      byteLength: 8,
      alignment: 4,
      endianness: "little",
      fields: [
        {
          kind: "scalar",
          name: "id",
          scalar: "i32",
          offset: 0,
          byteLength: 4,
          alignment: 4,
        },
      ],
    };

    const diagnostics = validateLayouts([layout]);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("LAYOUT_INVARIANT");
    expect(diagnostics.map((diagnostic) => diagnostic.error?.kind)).toContain(
      "LayoutInvariantViolation",
    );
  });

  it("rejects overlapping field ranges", () => {
    const layout: StructLayout = {
      kind: "struct",
      name: "Broken",
      byteLength: 8,
      alignment: 4,
      endianness: "little",
      fields: [
        {
          kind: "scalar",
          name: "wide",
          scalar: "f64",
          offset: 0,
          byteLength: 8,
          alignment: 8,
        },
        {
          kind: "scalar",
          name: "overlap",
          scalar: "i32",
          offset: 4,
          byteLength: 4,
          alignment: 4,
        },
      ],
    };

    const diagnostics = validateLayouts([layout]);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("LAYOUT_INVARIANT");
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("overlaps"))).toBe(true);
  });

  it("rejects dynamic descriptors with invalid alignment or byte length", () => {
    const layout: StructLayout = {
      kind: "struct",
      name: "Broken",
      byteLength: 8,
      alignment: 4,
      endianness: "little",
      fields: [
        {
          kind: "dynamic-string",
          name: "name",
          encoding: "utf8",
          descriptor: "span32",
          offset: 0,
          byteLength: 4,
          alignment: 1,
        },
      ],
    };

    const diagnostics = validateLayouts([layout]);

    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("descriptor"))).toBe(true);
  });

  it("rejects vector element byte lengths that do not match the element kind", () => {
    const layout: StructLayout = {
      kind: "struct",
      name: "Broken",
      byteLength: 8,
      alignment: 4,
      endianness: "little",
      fields: [
        {
          kind: "vector",
          name: "values",
          descriptor: "vector32",
          offset: 0,
          byteLength: 8,
          alignment: 4,
          element: {
            kind: "scalar",
            scalar: "i32",
            byteLength: 8,
          },
        },
      ],
    };

    const diagnostics = validateLayouts([layout]);

    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("element byte length"))).toBe(true);
  });

  it("rejects pointer fields that target unknown structs", () => {
    const layout: StructLayout = {
      kind: "struct",
      name: "Broken",
      byteLength: 4,
      alignment: 4,
      endianness: "little",
      fields: [
        {
          kind: "pointer",
          name: "next",
          descriptor: "pointer32",
          targetTypeName: "Missing",
          nullValue: 0xffffffff,
          offsetBase: "field",
          offsetEncoding: "i32",
          offset: 0,
          byteLength: 4,
          alignment: 4,
        },
      ],
    };

    const diagnostics = validateLayouts([layout]);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("UNKNOWN_STRUCT");
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("targets unknown struct"))).toBe(true);
  });

  it("rejects pointer vector elements that target unknown structs", () => {
    const layout: StructLayout = {
      kind: "struct",
      name: "Broken",
      byteLength: 8,
      alignment: 4,
      endianness: "little",
      fields: [
        {
          kind: "vector",
          name: "children",
          descriptor: "vector32",
          offset: 0,
          byteLength: 8,
          alignment: 4,
          element: {
            kind: "pointer",
            descriptor: "pointer32",
            targetTypeName: "Missing",
            byteLength: 4,
            nullValue: 0xffffffff,
            offsetBase: "element",
            offsetEncoding: "i32",
          },
        },
      ],
    };

    const diagnostics = validateLayouts([layout]);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("UNKNOWN_STRUCT");
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("targets unknown struct"))).toBe(true);
  });

  it("rejects struct vector elements that target unknown structs", () => {
    const layout: StructLayout = {
      kind: "struct",
      name: "Broken",
      byteLength: 8,
      alignment: 4,
      endianness: "little",
      fields: [
        {
          kind: "vector",
          name: "items",
          descriptor: "vector32",
          offset: 0,
          byteLength: 8,
          alignment: 4,
          element: {
            kind: "struct",
            typeName: "Missing",
            byteLength: 8,
          },
        },
      ],
    };

    const diagnostics = validateLayouts([layout]);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("UNKNOWN_STRUCT");
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("targets unknown struct"))).toBe(true);
  });

  it("rejects struct vector elements with dynamic tail fields", () => {
    const layouts: StructLayout[] = [
      {
        kind: "struct",
        name: "Item",
        byteLength: 16,
        alignment: 4,
        endianness: "little",
        fields: [
          {
            kind: "scalar",
            name: "id",
            scalar: "i32",
            offset: 0,
            byteLength: 4,
            alignment: 4,
          },
          {
            kind: "dynamic-string",
            name: "label",
            encoding: "utf8",
            descriptor: "span32",
            offset: 4,
            byteLength: 8,
            alignment: 4,
          },
        ],
      },
      {
        kind: "struct",
        name: "Bag",
        byteLength: 8,
        alignment: 4,
        endianness: "little",
        fields: [
          {
            kind: "vector",
            name: "items",
            descriptor: "vector32",
            offset: 0,
            byteLength: 8,
            alignment: 4,
            element: {
              kind: "struct",
              typeName: "Item",
              byteLength: 16,
            },
          },
        ],
      },
    ];

    const diagnostics = validateLayouts(layouts);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("LAYOUT_INVARIANT");
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("dynamic tail fields"))).toBe(true);
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("vector<pointer<T>>"))).toBe(true);
  });

  it("rejects pointer fields with incompatible ABI metadata", () => {
    const layout: StructLayout = {
      kind: "struct",
      name: "Broken",
      byteLength: 4,
      alignment: 4,
      endianness: "little",
      fields: [
        {
          kind: "pointer",
          name: "next",
          descriptor: "pointer32",
          targetTypeName: "Broken",
          nullValue: 0xffffffff,
          offsetBase: "field",
          offsetEncoding: "u32" as "i32",
          offset: 0,
          byteLength: 4,
          alignment: 4,
        },
      ],
    };

    const diagnostics = validateLayouts([layout]);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("LAYOUT_INVARIANT");
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("invalid pointer layout"))).toBe(true);
  });

  it("rejects inline struct cycles in Layout IR", () => {
    const layouts: StructLayout[] = [
      {
        kind: "struct",
        name: "A",
        byteLength: 4,
        alignment: 4,
        endianness: "little",
        fields: [
          {
            kind: "struct",
            name: "b",
            typeName: "B",
            offset: 0,
            byteLength: 4,
            alignment: 4,
          },
        ],
      },
      {
        kind: "struct",
        name: "B",
        byteLength: 4,
        alignment: 4,
        endianness: "little",
        fields: [
          {
            kind: "struct",
            name: "a",
            typeName: "A",
            offset: 0,
            byteLength: 4,
            alignment: 4,
          },
        ],
      },
    ];

    const diagnostics = validateLayouts(layouts);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RECURSIVE_STRUCT");
    expect(diagnostics.some((diagnostic) => diagnostic.message.includes("inline recursive layout"))).toBe(true);
  });
});
