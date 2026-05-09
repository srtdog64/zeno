export {
  analyzeProjectionFile,
  analyzeProjectionSourceFile,
  type AnalyzeOptions,
  type AnalyzeResult,
} from "./analyzer.js";
export {
  createIrDiagnostic,
  createDiagnostic,
  formatDiagnosticLocation,
  type DiagnosticCode,
  type DiagnosticSource,
  type LayoutDiagnostic,
} from "./diagnostics.js";
export {
  MEASUREMENT_LAYERS,
  ambiguousLayout,
  duplicateDefinition,
  insufficientResolution,
  layerCanObserve,
  layoutInvariantViolation,
  measure,
  unsupportedAtPhase,
  type Measurement,
  type Phase,
  type Resolution,
  type ValidationError,
} from "./measurement.js";
export { andThen, err, isErr, isOk, mapResult, ok, type Result } from "./result.js";
export {
  emitProjectionFile,
  emitProjectionFileWithSourceMap,
  emitStructView,
  type EmitProjectionFileResult,
  type EmitOptions,
} from "./emitter.js";
export { lowerField, type LoweringContext } from "./lowering.js";
export { type ProjectionSourceMap } from "./source-map.js";
export { validateLayouts } from "./validator.js";
