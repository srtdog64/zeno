import { assertAlignedOffset, assertDataViewRange, assertNonNegativeInteger } from "./range.js";

export interface GenerationHandle {
  readonly slot: number;
  readonly generation: number;
}

interface HandleSlot {
  offset: number;
  byteLength: number;
  alignment: number;
  generation: number;
  occupied: boolean;
}

export class ArenaEpoch {
  private current = 1;

  snapshot(): number {
    return this.current;
  }

  bump(): number {
    this.current += 1;
    if (!Number.isSafeInteger(this.current)) {
      throw new RangeError("Arena epoch exceeded safe integer range");
    }
    return this.current;
  }

  isCurrent(snapshot: number): boolean {
    return Number.isSafeInteger(snapshot) && snapshot === this.current;
  }

  assertCurrent(snapshot: number): void {
    if (!this.isCurrent(snapshot)) {
      throw new RangeError(`Stale arena epoch: expected ${this.current}, received ${snapshot}`);
    }
  }
}

export class GenerationHandleTable {
  private readonly slots: HandleSlot[] = [];
  private readonly freeSlots: number[] = [];

  allocate(offset: number, byteLength: number, alignment = 1): GenerationHandle {
    assertHandleTarget(offset, byteLength, alignment);

    const reusedSlot = this.freeSlots.pop();
    if (reusedSlot !== undefined) {
      const slot = this.slots[reusedSlot];
      if (slot === undefined) {
        throw new RangeError(`Invalid free handle slot: ${reusedSlot}`);
      }
      slot.offset = offset;
      slot.byteLength = byteLength;
      slot.alignment = alignment;
      slot.occupied = true;
      return { slot: reusedSlot, generation: slot.generation };
    }

    const slotIndex = this.slots.length;
    this.slots.push({
      offset,
      byteLength,
      alignment,
      generation: 1,
      occupied: true,
    });
    return { slot: slotIndex, generation: 1 };
  }

  release(handle: GenerationHandle): boolean {
    const slot = this.liveSlot(handle);
    if (slot === null) {
      return false;
    }

    slot.occupied = false;
    slot.generation += 1;
    if (!Number.isSafeInteger(slot.generation)) {
      throw new RangeError("Handle generation exceeded safe integer range");
    }
    this.freeSlots.push(handle.slot);
    return true;
  }

  has(handle: GenerationHandle): boolean {
    return this.liveSlot(handle) !== null;
  }

  resolve(view: DataView, handle: GenerationHandle): number | null {
    const slot = this.liveSlot(handle);
    if (slot === null) {
      return null;
    }

    assertDataViewRange(view, slot.offset, slot.byteLength);
    assertAlignedOffset(slot.offset, slot.alignment, "handle target offset");
    return slot.offset;
  }

  resolveOrThrow(view: DataView, handle: GenerationHandle): number {
    const offset = this.resolve(view, handle);
    if (offset === null) {
      throw new RangeError(
        `Stale or unknown handle: slot=${handle.slot}, generation=${handle.generation}`,
      );
    }
    return offset;
  }

  private liveSlot(handle: GenerationHandle): HandleSlot | null {
    if (!Number.isSafeInteger(handle.slot) || handle.slot < 0) {
      return null;
    }
    if (!Number.isSafeInteger(handle.generation) || handle.generation <= 0) {
      return null;
    }

    const slot = this.slots[handle.slot];
    if (slot === undefined || !slot.occupied || slot.generation !== handle.generation) {
      return null;
    }

    return slot;
  }
}

function assertHandleTarget(offset: number, byteLength: number, alignment: number): void {
  assertNonNegativeInteger(offset, "handle target offset");
  assertNonNegativeInteger(byteLength, "handle target byteLength");
  assertAlignedOffset(offset, alignment, "handle target offset");
}
