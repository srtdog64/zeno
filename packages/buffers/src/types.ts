export type UintFieldKind = "u8" | "u16" | "u32";

export interface UintFieldSpec {
  readonly offset: number;
  readonly kind: UintFieldKind;
}

export interface F32PackPlan {
  readonly byteLength: number;
  readonly fieldOffsets: readonly number[];
  readonly fieldCount: number;
  readonly maxFieldEnd: number;
}

export interface UintPackPlan {
  readonly byteLength: number;
  readonly fieldSpecs: readonly UintFieldSpec[];
  readonly fieldCount: number;
  readonly maxFieldEnd: number;
}
