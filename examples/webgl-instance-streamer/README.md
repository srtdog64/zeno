# Zeno WebGL Instance Streamer

This example renders a large instanced WebGL scene from the same synthetic
dataset through three browser-side data paths:

- Zeno binary records backed by one `ArrayBuffer`
- Zeno struct-of-arrays vectors projected with `ScalarVectorView.nativeArray()`
- FlatBuffers JS table/vector projection
- JSON object materialization through `JSON.parse`

The point is not that Zeno replaces the GPU upload step. WebGL still needs typed
attribute buffers. The point is that Zeno can keep the source dataset binary and
scan only the fields needed to pack the visible instance buffer.

The "Zeno vectors" mode is the GPU upload batching witness. It writes positions
and colors as `z.vector<z.f32>` fields, projects them back as native
`Float32Array` views, and hands those views to Three.js `BufferAttribute`
without a per-record CPU packing loop. This is intentionally a separate mode
from the AoS instance-record path, because zero-copy GPU upload needs a
struct-of-arrays layout.

```powershell
npm install
npm run dev --workspace @exornea/zeno-example-webgl-instance-streamer
```

The schema lives in `src/schema.zeno.ts`; the generated view is
`src/schema.view.ts`, with a sibling source map emitted by `zeno-codegen
--source-map`.

The default workload is 250,000 records. The UI also exposes a 1,000,000-record
payload option while capping rendered instances at 250,000 to keep GPU pressure
separate from source payload size.

The current benchmark witness is recorded in
[docs/performance-comparison.md](../../docs/performance-comparison.md).
