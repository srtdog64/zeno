type CodeValue = string | number | boolean | readonly string[];

/**
 * Small template helper for compiler-owned TypeScript fragments.
 *
 * Values passed to this tag must already be code fragments produced by the
 * emitter. Do not pass unchecked user strings here; schema-derived text must be
 * validated as an identifier/type name or encoded with a literal helper first.
 */
export function method(strings: TemplateStringsArray, ...values: CodeValue[]): string[] {
  return indentLines("  ", code(strings, ...values));
}

export function code(strings: TemplateStringsArray, ...values: CodeValue[]): string[] {
  let source = strings[0] ?? "";
  for (let index = 0; index < values.length; index += 1) {
    source += stringifyCodeValue(values[index]!) + strings[index + 1];
  }
  return dedent(source).split("\n");
}

function stringifyCodeValue(value: CodeValue): string {
  if (Array.isArray(value)) {
    return value.join("\n");
  }
  return String(value);
}

function indentLines(indent: string, lines: readonly string[]): string[] {
  return lines.map((line) => (line.length === 0 ? line : indent + line));
}

function dedent(source: string): string {
  const lines = trimBlankEdges(source).split("\n");
  const indent = commonIndent(lines);
  return lines.map((line) => line.slice(Math.min(indent, leadingSpaces(line)))).join("\n");
}

function trimBlankEdges(source: string): string {
  return source.replace(/^\n/, "").replace(/\n[ \t]*$/, "");
}

function commonIndent(lines: readonly string[]): number {
  const indents = lines.filter((line) => line.trim().length > 0).map((line) => leadingSpaces(line));
  return indents.length === 0 ? 0 : Math.min(...indents);
}

function leadingSpaces(line: string): number {
  return line.match(/^[ \t]*/)?.[0].length ?? 0;
}
