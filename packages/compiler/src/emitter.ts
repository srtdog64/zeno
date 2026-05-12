import type { StructLayout } from "@exornea/zeno-schema";

import { emitAstCheckedSource } from "./emitter-ast.js";
import {
  collectStructDependencies,
  emitLayoutConstants,
  emitStructClass,
} from "./emitter-class.js";
import { emitInputInterface } from "./emitter-input.js";
import type { EmitOptions } from "./emitter-options.js";
import { collectRuntimeImports } from "./emitter-runtime-imports.js";
import type { ScanKernelMode } from "./emitter-scan-kernels.js";
import { createProjectionSourceMap, type ProjectionSourceMap } from "./source-map.js";

export interface EmitProjectionFileResult {
  readonly code: string;
  readonly sourceMap: ProjectionSourceMap;
}

export interface EmitProjectionFilePart {
  readonly fileName: string;
  readonly code: string;
}

export function emitStructView(layout: StructLayout, options: EmitOptions = {}): string {
  return emitProjectionFile([layout], options);
}

export function emitProjectionFile(
  layouts: readonly StructLayout[],
  options: EmitOptions = {},
): string {
  return emitAstCheckedSource(emitProjectionFileText(layouts, options), "zeno.view.ts").code;
}

function emitProjectionFileText(
  layouts: readonly StructLayout[],
  options: EmitOptions = {},
  externalImports: readonly string[] = [],
  allLayouts: readonly StructLayout[] = layouts,
): string {
  const lines: string[] = [];
  const runtimeImports = collectRuntimeImports(layouts, allLayouts);
  const layoutMap = new Map(allLayouts.map((layout) => [layout.name, layout]));
  lines.push(`import { ${runtimeImports.join(", ")} } from "@exornea/zeno-runtime";`);
  lines.push(...externalImports);
  lines.push("");

  for (const layout of layouts) {
    lines.push(...emitInputInterface(layout));
    lines.push("");
    lines.push(...emitLayoutConstants(layout));
    lines.push("");
    lines.push(...emitStructClass(layout, options, layoutMap));
    lines.push("");
  }

  return lines.join("\n");
}

export function emitProjectionFileParts(
  layouts: readonly StructLayout[],
  options: EmitOptions = {},
): EmitProjectionFilePart[] {
  const knownLayoutNames = new Set(layouts.map((layout) => layout.name));
  return layouts.map((layout) => {
    const externalImports = collectStructDependencies(layout, knownLayoutNames).map(
      (dependencyName) =>
        `import { ${dependencyName}View, type ${dependencyName}ViewInput } from "./${dependencyName}.view.js";`,
    );
    return {
      fileName: `${layout.name}.view.ts`,
      code: emitAstCheckedSource(
        emitProjectionFileText([layout], options, externalImports, layouts),
        `${layout.name}.view.ts`,
      ).code,
    };
  });
}

export function emitProjectionFileBarrel(
  layouts: readonly StructLayout[],
  importPathPrefix = ".",
): string {
  const normalizedPrefix = importPathPrefix.replace(/\\/g, "/").replace(/\/$/, "");
  const lines = layouts.map(
    (layout) => `export * from "${normalizedPrefix}/${layout.name}.view.js";`,
  );
  return emitAstCheckedSource(`${lines.join("\n")}\n`, "zeno.view.ts").code;
}

export function emitProjectionFileWithSourceMap(
  layouts: readonly StructLayout[],
  generatedFile: string,
  options: EmitOptions = {},
): EmitProjectionFileResult {
  const sourceMapUrl = `${generatedFile.split(/[\\/]/).pop() ?? generatedFile}.map`;
  const code = `${emitAstCheckedSource(emitProjectionFileText(layouts, options), generatedFile).code}\n//# sourceMappingURL=${sourceMapUrl}\n`;
  return {
    code,
    sourceMap: createProjectionSourceMap(code, layouts, generatedFile),
  };
}

export type { EmitOptions, ScanKernelMode };
