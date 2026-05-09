type Brand<T, Name extends string> = T & { readonly __zeno: Name };

export namespace z {
  export type i8 = Brand<number, "i8">;
  export type u8 = Brand<number, "u8">;
  export type i16 = Brand<number, "i16">;
  export type u16 = Brand<number, "u16">;
  export type i32 = Brand<number, "i32">;
  export type u32 = Brand<number, "u32">;
  export type f32 = Brand<number, "f32">;
  export type f64 = Brand<number, "f64">;
  export type i64 = Brand<bigint, "i64">;
  export type u64 = Brand<bigint, "u64">;
  export type bool = Brand<boolean, "bool">;

  export type enumU8<T extends string | number = string> = Brand<number, "enum_u8"> & {
    readonly __enum: T;
  };

  export type enumU16<T extends string | number = string> = Brand<number, "enum_u16"> & {
    readonly __enum: T;
  };

  export type flags8 = Brand<number, "flags8">;
  export type flags32 = Brand<number, "flags32">;
  export type timestampMs = Brand<bigint, "timestamp_ms">;

  export type fixedBytes<N extends number> = Uint8Array & {
    readonly __zeno: "fixed_bytes";
    readonly __length: N;
  };

  export type fixedUtf8<N extends number> = string & {
    readonly __zeno: "fixed_utf8";
    readonly __length: N;
  };

  export type fixedAscii<N extends number> = string & {
    readonly __zeno: "fixed_ascii";
    readonly __length: N;
  };

  export type bytes = Uint8Array & {
    readonly __zeno: "bytes";
  };

  export type utf8 = Brand<string, "utf8">;
  export type ascii = Brand<string, "ascii">;
  export type vector<T> = ReadonlyArray<T> & {
    readonly __zeno: "vector";
    readonly __element: T;
  };

  export type dynamicVector<T> = ReadonlyArray<T> & {
    readonly __zeno: "dynamic_vector";
    readonly __element: T;
  };

  export type fixedArray<T, N extends number> = ReadonlyArray<T> & {
    readonly __zeno: "fixed_array";
    readonly __element: T;
    readonly __length: N;
  };

  export type pointer<T> = Brand<number, "pointer32"> & {
    readonly __target: T;
  };
}

export type i8 = z.i8;
export type u8 = z.u8;
export type i16 = z.i16;
export type u16 = z.u16;
export type i32 = z.i32;
export type u32 = z.u32;
export type f32 = z.f32;
export type f64 = z.f64;
export type i64 = z.i64;
export type u64 = z.u64;
export type bool = z.bool;
export type enum_u8<T extends string | number = string> = z.enumU8<T>;
export type enum_u16<T extends string | number = string> = z.enumU16<T>;
export type flags8 = z.flags8;
export type flags32 = z.flags32;
export type timestamp_ms = z.timestampMs;
export type fixed_bytes<N extends number> = z.fixedBytes<N>;
export type fixed_utf8<N extends number> = z.fixedUtf8<N>;
export type fixed_ascii<N extends number> = z.fixedAscii<N>;
export type bytes = z.bytes;
export type utf8 = z.utf8;
export type ascii = z.ascii;
export type vector<T> = z.vector<T>;
export type dynamic_vector<T> = z.dynamicVector<T>;
export type fixed_array<T, N extends number> = z.fixedArray<T, N>;
export type pointer<T> = z.pointer<T>;
