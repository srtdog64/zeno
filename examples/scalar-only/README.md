# Zeno Scalar-Only Example

This example shows Zeno's primary hot path: a fixed-layout table scanned with
generated static accessors and scan kernels.

```sh
npm run build --workspace @exornea/zeno-example-scalar-only
npm run start --workspace @exornea/zeno-example-scalar-only
```

The schema has no dynamic tail fields, strings, vectors, or object
materialization on the read path. It is the smallest useful model of Zeno as a
TypeScript-native binary table scanner.
