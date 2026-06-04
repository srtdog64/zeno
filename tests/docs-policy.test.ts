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
    const frontend = readRepoFile("docs/reference/frontend-model.md");
    const architecture = readRepoFile("docs/reference/architecture.md");

    expect(frontend).toContain("AST-first over a restricted schema grammar");
    expectPhrase(frontend, "not a full TypeScript semantic type parser");
    expect(frontend).toContain("Layout IR");
    expect(frontend).toContain("another frontend");
    expect(architecture).toContain("restricted schema grammar");
    expect(architecture).not.toContain("compile-time AST and type-checker analysis");
  });

  it("rejects Result on runtime hot projection paths", () => {
    const runtimeBoundary = readRepoFile("docs/reference/runtime-boundary.md");
    const architecture = readRepoFile("docs/reference/architecture.md");
    const apiDesign = readRepoFile("docs/reference/api-design.md");

    for (const documentText of [runtimeBoundary, architecture, apiDesign]) {
      expectPhrase(documentText, "must not return `Result<T, E>`");
      expectPhrase(documentText, "generated scalar getters");
      expectPhrase(documentText, "scan kernels");
    }
  });

  it("keeps emitter growth forbidden by documentation policy", () => {
    const documentationRules = readRepoFile("docs/llm/documentation-rules.md");
    const todo = readRepoFile("docs/llm/TODO.md");

    expect(documentationRules).toContain("`packages/compiler/src/emitter.ts` is an assembly layer");
    expect(todo).toContain("do not grow `packages/compiler/src/emitter.ts`");
  });

  it("keeps renderer buffer claims dependency-free and separate from WebGL wrappers", () => {
    const readme = readRepoFile("README.md");
    const todo = readRepoFile("docs/llm/TODO.md");
    const layers = readRepoFile("docs/reference/layers/README.md");
    const performance = readRepoFile("docs/human/performance-comparison.md");
    const caseStudies = readRepoFile("docs/human/renderer-buffer-case-studies.md");

    for (const documentText of [readme, todo, layers, performance]) {
      expectPhrase(documentText, "renderer-facing");
    }

    expectPhrase(todo, "must not import renderer libraries");
    expectPhrase(layers, "not a renderer framework");
    expectPhrase(
      performance,
      "not WebGL, Three.js, Babylon.js, or WebGPU as a framework dependency",
    );
    expectPhrase(
      performance,
      "Array-of-struct to typed-array conversion remains a batching/pack-kernel path",
    );
    expectPhrase(caseStudies, "The fifth package now exists as `@exornea/zeno-buffers`");
    expectPhrase(
      caseStudies,
      "Do not promote renderer upload, asset loading, ECS, or scene graph behavior",
    );
    expectPhrase(
      caseStudies,
      "Do not treat `@exornea/zeno-buffers` as a second generated scan-kernel surface",
    );
    expectPhrase(
      todo,
      "`@exornea/zeno-buffers` is the generic pack/histogram layer for caller-owned typed-array outputs",
    );
    expectPhrase(caseStudies, "NetHack 3D");
    expectPhrase(caseStudies, "grid cells, visible entities, item/monster buffers");
    expectPhrase(caseStudies, "examples/renderer-grid-buffer");
  });

  it("keeps graph indexes separate from graph serialization and editor state", () => {
    const humanReadme = readRepoFile("docs/human/README.md");
    const llmReadme = readRepoFile("docs/llm/README.md");
    const todo = readRepoFile("docs/llm/TODO.md");
    const performance = readRepoFile("docs/human/performance-comparison.md");
    const buffersIndex = readRepoFile("packages/buffers/src/index.ts");

    expectPhrase(humanReadme, "Keep the canonical graph as JSON/React Flow objects");
    expectPhrase(humanReadme, "Keep string ids in a normal JavaScript `string[]` table");
    expectPhrase(llmReadme, "Zeno may model only a rebuildable numeric graph index");
    expectPhrase(llmReadme, "Do not turn this into a general graph serializer");
    expectPhrase(todo, "not as canonical editor state or a graph serializer");
    expectPhrase(performance, "does not promote Zeno as a graph serializer");
    expectPhrase(performance, "The string id table stays outside Zeno as normal JavaScript data");
    expect(buffersIndex).not.toMatch(/Graph|graph|serializeGraph|deserializeGraph|GraphSerializer/);
  });

  it("keeps release and roadmap documents aligned with the current v2.9 surface", () => {
    const architecture = readRepoFile("docs/reference/architecture.md");
    const releaseChecklist = readRepoFile("docs/reference/release-checklist.md");
    const todo = readRepoFile("docs/llm/TODO.md");

    expect(architecture).toContain("Current v2.9 status");
    expect(architecture).not.toContain("Current v1 status");
    expect(todo).toContain("## Candidate Work");
    expect(todo).not.toContain("## v2.2 Candidate Work");
    expect(releaseChecklist).toContain("bench:check");
    expectPhrase(releaseChecklist, "exact timing thresholds remain diagnostic");
  });
});
