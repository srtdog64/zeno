import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

function readRepoFile(path: string): string {
  return readFileSync(join(rootDir, path), "utf8");
}

function expectPhrase(documentText: string, phrase: string): void {
  const normalizedDocument = documentText.replace(/\s+/g, " ");
  const normalizedPhrase = phrase.replace(/\s+/g, " ");

  expect(normalizedDocument).toContain(normalizedPhrase);
}

describe("documentation policy", () => {
  it("documents the AST-first frontend boundary without promising full TypeChecker semantics", () => {
    const frontend = readRepoFile("docs/frontend-model.md");
    const architecture = readRepoFile("docs/architecture.md");

    expect(frontend).toContain("AST-first over a restricted schema grammar");
    expectPhrase(frontend, "not a full TypeScript semantic type parser");
    expect(frontend).toContain("Layout IR");
    expect(frontend).toContain("another frontend");
    expect(architecture).toContain("restricted schema grammar");
    expect(architecture).not.toContain("compile-time AST and type-checker analysis");
  });

  it("rejects Result on runtime hot projection paths", () => {
    const runtimeBoundary = readRepoFile("docs/runtime-boundary.md");
    const architecture = readRepoFile("docs/architecture.md");
    const apiDesign = readRepoFile("docs/api-design.md");

    for (const documentText of [runtimeBoundary, architecture, apiDesign]) {
      expectPhrase(documentText, "must not return `Result<T, E>`");
      expectPhrase(documentText, "generated scalar getters");
      expectPhrase(documentText, "scan kernels");
    }
  });

  it("keeps emitter growth forbidden by documentation policy", () => {
    const documentationRules = readRepoFile("docs/documentation-rules.md");
    const todo = readRepoFile("docs/TODO.md");

    expect(documentationRules).toContain("`packages/compiler/src/emitter.ts` is an assembly layer");
    expect(todo).toContain("do not grow `packages/compiler/src/emitter.ts`");
  });

  it("keeps release and roadmap documents aligned with the current v2.4 surface", () => {
    const architecture = readRepoFile("docs/architecture.md");
    const releaseChecklist = readRepoFile("docs/release-checklist.md");
    const todo = readRepoFile("docs/TODO.md");

    expect(architecture).toContain("Current v2.4 status");
    expect(architecture).not.toContain("Current v1 status");
    expect(todo).toContain("## Candidate Work");
    expect(todo).not.toContain("## v2.2 Candidate Work");
    expect(releaseChecklist).toContain("bench:check");
    expectPhrase(releaseChecklist, "exact timing thresholds remain diagnostic");
  });
});
