import { describe, expect, it } from "vitest";

import {
  andThen,
  err,
  insufficientResolution,
  isErr,
  isOk,
  layerCanObserve,
  mapResult,
  measure,
  ok,
} from "../../packages/compiler/src/index.js";

describe("Result pattern", () => {
  it("maps and chains successful values without touching errors", () => {
    expect(mapResult(ok(2), (value) => value * 3)).toEqual(ok(6));
    expect(andThen(ok(2), (value) => ok(value * 4))).toEqual(ok(8));
    expect(mapResult(err("failed"), (value: number) => value * 3)).toEqual(err("failed"));
  });

  it("narrows ok and err variants", () => {
    expect(isOk(ok("value"))).toBe(true);
    expect(isErr(err("error"))).toBe(true);
  });
});

describe("measurement hierarchy", () => {
  it("orders observation layers from TypeScript syntax to emitted view", () => {
    expect(layerCanObserve("layout-ir-dynamic", "layout-ir-fixed")).toBe(true);
    expect(layerCanObserve("typescript-syntax", "layout-ir-fixed")).toBe(false);
  });

  it("records what layer observed a construct and why it failed", () => {
    expect(measure("number", "typescript-type", "phase-0")).toEqual({
      construct: "number",
      layer: "typescript-type",
      phase: "phase-0",
    });
    expect(
      insufficientResolution(
        "bare array syntax",
        "layout-ir-dynamic",
        "layout-ir-fixed",
        "phase-0",
      ),
    ).toEqual({
      kind: "InsufficientResolution",
      construct: "bare array syntax",
      required: "layout-ir-dynamic",
      given: "layout-ir-fixed",
      phase: "phase-0",
    });
  });
});
