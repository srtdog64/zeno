export const MEASUREMENT_LAYERS = [
  "typescript-syntax",
  "typescript-type",
  "layout-ir-fixed",
  "layout-ir-dynamic",
  "emitted-view",
] as const;

export type Resolution = (typeof MEASUREMENT_LAYERS)[number];

export type Phase = "phase-0" | "phase-1" | "phase-2" | "phase-3";

export interface Measurement {
  readonly construct: string;
  readonly layer: Resolution;
  readonly phase: Phase;
}

export type MeasurementFailure =
  | {
      readonly kind: "InsufficientResolution";
      readonly construct: string;
      readonly required: Resolution;
      readonly given: Resolution;
      readonly phase?: Phase;
    }
  | {
      readonly kind: "UnsupportedAtPhase";
      readonly construct: string;
      readonly phase: Phase;
    }
  | {
      readonly kind: "AmbiguousLayout";
      readonly construct: string;
      readonly candidates: readonly string[];
    }
  | {
      readonly kind: "DuplicateDefinition";
      readonly construct: string;
      readonly first: string;
      readonly duplicate: string;
    }
  | {
      readonly kind: "LayoutInvariantViolation";
      readonly construct: string;
      readonly invariant: string;
    };

export type ValidationError = MeasurementFailure;

export function measure(
  construct: string,
  layer: Resolution,
  phase: Phase,
): Measurement {
  return { construct, layer, phase };
}

export function insufficientResolution(
  construct: string,
  required: Resolution,
  given: Resolution,
  phase?: Phase,
): MeasurementFailure {
  const failure: Omit<
    Extract<MeasurementFailure, { readonly kind: "InsufficientResolution" }>,
    "phase"
  > = {
    kind: "InsufficientResolution",
    construct,
    required,
    given,
  };

  if (phase === undefined) {
    return failure;
  }

  return { ...failure, phase };
}

export function unsupportedAtPhase(
  construct: string,
  phase: Phase,
): MeasurementFailure {
  return {
    kind: "UnsupportedAtPhase",
    construct,
    phase,
  };
}

export function ambiguousLayout(
  construct: string,
  candidates: readonly string[],
): MeasurementFailure {
  return {
    kind: "AmbiguousLayout",
    construct,
    candidates,
  };
}

export function duplicateDefinition(
  construct: string,
  first: string,
  duplicate: string,
): MeasurementFailure {
  return {
    kind: "DuplicateDefinition",
    construct,
    first,
    duplicate,
  };
}

export function layoutInvariantViolation(
  construct: string,
  invariant: string,
): MeasurementFailure {
  return {
    kind: "LayoutInvariantViolation",
    construct,
    invariant,
  };
}

export function layerCanObserve(
  given: Resolution,
  required: Resolution,
): boolean {
  return layerRank(given) >= layerRank(required);
}

function layerRank(layer: Resolution): number {
  return MEASUREMENT_LAYERS.indexOf(layer);
}
