# ��Ű�� ����

English version: [schema-grammar.md](schema-grammar.md)

�� ������ Zeno�� �����ϴ� `.zeno.ts` �ۼ� ������ �����մϴ�. Zeno
��Ű���� ��ü TypeScript�� �ƴ϶� `@exornea/zeno-types`�� ABI marker
type�� ����ϴ� TypeScript �κ������Դϴ�.

## Claim Status

| Property          | Status       | Reason                                                                                     |
| ----------------- | ------------ | ------------------------------------------------------------------------------------------ |
| Type-only import  | load-bearing | ��Ű�� ������ ��Ÿ�� ���� �����ϸ� �� �˴ϴ�.                                                   |
| Interface field   | load-bearing | �ʵ� ����, �̸�, marker type�� binary layout�� �����մϴ�.                                      |
| ABI marker type   | load-bearing | ��, descriptor, pointer ��å�� �������̾�� �մϴ�.                                              |
| Bare TS shorthand | diagnostic   | `string`�� UTF-8 shorthand�� ����������, binary schema review������ `z.utf8`�� �� ��Ȯ�մϴ�. |
| Value declaration | rejected     | ��Ű�� ������ ��Ÿ�� ���� codegen�� ��ȣ�ϰ� �����ϰ� ����ϴ�.                                   |

## ���� ����

```ts
import type { z } from "@exornea/zeno-types";

export interface StructName {
  fieldName: z.i32;
}
```

���Ǵ� top-level declaration:

- type-only import,
- exported `interface` declaration,
- �����Ǵ� marker form���� �ؼ��Ǵ� exported `type` alias.

�źεǴ� top-level declaration:

- value import,
- `const`, `let`, `var`,
- function,
- class,
- enum,
- runtime export.

## EBNF-Lite

�� ������ TypeScript parser grammar�� �ƴմϴ�. ������ �̹� TypeScript��
parse�� �� Zeno�� �޾Ƶ��̴� schema subset�� �����մϴ�.

```txt
schema-file      ::= type-import* declaration*

type-import      ::= "import type" ... "from" "@exornea/zeno-types"

declaration      ::= interface-declaration | type-alias

interface-declaration
                 ::= "export" "interface" Identifier "{" field* "}"

field            ::= Identifier ":" field-type ";"

field-type       ::= scalar-type
                   | scalar-alias-type
                   | fixed-type
                   | fixed-array-type
                   | dynamic-type
                   | vector-type
                   | pointer-type
                   | struct-reference
                   | string-shorthand

scalar-type      ::= z.i8 | z.u8 | z.i16 | z.u16 | z.i32 | z.u32
                   | z.i64 | z.u64 | z.f32 | z.f64 | z.bool

scalar-alias-type
                 ::= z.enumU8<T> | z.enumU16<T>
                   | z.flags8 | z.flags32 | z.timestampMs

fixed-type       ::= z.fixedBytes<N>
                   | z.fixedUtf8<N>
                   | z.fixedAscii<N>

fixed-array-type ::= z.fixedArray<fixed-array-element, N>

fixed-array-element
                 ::= scalar-type
                   | scalar-alias-type
                   | fixed-type
                   | fixed-struct-reference

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

## ���� ����

### ���� ��Į�� ���ڵ�

```ts
import type { z } from "@exornea/zeno-types";

export interface Point {
  x: z.f32;
  y: z.f32;
  flags: z.u8;
}
```

### ���� �ؽ�Ʈ�� ����Ʈ

```ts
import type { z } from "@exornea/zeno-types";

export interface ArticleMeta {
  id: z.u64;
  slug: z.utf8;
  title: z.utf8;
  summary: string;
  thumbnail: z.bytes;
}
```

`summary: string`�� UTF-8 `Span32`�� �������ϴ�. �ٸ� ��Ű���� binary
contract�� ������ ���� `z.utf8`�� ���� ���� �� ��Ȯ�մϴ�.

### ���� ���ڿ��� ����

```ts
import type { z } from "@exornea/zeno-types";

export interface SearchRow {
  id: z.u32;
  score: z.f32;
  locale: z.fixedAscii<8>;
  tags: z.vector<z.utf8>;
}
```

### �ǹ� alias�� ���� �迭

```ts
import type { z } from "@exornea/zeno-types";

export interface Point {
  x: z.f32;
  y: z.f32;
}

