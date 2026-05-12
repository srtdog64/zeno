import type { FieldLayout, StructLayout } from "@exornea/zeno-schema";

import { toPascalCase } from "./emitter-names.js";

export function generatedViewByteLengthConstantName(layout: StructLayout): string {
  return `${layout.name}ViewByteLength`;
}

export function generatedViewAlignmentConstantName(layout: StructLayout): string {
  return `${layout.name}ViewAlignment`;
}

export function generatedFieldOffsetConstantName(layout: StructLayout, field: FieldLayout): string {
  return `${layout.name}View${toPascalCase(field.name)}Offset`;
}

export function generatedFieldClassMemberNames(field: FieldLayout): ReadonlySet<string> {
  const pascalName = toPascalCase(field.name);
  const names = new Set([
    field.name,
    `${field.name}Offset`,
    `${field.name}View`,
    `${field.name}Bytes`,
    `${field.name}Text`,
    `get${pascalName}`,
    `set${pascalName}`,
    `get${pascalName}At`,
    `set${pascalName}At`,
    `sum${pascalName}`,
    `min${pascalName}`,
    `max${pascalName}`,
    `count${pascalName}WhereEq`,
    `findFirst${pascalName}WhereEq`,
    `write${pascalName}`,
  ]);

  if (field.kind === "pointer") {
    names.add(`raw${pascalName}RelativeOffset`);
    names.add(`${field.name}RelativeOffset`);
    names.add(`${field.name}TargetOffset`);
    names.add(`${field.name}Into`);
    names.add(`getRaw${pascalName}RelativeOffset`);
    names.add(`get${pascalName}RelativeOffset`);
    names.add(`set${pascalName}RelativeOffset`);
    names.add(`getUnchecked${pascalName}TargetOffset`);
    names.add(`setUnchecked${pascalName}TargetOffset`);
    names.add(`get${pascalName}TargetOffset`);
    names.add(`set${pascalName}TargetOffset`);
  }

  return names;
}

export function generatedLayoutClassMemberNames(): ReadonlySet<string> {
  return new Set(["at", "write", "writeInto"]);
}
