# 스키마 문법

English version: [schema-grammar.md](schema-grammar.md)

이 문서는 Zeno가 지원하는 `.zeno.ts` 작성 문법을 정리합니다. Zeno
스키마는 TypeScript 전체가 아니라, `@zeno/types`의 ABI marker type을
사용하는 TypeScript 부분집합입니다.

## Claim Status

| Property | Status | Reason |
| --- | --- | --- |
| Type-only import | load-bearing | 스키마 파일은 런타임 값에 의존하면 안 됩니다. |
| Interface field | load-bearing | 필드 순서, 이름, marker type이 binary layout을 정의합니다. |
| ABI marker type | load-bearing | 폭, descriptor, pointer 정책은 명시적이어야 합니다. |
| Bare TS shorthand | diagnostic | `string`은 UTF-8 shorthand로 지원하지만, binary schema review에서는 `z.utf8`이 더 명확합니다. |
| Value declaration | rejected | 스키마 파일의 런타임 값은 codegen을 모호하고 위험하게 만듭니다. |

## 파일 형태

```ts
import type { z } from "@zeno/types";

export interface StructName {
  fieldName: z.i32;
}
```

허용되는 top-level declaration:

- type-only import,
- exported `interface` declaration,
- 지원되는 marker form으로 해석되는 exported `type` alias.

거부되는 top-level declaration:

- value import,
- `const`, `let`, `var`,
- function,
- class,
- enum,
- runtime export.

## EBNF-Lite

이 문법은 TypeScript parser grammar가 아닙니다. 파일이 이미 TypeScript로
parse된 뒤, Zeno가 받아들이는 schema subset을 설명합니다.

```txt
schema-file      ::= type-import* declaration*

type-import      ::= "import type" ... "from" "@zeno/types"

declaration      ::= interface-declaration | type-alias

interface-declaration
                 ::= "export" "interface" Identifier "{" field* "}"

field            ::= Identifier ":" field-type ";"

field-type       ::= scalar-type
                   | fixed-type
                   | dynamic-type
                   | vector-type
                   | pointer-type
                   | struct-reference
                   | string-shorthand

scalar-type      ::= z.i8 | z.u8 | z.i16 | z.u16 | z.i32 | z.u32
                   | z.i64 | z.u64 | z.f32 | z.f64 | z.bool

fixed-type       ::= z.fixedBytes<N>
                   | z.fixedUtf8<N>
                   | z.fixedAscii<N>

dynamic-type     ::= z.utf8 | z.ascii | z.bytes

vector-type      ::= z.vector<vector-element>

vector-element   ::= scalar-type
                   | fixed-type
                   | dynamic-type
                   | fixed-struct-reference
                   | pointer-type

pointer-type     ::= z.pointer<struct-reference>

struct-reference ::= Identifier

string-shorthand ::= string

N                ::= numeric-literal
```

## 지원 예시

### 고정 스칼라 레코드

```ts
import type { z } from "@zeno/types";

export interface Point {
  x: z.f32;
  y: z.f32;
  flags: z.u8;
}
```

### 동적 텍스트와 바이트

```ts
import type { z } from "@zeno/types";

export interface ArticleMeta {
  id: z.u64;
  slug: z.utf8;
  title: z.utf8;
  summary: string;
  thumbnail: z.bytes;
}
```

`summary: string`은 UTF-8 `Span32`로 내려갑니다. 다만 스키마를 binary
contract로 리뷰할 때는 `z.utf8`을 쓰는 편이 더 명확합니다.

### 고정 문자열과 벡터

```ts
import type { z } from "@zeno/types";

export interface SearchRow {
  id: z.u32;
  score: z.f32;
  locale: z.fixedAscii<8>;
  tags: z.vector<z.utf8>;
}
```

### 중첩 고정 구조체

```ts
import type { z } from "@zeno/types";

export interface Stats {
  hp: z.i32;
  mana: z.i32;
}

export interface Player {
  id: z.u64;
  stats: Stats;
}
```

중첩 struct는 고정 byte length를 가져야 합니다. 동적 필드를 가진 struct는
inline으로 중첩하지 말고 `z.pointer<T>`로 참조할 수 있습니다.

### 명시적 재귀 참조

```ts
import type { z } from "@zeno/types";

export interface Node {
  value: z.i32;
  next: z.pointer<Node>;
  children: z.vector<z.pointer<Node>>;
}
```

Pointer는 signed relative `pointer32` offset을 사용합니다. 생성된 pointer
API는 한 번에 한 edge만 이동합니다. 그래프 순회에는 명시적인 step budget이
필요합니다.

## 거부 예시

### Bare Number

```ts
export interface Bad {
  value: number;
}
```

`number`는 안정적인 ABI width가 없으므로 거부됩니다. `z.i32`, `z.u32`,
`z.f32`, `z.f64` 같은 명시적 scalar marker를 사용해야 합니다.

### Bare Array

```ts
export interface Bad {
  values: number[];
}
```

일반 TypeScript 배열은 descriptor shape와 element layout을 지정하지 않기
때문에 거부됩니다. `z.vector<T>`를 사용해야 합니다.

### 직접 재귀 구조체

```ts
export interface BadNode {
  next: BadNode;
}
```

직접 재귀는 inline size가 무한대가 되므로 거부됩니다.
`z.pointer<BadNode>`를 사용해야 합니다.

### 런타임 값

```ts
import { ProjectionView } from "@zeno/runtime";

export const runtimeValue = ProjectionView;

export interface Bad {
  id: z.u64;
}
```

`.zeno.ts` 파일은 schema-only 파일입니다. 런타임 값 import/export는
거부됩니다. `@zeno/types`에서 type-only import만 사용하세요.

## Cross-References

- Construct-to-IR mapping: [layout-ir-coarsening.md](layout-ir-coarsening.md)
- 상세 시작 가이드: [getting-started.md](getting-started.md)
- ABI contract: [abi.md](abi.md)
- Test plan: [TODO.md](TODO.md)
