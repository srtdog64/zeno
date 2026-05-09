import type { StructLayout } from "@exornea/zeno-schema";

export function toPascalCase(name: string): string {
  return name.slice(0, 1).toUpperCase() + name.slice(1);
}

export function toLittleEndianLiteral(layout: StructLayout): "true" | "false" {
  return layout.endianness === "little" ? "true" : "false";
}

export function encodingLiteral(encoding: "ascii" | "utf8"): '"ascii"' | '"utf8"' {
  return encoding === "ascii" ? '"ascii"' : '"utf8"';
}