export interface Metrics {
  kind: z.enumU8<"cpu" | "gpu">;
  flags: z.flags32;
  createdAt: z.timestampMs;
  samples: z.fixedArray<z.f32, 3>;
  labels: z.fixedArray<z.fixedAscii<4>, 2>;
  points: z.fixedArray<Point, 2>;
}
```

�ǹ� alias�� ���� scalar ABI�� �������ϴ�. `fixedArray<T, N>`�� `Vector32`
descriptor�� �ƴ϶� head �ȿ� ���� inline fixed-layout �����Դϴ�.

### ��ø ���� ����ü

```ts
import type { z } from "@exornea/zeno-types";

export interface Stats {
  hp: z.i32;
  mana: z.i32;
}

export interface Player {
  id: z.u64;
  stats: Stats;
}
```

��ø struct�� ���� byte length�� ������ �մϴ�. ���� �ʵ带 ���� struct��
inline���� ��ø���� ���� `z.pointer<T>`�� ������ �� �ֽ��ϴ�.

### ������ ��� ����

```ts
import type { z } from "@exornea/zeno-types";

export interface Node {
  value: z.i32;
  next: z.pointer<Node>;
  children: z.vector<z.pointer<Node>>;
}
```

Pointer�� signed relative `pointer32` offset�� ����մϴ�. ������ pointer
API�� �� ���� �� edge�� �̵��մϴ�. �׷��� ��ȸ���� �������� step budget��
�ʿ��մϴ�.

### ���� ����ü ����

```ts
import type { z } from "@exornea/zeno-types";

export interface Item {
  id: z.i32;
  label: z.utf8;
}

export interface Bag {
  items: z.dynamicVector<Item>;
}
```

`dynamicVector<T>`�� ���� tail �ʵ带 ���� struct element�� ���� �����Դϴ�.
`Vector32` offset table�� �������� `DynamicStructVectorView`�� �����մϴ�.
Writer helper�� parent arena���� element head�� �����ϰ�, ��ø ���� descriptor��
�� element base �������� ���ϴ�.

## �ź� ����

### Bare Number

```ts
export interface Bad {
  value: number;
}
```

`number`���� �������� ABI width�� �����Ƿ� �źε˴ϴ�. `z.i32`, `z.u32`,
`z.f32`, `z.f64` ���� ������ scalar marker�� ����ؾ� �մϴ�.

### Bare Array

```ts
export interface Bad {
  values: number[];
}
```

�Ϲ� TypeScript �迭�� descriptor shape�� element layout�� �������� �ʱ� ������
�źε˴ϴ�. `z.vector<T>`�� ����ؾ� �մϴ�.

### ���� ��� ����ü

```ts
export interface BadNode {
  next: BadNode;
}
```

���� ��ʹ� inline size�� ���Ѵ밡 �ǹǷ� �źε˴ϴ�. `z.pointer<BadNode>`��
����ؾ� �մϴ�.

### Optional Field

```ts
export interface Bad {
  nickname?: z.utf8;
}
```

optional field�� schema evolution/vtable ��å�� �ʿ��ϹǷ� �źε˴ϴ�. Zeno��
TypeScript optional ������ inline nullable field�� �ؼ����� �ʽ��ϴ�.

### Union Field

```ts
export interface Bad {
  value: z.i32 | z.utf8;
}
```

union�� �������� discriminator ABI�� �ʿ��ϹǷ� �źε˴ϴ�. ���� �����Ϸ���
tag field�� fixed variant table�� ���� �����ؾ� �մϴ�.

### ��Ÿ�� ��

```ts
import { ProjectionView } from "@exornea/zeno-runtime";

export const runtimeValue = ProjectionView;

export interface Bad {
  id: z.u64;
}
```

`.zeno.ts` ������ schema-only �����Դϴ�. ��Ÿ�� �� import/export�� �źεǸ�
`@exornea/zeno-types`���� type-only import�� ����ؾ� �մϴ�.

## Cross-References

- Construct-to-IR mapping: [layout-ir-coarsening.md](layout-ir-coarsening.md)
- �ڼ��� ���� ���̵�: [getting-started.md](getting-started.md)
- Schema evolution boundary: [schema-evolution.md](../reference/schema-evolution.md)
- ABI contract: [abi.md](../reference/abi.md)
- Test plan: [TODO.md](../llm/TODO.md)
