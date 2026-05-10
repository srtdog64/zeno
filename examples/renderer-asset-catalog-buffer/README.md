# Renderer Asset Catalog Buffer Example

This example lowers public game repository metadata into fixed Zeno asset rows.
It does not store asset payload bytes and does not import a renderer.

The shape is common across the sampled public games in
[`docs/renderer-buffer-case-studies.md`](../../docs/renderer-buffer-case-studies.md):

- texture/script/audio/metadata rows
- hashed lookup keys
- byte length and extension metadata
- kind-specific load queues as caller-owned typed arrays

```sh
npm run build --workspace @exornea/zeno-example-renderer-asset-catalog-buffer
npm run start --workspace @exornea/zeno-example-renderer-asset-catalog-buffer
```

This is a diagnostic witness for a future dependency-free buffer layer. It is
not a claim that renderer asset loading should use Zeno by default.
