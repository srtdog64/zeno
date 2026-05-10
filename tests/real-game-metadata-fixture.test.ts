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

  it("stores only pinned renderer-surface metadata for multiple public game repos", () => {
    const fixturePath = join(
      process.cwd(),
      "packages",
      "bench",
      "fixtures",
      "renderer-surface-metadata.json",
    );
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

    expect(fixture.version).toBe(1);
    expect(fixture.note).toContain("No game asset payload bytes");
    expect(
      fixture.projects.map((project: { source: { name: string } }) => project.source.name),
    ).toEqual(["HexGL", "Nemesis", "xwing", "NetHack 3D"]);

    const nethack = fixture.projects.find(
      (project: { source: { name: string } }) => project.source.name === "NetHack 3D",
    );
    expect(nethack.source.commit).toBe("22571ba3ef120a8bc076d82bec4f07853644c82a");
    expect(nethack.source.zenoRelevantShape).toContain("grid cells");
    expect(nethack.summary.countsByKind.texture).toBeGreaterThan(1000);
  });

  it("keeps renderer-surface fixture records scalar-friendly and payload-free", () => {
    const fixturePath = join(
      process.cwd(),
      "packages",
      "bench",
      "fixtures",
      "renderer-surface-metadata.json",
    );
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

    for (const project of fixture.projects) {
      expect(typeof project.summary.recordCount).toBe("number");
      expect(project.summary.recordCount).toBe(project.records.length);

      for (const record of project.records) {
        expect(typeof record.path).toBe("string");
        expect(Number.isInteger(record.byteLength)).toBe(true);
        expect(Number.isInteger(record.kindCode)).toBe(true);
        expect(Number.isInteger(record.pathHash)).toBe(true);
        expect(Number.isInteger(record.depth)).toBe(true);
        expect(record).not.toHaveProperty("content");
        expect(record).not.toHaveProperty("payload");
        expect(record).not.toHaveProperty("bytes");
        expect(fixture.kindCodes[record.kind]).toBe(record.kindCode);
      }
    }
  });
});
