import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { analyzeProjectionSourceFile } from "../../packages/compiler/src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grammarDocPath = path.resolve(__dirname, "..", "..", "docs", "human", "schema-grammar.md");

interface DocExample {
  readonly sectionTitle: string;
  readonly code: string;
}

function readGrammarDoc(): string {
  return readFileSync(grammarDocPath, "utf8");
}

function extractExamples(doc: string, h2Title: string): DocExample[] {
  const lines = doc.split("\n");
  const examples: DocExample[] = [];

  let inSection = false;
  let currentTitle: string | undefined;
  let inCodeBlock = false;
  let codeFence = "";
  let codeLanguage = "";
  let codeBuffer: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      inSection = title === h2Title;
      currentTitle = undefined;
      continue;
    }

    if (!inSection) {
      continue;
    }

    if (line.startsWith("### ")) {
      currentTitle = line.slice(4).trim();
      continue;
    }

    if (!inCodeBlock) {
      const fenceMatch = /^(```+)([^\s`]*)/.exec(line);
      if (fenceMatch !== null && currentTitle !== undefined) {
        inCodeBlock = true;
        codeFence = fenceMatch[1] ?? "";
        codeLanguage = fenceMatch[2] ?? "";
        codeBuffer = [];
      }
      continue;
    }

    if (line.startsWith(codeFence)) {
      if (codeLanguage === "ts" && currentTitle !== undefined) {
        examples.push({ sectionTitle: currentTitle, code: codeBuffer.join("\n") });
      }
      inCodeBlock = false;
      codeFence = "";
      codeLanguage = "";
      codeBuffer = [];
      continue;
    }

    codeBuffer.push(line);
  }

  return examples;
}

function withSchemaImport(code: string): string {
  if (code.includes('from "@exornea/zeno-types"')) {
    return code;
  }
  return `import type { z } from "@exornea/zeno-types";\n\n${code}`;
}

function analyzeExample(example: DocExample) {
  const sourceFile = ts.createSourceFile(
    `${example.sectionTitle.replaceAll(/[^a-zA-Z0-9]/g, "-")}.zeno.ts`,
    withSchemaImport(example.code),
    ts.ScriptTarget.ES2022,
    true,
  );
  return analyzeProjectionSourceFile(sourceFile);
}

describe("schema-grammar.md doc drift", () => {
  const doc = readGrammarDoc();
  const supportedExamples = extractExamples(doc, "Supported Examples");
  const rejectedExamples = extractExamples(doc, "Rejected Examples");

  it("documents at least one supported example and one rejected example", () => {
    expect(supportedExamples.length).toBeGreaterThan(0);
    expect(rejectedExamples.length).toBeGreaterThan(0);
  });

  it.each(supportedExamples.map((example) => [example.sectionTitle, example]))(
    "supported example %s analyzes without diagnostics",
    (_title, example) => {
      const result = analyzeExample(example);
      expect(
        result.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`),
      ).toEqual([]);
      expect(result.layouts.length).toBeGreaterThan(0);
    },
  );

  it.each(rejectedExamples.map((example) => [example.sectionTitle, example]))(
    "rejected example %s produces at least one diagnostic",
    (_title, example) => {
      const result = analyzeExample(example);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    },
  );
});
