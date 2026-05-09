import { assertNonNegativeInteger } from "./range.js";

export const POINTER32_BYTE_LENGTH = 4;
export const POINTER32_NULL = 0xffffffff;

export function pointer32RelativeOffset(
  pointerOffset: number,
  targetOffset: number,
): number {
  assertNonNegativeInteger(pointerOffset, "pointerOffset");
  assertNonNegativeInteger(targetOffset, "targetOffset");

  const relativeOffset = targetOffset - pointerOffset;
  if (
    !Number.isInteger(relativeOffset) ||
    relativeOffset < -0x8000_0000 ||
    relativeOffset > 0x7fff_ffff ||
    relativeOffset === -1
  ) {
    throw new RangeError(
      `pointer32 target offset must encode to signed i32 except -1: ${relativeOffset}`,
    );
  }

  return relativeOffset;
}
