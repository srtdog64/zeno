import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("real-game metadata fixture", () => {
  it("stores only pinned HexGL metadata, not asset payload bytes", () => {
    const fixturePath = join(
      process.cwd(),
      "packages",
      "bench",
      "fixtures",
      "hexgl-asset-metadata.json",
    );
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

    expect(fixture.source).toEqual({
      name: "HexGL",
      repository: "https://github.com/BKcore/HexGL",
      commit: "6addc95a2fce3bf05f4d751823cc054c61a16d68",
      license: "MIT",
    });
    expect(fixture.note).toContain("No HexGL asset payload bytes");
    expect(fixture.records.length).toBeGreaterThan(100);
    expect(fixture.records.some((record: { kind: string }) => record.kind === "texture")).toBe(
      true,
    );
    expect(fixture.records.some((record: { kind: string }) => record.kind === "geometry")).toBe(
      true,
    );
    expect(fixture.records.some((record: { kind: string }) => record.kind === "audio")).toBe(true);
  });

  it("keeps record fields scalar-friendly for the benchmark binary layout", () => {
    const fixturePath = join(
      process.cwd(),
      "packages",
      "bench",
      "fixtures",
      "hexgl-asset-metadata.json",
    );
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

    for (const record of fixture.records) {
      expect(typeof record.path).toBe("string");
      expect(Number.isInteger(record.byteLength)).toBe(true);
      expect(record.byteLength).toBeGreaterThanOrEqual(0);
      expect(typeof fixture.kindCodes[record.kind]).toBe("number");
      expect(typeof fixture.extensionCodes[record.extension]).toBe("number");
      expect(Number.isInteger(record.pathHash)).toBe(true);
      expect(Number.isInteger(record.depth)).toBe(true);
    }
  });
});
