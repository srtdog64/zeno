import { describe, expect, it } from "vitest";

import { ArenaEpoch, GenerationHandleTable } from "../../packages/runtime/src/index.js";

describe("runtime lifetime helpers", () => {
  it("uses arena epochs for coarse frame-level liveness", () => {
    const epoch = new ArenaEpoch();
    const frame = epoch.snapshot();

    expect(epoch.isCurrent(frame)).toBe(true);
    expect(() => epoch.assertCurrent(frame)).not.toThrow();

    epoch.bump();

    expect(epoch.isCurrent(frame)).toBe(false);
    expect(() => epoch.assertCurrent(frame)).toThrow(/Stale arena epoch/);
  });

  it("resolves live generation handles to checked byte offsets", () => {
    const table = new GenerationHandleTable();
    const view = new DataView(new ArrayBuffer(64));
    const handle = table.allocate(16, 8, 4);

    expect(table.has(handle)).toBe(true);
    expect(table.resolve(view, handle)).toBe(16);
    expect(table.resolveOrThrow(view, handle)).toBe(16);
  });

  it("rejects stale handles after release and slot reuse", () => {
    const table = new GenerationHandleTable();
    const view = new DataView(new ArrayBuffer(64));
    const oldHandle = table.allocate(16, 8, 4);

    expect(table.release(oldHandle)).toBe(true);
    expect(table.release(oldHandle)).toBe(false);
    expect(table.has(oldHandle)).toBe(false);
    expect(table.resolve(view, oldHandle)).toBeNull();
    expect(() => table.resolveOrThrow(view, oldHandle)).toThrow(/Stale or unknown handle/);

    const newHandle = table.allocate(24, 8, 4);

    expect(newHandle.slot).toBe(oldHandle.slot);
    expect(newHandle.generation).not.toBe(oldHandle.generation);
    expect(table.resolve(view, newHandle)).toBe(24);
    expect(table.resolve(view, oldHandle)).toBeNull();
  });

  it("rejects forged generations and invalid slots without throwing", () => {
    const table = new GenerationHandleTable();
    const view = new DataView(new ArrayBuffer(64));
    const handle = table.allocate(16, 8, 4);

    expect(
      table.resolve(view, { slot: handle.slot, generation: handle.generation + 1 }),
    ).toBeNull();
    expect(table.resolve(view, { slot: 999, generation: 1 })).toBeNull();
    expect(table.resolve(view, { slot: -1, generation: 1 })).toBeNull();
    expect(table.resolve(view, { slot: handle.slot, generation: 0 })).toBeNull();
  });

  it("keeps target range and alignment checks at resolve boundaries", () => {
    const table = new GenerationHandleTable();
    const shortView = new DataView(new ArrayBuffer(20));
    const handle = table.allocate(16, 8, 4);

    expect(() => table.resolve(shortView, handle)).toThrow(RangeError);
    expect(() => table.allocate(18, 8, 4)).toThrow(/aligned to 4 bytes/);
  });
});
