export interface FixedRecordTable {
  readonly byteLength: number;
  readonly count: number;
  readonly capacity: number;
  readonly activeByteLength: number;
  readonly buffer: ArrayBuffer;
  readonly view: DataView;
  ensureCapacity(count: number): DataView;
  reset(count: number): DataView;
}

export function createFixedRecordTable(byteLength: number, initialCapacity = 0): FixedRecordTable {
  return new FixedRecordTableImpl(byteLength, initialCapacity);
}

class FixedRecordTableImpl implements FixedRecordTable {
  readonly byteLength: number;
  #count = 0;
  #capacity: number;
  #buffer: ArrayBuffer;
  #view: DataView;

  constructor(byteLength: number, initialCapacity: number) {
    assertPositiveSafeInteger(byteLength, "byteLength");
    assertNonNegativeSafeInteger(initialCapacity, "initialCapacity");

    this.byteLength = byteLength;
    this.#capacity = initialCapacity;
    this.#buffer = new ArrayBuffer(byteLength * initialCapacity);
    this.#view = new DataView(this.#buffer);
  }

  get count(): number {
    return this.#count;
  }

  get capacity(): number {
    return this.#capacity;
  }

  get activeByteLength(): number {
    return this.#count * this.byteLength;
  }

  get buffer(): ArrayBuffer {
    return this.#buffer;
  }

  get view(): DataView {
    return this.#view;
  }

  ensureCapacity(count: number): DataView {
    assertNonNegativeSafeInteger(count, "count");

    if (count <= this.#capacity) {
      return this.#view;
    }

    const nextCapacity = nextTableCapacity(this.#capacity, count);
    const nextBuffer = new ArrayBuffer(this.byteLength * nextCapacity);
    new Uint8Array(nextBuffer).set(new Uint8Array(this.#buffer));
    this.#buffer = nextBuffer;
    this.#view = new DataView(nextBuffer);
    this.#capacity = nextCapacity;
    return this.#view;
  }

  reset(count: number): DataView {
    this.ensureCapacity(count);
    this.#count = count;
    return this.#view;
  }
}

function nextTableCapacity(current: number, required: number): number {
  let capacity = Math.max(1, current);

  while (capacity < required) {
    capacity *= 2;
    if (!Number.isSafeInteger(capacity)) {
      throw new RangeError(`Table capacity exceeds safe integer range: ${required}`);
    }
  }

  return capacity;
}

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer: ${value}`);
  }
}

function assertNonNegativeSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer: ${value}`);
  }
}
