import { describe, expect, it } from "vitest";

import {
  BytesSpanView,
  BytesVectorView,
  DynamicLayoutWriter,
  FixedBytesVectorView,
  FixedStringVectorView,
  PointerVectorView,
  ProjectionView,
  ScalarVectorView,
  Utf8SpanView,
  Utf8VectorView,
  decodeFixedText,
  encodeText,
  readScalar,
  traversePointerChain,
  writeFixedText,
  writeFixedBytes,
  writeFixedUtf8,
  writeSpan32Descriptor,
  writeScalar,
  writeVector32Descriptor,
} from "../../packages/runtime/src/index.js";

describe("dynamic layout runtime skeleton", () => {
  it("reads a span32-backed utf8 slice without copying the payload region", () => {
    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);
    const encoder = new TextEncoder();
    const payload = encoder.encode("zeno");

    writeSpan32Descriptor(view, 0, {
      relOffset: 16,
      byteLength: payload.length,
    });
    new Uint8Array(buffer, 16, payload.length).set(payload);

    const nameView = new Utf8SpanView(view, 0);

    expect(Array.from(nameView.bytes())).toEqual(Array.from(payload));
    expect(nameView.text()).toBe("zeno");
  });

  it("reads a span32-backed raw bytes slice", () => {
    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);
    const payload = Uint8Array.of(1, 2, 3, 4);

    writeSpan32Descriptor(view, 0, {
      relOffset: 16,
      byteLength: payload.length,
    });
    new Uint8Array(buffer, 16, payload.length).set(payload);

    const bytesView = new BytesSpanView(view, 0);

    expect(Array.from(bytesView.bytes())).toEqual([1, 2, 3, 4]);
  });

  it("reads a vector32-backed scalar vector by index", () => {
    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);

    writeVector32Descriptor(view, 0, {
      relOffset: 16,
      count: 3,
    });
    view.setInt32(16, 10, true);
    view.setInt32(20, 20, true);
    view.setInt32(24, 30, true);

    const vectorView = new ScalarVectorView<number>(view, 0, "i32");

    expect(vectorView.length).toBe(3);
    expect(vectorView.at(0)).toBe(10);
    expect(vectorView.at(1)).toBe(20);
    expect(vectorView.at(2)).toBe(30);
  });

  it("reads a vector of dynamic strings through span descriptors in the tail", () => {
    const buffer = new ArrayBuffer(128);
    const view = new DataView(buffer);
    const encoder = new TextEncoder();
    const red = encoder.encode("red");
    const blue = encoder.encode("blue");

    writeVector32Descriptor(view, 0, {
      relOffset: 16,
      count: 2,
    });
    writeSpan32Descriptor(view, 16, {
      relOffset: 32,
      byteLength: red.length,
    });
    writeSpan32Descriptor(view, 24, {
      relOffset: 40,
      byteLength: blue.length,
    });
    new Uint8Array(buffer, 32, red.length).set(red);
    new Uint8Array(buffer, 40, blue.length).set(blue);

    const tagsView = new Utf8VectorView(view, 0);

    expect(tagsView.length).toBe(2);
    expect(tagsView.at(0)).toBe("red");
    expect(tagsView.at(1)).toBe("blue");
  });

  it("reads a vector of raw byte slices through span descriptors", () => {
    const buffer = new ArrayBuffer(128);
    const view = new DataView(buffer);

    writeVector32Descriptor(view, 0, {
      relOffset: 16,
      count: 2,
    });
    writeSpan32Descriptor(view, 16, {
      relOffset: 32,
      byteLength: 2,
    });
    writeSpan32Descriptor(view, 24, {
      relOffset: 40,
      byteLength: 3,
    });
    new Uint8Array(buffer, 32, 2).set([7, 8]);
    new Uint8Array(buffer, 40, 3).set([9, 10, 11]);

    const chunksView = new BytesVectorView(view, 0);

    expect(chunksView.length).toBe(2);
    expect(Array.from(chunksView.at(0))).toEqual([7, 8]);
    expect(Array.from(chunksView.at(1))).toEqual([9, 10, 11]);
  });

  it("reads fixed-size byte and string vectors from contiguous payloads", () => {
    const buffer = new ArrayBuffer(128);
    const view = new DataView(buffer);
    const encoder = new TextEncoder();

    writeVector32Descriptor(view, 0, {
      relOffset: 16,
      count: 2,
    });
    new Uint8Array(buffer, 16, 4).set([1, 2, 3, 4]);
    new Uint8Array(buffer, 20, 4).set([5, 6, 7, 8]);

    writeVector32Descriptor(view, 8, {
      relOffset: 32,
      count: 2,
    });
    new Uint8Array(buffer, 32, 4).set(encoder.encode("ab"));
    new Uint8Array(buffer, 36, 4).set(encoder.encode("cd"));

    const bytesView = new FixedBytesVectorView(view, 0, 4);
    const textView = new FixedStringVectorView(view, 8, 4);

    expect(Array.from(bytesView.at(0))).toEqual([1, 2, 3, 4]);
    expect(Array.from(bytesView.at(1))).toEqual([5, 6, 7, 8]);
    expect(textView.at(0).replaceAll("\u0000", "")).toBe("ab");
    expect(textView.at(1).replaceAll("\u0000", "")).toBe("cd");
  });

  it("honors ascii encoding for fixed and vector text views", () => {
    const buffer = new ArrayBuffer(128);
    const view = new DataView(buffer);

    writeFixedText(buffer, 0, 4, "az", "ascii");
    expect(decodeFixedText(buffer, 0, 4, "ascii").replaceAll("\u0000", "")).toBe("az");
    expect(() => writeFixedText(buffer, 4, 4, "é", "ascii")).toThrow(RangeError);

    writeVector32Descriptor(view, 8, {
      relOffset: 32,
      count: 2,
    });
    new Uint8Array(buffer, 32, 4).set(encodeText("ab", "ascii"));
    new Uint8Array(buffer, 36, 4).set([0x80, 0, 0, 0]);

    const textView = new FixedStringVectorView(view, 8, 4, 0, true, "ascii");
    expect(textView.at(0).replaceAll("\u0000", "")).toBe("ab");
    expect(() => textView.at(1)).toThrow(RangeError);
  });

  it("honors ascii encoding for dynamic string spans and vectors", () => {
    const buffer = new ArrayBuffer(128);
    const view = new DataView(buffer);
    const writer = new DynamicLayoutWriter(view, 24);

    writer.writeText(0, "ascii", "ascii");
    writer.writeTextVector(8, ["aa", "bb"], "ascii");
    expect(() => writer.writeText(16, "é", "ascii")).toThrow(RangeError);

    expect(new Utf8SpanView(view, 0, 0, true, "ascii").text()).toBe("ascii");
    expect(new Utf8VectorView(view, 8, 0, true, "ascii").toArray()).toEqual([
      "aa",
      "bb",
    ]);
  });

  it("writes dynamic spans and vectors through a tail arena writer", () => {
    const buffer = new ArrayBuffer(128);
    const view = new DataView(buffer);
    const writer = new DynamicLayoutWriter(view, 16);

    writer.writeUtf8(0, "zeno");
    writer.writeUtf8Vector(8, ["ts", "view"]);

    const nameView = new Utf8SpanView(view, 0);
    const tagsView = new Utf8VectorView(view, 8);

    expect(nameView.text()).toBe("zeno");
    expect(tagsView.toArray()).toEqual(["ts", "view"]);
  });

  it("writes fixed inline regions and fixed vectors with zero padding", () => {
    const buffer = new ArrayBuffer(128);
    const view = new DataView(buffer);
    const writer = new DynamicLayoutWriter(view, 32);

    writeFixedUtf8(buffer, 0, 8, "id");
    writeFixedBytes(buffer, 8, 4, [1, 2]);
    writer.writeFixedUtf8Vector(16, ["aa", "b"], 4);
    writer.writeFixedBytesVector(24, [[3, 4], [5]], 3);

    const textVector = new FixedStringVectorView(view, 16, 4);
    const bytesVector = new FixedBytesVectorView(view, 24, 3);

    expect(new TextDecoder().decode(new Uint8Array(buffer, 0, 8)).replaceAll("\u0000", "")).toBe("id");
    expect(Array.from(new Uint8Array(buffer, 8, 4))).toEqual([1, 2, 0, 0]);
    expect(textVector.at(0).replaceAll("\u0000", "")).toBe("aa");
    expect(textVector.at(1).replaceAll("\u0000", "")).toBe("b");
    expect(Array.from(bytesVector.at(0))).toEqual([3, 4, 0]);
    expect(Array.from(bytesVector.at(1))).toEqual([5, 0, 0]);
  });

  it("writes scalar vectors through a tail arena writer", () => {
    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);
    const writer = new DynamicLayoutWriter(view, 16);

    writer.writeScalarVector(0, "i32", [10, 20, 30]);

    const vectorView = new ScalarVectorView<number>(view, 0, "i32");

    expect(vectorView.toArray()).toEqual([10, 20, 30]);
  });

  it("writes fixed-size struct vectors through a tail arena writer", () => {
    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);
    const writer = new DynamicLayoutWriter(view, 16);

    writer.writeStructVector(
      0,
      [
        { hp: 10, mana: 20 },
        { hp: 30, mana: 40 },
      ],
      8,
      (target, value, baseOffset, littleEndian) => {
        target.setInt32(baseOffset, value.hp, littleEndian);
        target.setInt32(baseOffset + 4, value.mana, littleEndian);
      },
      4,
    );

    expect(view.getUint32(0, true)).toBe(16);
    expect(view.getUint32(4, true)).toBe(2);
    expect(view.getInt32(16, true)).toBe(10);
    expect(view.getInt32(20, true)).toBe(20);
    expect(view.getInt32(24, true)).toBe(30);
    expect(view.getInt32(28, true)).toBe(40);
  });

  it("writes and reads pointer vectors with field-relative pointer32 elements", () => {
    class NodeView extends FixedBytesVectorView {
      static readonly byteLength = 8;

      constructor(view: DataView, baseOffset = 0, littleEndian = true) {
        super(view, 0, NodeView.byteLength, baseOffset, littleEndian);
      }
    }

    const buffer = new ArrayBuffer(96);
    const view = new DataView(buffer);
    const writer = new DynamicLayoutWriter(view, 16);
    view.setInt32(40, 10, true);
    view.setInt32(48, 20, true);

    writer.writePointerVector(0, [40, null, 48], NodeView.byteLength);

    const pointers = new PointerVectorView(
      view,
      0,
      NodeView.byteLength,
      (targetView, baseOffset, littleEndian) =>
        new NodeView(targetView, baseOffset, littleEndian),
    );
    const out = new NodeView(view);

    expect(pointers.length).toBe(3);
    expect(pointers.rawRelativeOffsetAt(1)).toBe(0xffffffff);
    expect(pointers.relativeOffsetAt(1)).toBeNull();
    expect(pointers.targetOffsetAt(0)).toBe(40);
    expect(pointers.targetOffsetAt(1)).toBeNull();
    expect(pointers.targetOffsetAt(2)).toBe(48);
    expect(pointers.into(0, out)).toBe(true);
    expect(out.moveToOffset(40, NodeView.byteLength)).toBe(out);
    expect(pointers.into(1, out)).toBe(false);

    const backwardWriter = new DynamicLayoutWriter(view, 64);
    backwardWriter.writePointerVector(8, [40], NodeView.byteLength);
    const backwardPointers = new PointerVectorView(
      view,
      8,
      NodeView.byteLength,
      (targetView, baseOffset, littleEndian) =>
        new NodeView(targetView, baseOffset, littleEndian),
    );

    expect(backwardPointers.targetOffsetAt(0)).toBe(40);
    expect(backwardPointers.relativeOffsetAt(0)).toBeLessThan(0);
  });

  it("rejects checked pointer vector targets outside the backing view", () => {
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);
    const writer = new DynamicLayoutWriter(view, 8);

    expect(() => writer.writePointerVector(0, [28], 8)).toThrow(RangeError);
    expect(() => (writer.writePointerVector as any)(0, [28])).toThrow(RangeError);
  });

  it("rejects a malformed descriptor corpus with out-of-range payloads", () => {
    const spanBuffer = new ArrayBuffer(64);
    const spanView = new DataView(spanBuffer);
    spanView.setUint32(0, 60, true);
    spanView.setUint32(4, 8, true);

    expect(() => new BytesSpanView(spanView, 0).bytes()).toThrow(RangeError);

    const scalarVectorBuffer = new ArrayBuffer(64);
    const scalarVectorDataView = new DataView(scalarVectorBuffer);
    scalarVectorDataView.setUint32(0, 60, true);
    scalarVectorDataView.setUint32(4, 2, true);

    expect(() =>
      new ScalarVectorView<number>(scalarVectorDataView, 0, "i32").at(1),
    ).toThrow(RangeError);

    const dynamicVectorBuffer = new ArrayBuffer(64);
    const dynamicVectorDataView = new DataView(dynamicVectorBuffer);
    dynamicVectorDataView.setUint32(0, 60, true);
    dynamicVectorDataView.setUint32(4, 1, true);

    expect(() => new Utf8VectorView(dynamicVectorDataView, 0).at(0)).toThrow(
      RangeError,
    );

    const pointerVectorBuffer = new ArrayBuffer(64);
    const pointerVectorDataView = new DataView(pointerVectorBuffer);
    pointerVectorDataView.setUint32(0, 16, true);
    pointerVectorDataView.setUint32(4, 1, true);
    pointerVectorDataView.setInt32(16, 48, true);

    expect(() =>
      new PointerVectorView(
        pointerVectorDataView,
        0,
        8,
        (targetView, baseOffset, littleEndian) =>
          new ProjectionView(targetView, baseOffset, littleEndian),
      ).targetOffsetAt(0),
    ).toThrow(RangeError);
  });

  it("rejects span descriptors at uint32 boundary values", () => {
    const cases = [
      { relOffset: 0xffffffff, byteLength: 1 },
      { relOffset: 16, byteLength: 0xffffffff },
      { relOffset: 0xfffffff0, byteLength: 0x20 },
    ] as const;

    for (const descriptor of cases) {
      const buffer = new ArrayBuffer(64);
      const view = new DataView(buffer);
      writeSpan32Descriptor(view, 0, descriptor);

      expect(() => new BytesSpanView(view, 0).bytes()).toThrow(RangeError);
    }
  });

  it("rejects vector indexes and huge count payload math safely", () => {
    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);
    writeVector32Descriptor(view, 0, {
      relOffset: 16,
      count: 0xffffffff,
    });

    const vector = new ScalarVectorView<number>(view, 0, "i32");

    expect(() => vector.at(-1)).toThrow(RangeError);
    expect(() => vector.at(1.5)).toThrow(RangeError);
    expect(() => vector.at(0xffffffff - 1)).toThrow(RangeError);
  });

  it("applies span and vector offsets relative to the object base", () => {
    const buffer = new ArrayBuffer(96);
    const view = new DataView(buffer);
    const baseOffset = 16;
    const payload = Uint8Array.of(1, 2, 3);

    writeSpan32Descriptor(view, baseOffset, {
      relOffset: 40,
      byteLength: payload.length,
    });
    new Uint8Array(buffer, baseOffset + 40, payload.length).set(payload);

    expect(Array.from(new BytesSpanView(view, 0, baseOffset).bytes())).toEqual([1, 2, 3]);

    writeVector32Descriptor(view, baseOffset + 8, {
      relOffset: 48,
      count: 2,
    });
    view.setInt32(baseOffset + 48, 10, true);
    view.setInt32(baseOffset + 52, 20, true);

    const vector = new ScalarVectorView<number>(view, 8, "i32", baseOffset);
    expect(vector.toArray()).toEqual([10, 20]);
  });

  it("rejects pointer vector targets before the object base", () => {
    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);
    writeVector32Descriptor(view, 0, {
      relOffset: 16,
      count: 1,
    });
    view.setInt32(16, -20, true);

    const pointers = new PointerVectorView(
      view,
      0,
      8,
      (targetView, baseOffset, littleEndian) =>
        new ProjectionView(targetView, baseOffset, littleEndian),
    );

    expect(() => pointers.targetOffsetAt(0)).toThrow(RangeError);
  });

  it("treats pointer32 raw max-u32 as null instead of a -1 target", () => {
    const buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);
    writeVector32Descriptor(view, 0, {
      relOffset: 16,
      count: 1,
    });
    view.setUint32(16, 0xffffffff, true);

    const pointers = new PointerVectorView(
      view,
      0,
      8,
      (targetView, baseOffset, littleEndian) =>
        new ProjectionView(targetView, baseOffset, littleEndian),
    );

    expect(pointers.rawRelativeOffsetAt(0)).toBe(0xffffffff);
    expect(pointers.relativeOffsetAt(0)).toBeNull();
    expect(pointers.targetOffsetAt(0)).toBeNull();
  });

  it("rejects a deterministic malformed descriptor fuzz corpus", () => {
    let state = 0x5eed1234;
    const next = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };

    for (let index = 0; index < 64; index += 1) {
      const spanBuffer = new ArrayBuffer(64);
      const spanView = new DataView(spanBuffer);
      writeSpan32Descriptor(spanView, 0, {
        relOffset: 48 + (next() % 32),
        byteLength: 17 + (next() % 64),
      });

      expect(() => new BytesSpanView(spanView, 0).bytes()).toThrow(RangeError);

      const scalarVectorBuffer = new ArrayBuffer(64);
      const scalarVectorView = new DataView(scalarVectorBuffer);
      writeVector32Descriptor(scalarVectorView, 0, {
        relOffset: 61 + (next() % 16),
        count: 1 + (next() % 8),
      });

      expect(() =>
        new ScalarVectorView<number>(scalarVectorView, 0, "i32").at(0),
      ).toThrow(RangeError);

      const pointerVectorBuffer = new ArrayBuffer(64);
      const pointerVectorView = new DataView(pointerVectorBuffer);
      writeVector32Descriptor(pointerVectorView, 0, {
        relOffset: 16,
        count: 1,
      });
      const pointerPayload = index % 2 === 0
        ? 96 + (next() % 256)
        : -32 - (next() % 256);
      pointerVectorView.setInt32(16, pointerPayload, true);

      expect(() =>
        new PointerVectorView(
          pointerVectorView,
          0,
          8,
          (targetView, baseOffset, littleEndian) =>
            new ProjectionView(targetView, baseOffset, littleEndian),
        ).targetOffsetAt(0),
      ).toThrow(RangeError);
    }
  });

  it("requires an explicit traversal budget for pointer chains", () => {
    class NodeCursor extends ProjectionView {
      static readonly byteLength = 8;

      constructor(view: DataView, baseOffset = 0, littleEndian = true) {
        super(view, baseOffset, littleEndian);
      }

      get value(): number {
        return this.view.getInt32(this.baseOffset, this.littleEndian);
      }

      nextInto(out: NodeCursor): boolean {
        const pointerOffset = this.baseOffset + 4;
        const raw = this.view.getUint32(pointerOffset, this.littleEndian);
        if (raw === 0xffffffff) {
          return false;
        }
        const relative = this.view.getInt32(pointerOffset, this.littleEndian);
        out.moveToOffset(pointerOffset + relative, NodeCursor.byteLength);
        return true;
      }
    }

    const buffer = new ArrayBuffer(24);
    const view = new DataView(buffer);
    view.setInt32(0, 1, true);
    view.setInt32(8, 2, true);
    view.setInt32(16, 3, true);
    view.setInt32(4, 8 - 4, true);
    view.setInt32(12, 16 - 12, true);
    view.setUint32(20, 0xffffffff, true);

    const cursor = new NodeCursor(view);
    const values: number[] = [];
    const steps = traversePointerChain(
      cursor,
      (current, out) => current.nextInto(out),
      (current) => values.push(current.value),
      3,
    );

    expect(steps).toBe(3);
    expect(values).toEqual([1, 2, 3]);

    view.setInt32(20, 0 - 20, true);
    cursor.moveToOffset(0, NodeCursor.byteLength);
    expect(() =>
      traversePointerChain(
        cursor,
        (current, out) => current.nextInto(out),
        () => undefined,
        3,
      ),
    ).toThrow(RangeError);
  });

  it("rejects tail arena writes that exceed the backing view", () => {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);
    const writer = new DynamicLayoutWriter(view, 8);

    expect(() => writer.writeUtf8(0, "this does not fit")).toThrow(RangeError);
  });

  it("rejects scalar reads and writes outside the DataView range", () => {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);

    expect(() => readScalar(view, "i32", -1)).toThrow(RangeError);
    expect(() => readScalar(view, "i32", 1)).toThrow(RangeError);
    expect(() => writeScalar(view, "i32", 1, 1)).toThrow(RangeError);
  });

  it("rejects truncated span descriptors before reading descriptor fields", () => {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);

    const spanView = new Utf8SpanView(view, 0);

    expect(() => spanView.bytes()).toThrow(RangeError);
  });

  it("rejects span payloads that point outside the backing view", () => {
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);

    writeSpan32Descriptor(view, 0, {
      relOffset: 24,
      byteLength: 16,
    });

    const spanView = new BytesSpanView(view, 0);

    expect(() => spanView.bytes()).toThrow(RangeError);
  });

  it("rejects vector payloads whose descriptor table is truncated", () => {
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);

    writeVector32Descriptor(view, 0, {
      relOffset: 28,
      count: 1,
    });

    const vectorView = new Utf8VectorView(view, 0);

    expect(() => vectorView.bytesAt(0)).toThrow(RangeError);
  });

  it("rejects vector scalar payloads outside the backing view", () => {
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);

    writeVector32Descriptor(view, 0, {
      relOffset: 28,
      count: 2,
    });

    const vectorView = new ScalarVectorView<number>(view, 0, "i32");

    expect(() => vectorView.at(1)).toThrow(RangeError);
  });

  it("rejects invalid uint32 descriptor writes", () => {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);

    expect(() =>
      writeSpan32Descriptor(view, 0, {
        relOffset: -1,
        byteLength: 1,
      }),
    ).toThrow(RangeError);
    expect(() =>
      writeVector32Descriptor(view, 0, {
        relOffset: 0,
        count: 0x1_0000_0000,
      }),
    ).toThrow(RangeError);
  });
});
