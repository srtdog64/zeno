import { ProjectionView } from "./view-base.js";

/**
 * Traverses a pointer chain by rebasing the supplied cursor in place.
 *
 * The `nextInto` callback must be alias-safe: callers should expect `current`
 * and `out` to be the same object.
 */
export function traversePointerChain<TView extends ProjectionView>(
  start: TView,
  nextInto: (current: TView, out: TView) => boolean,
  visit: (current: TView, step: number) => void,
  maxSteps: number,
): number {
  if (!Number.isInteger(maxSteps) || maxSteps < 0) {
    throw new RangeError(`maxSteps must be a non-negative integer: ${maxSteps}`);
  }

  let steps = 0;
  while (steps < maxSteps) {
    visit(start, steps);
    steps += 1;

    if (!nextInto(start, start)) {
      return steps;
    }
  }

  throw new RangeError(`Pointer traversal exceeded maxSteps=${maxSteps}`);
}
