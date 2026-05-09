# Zeno WebGL Instance Streamer

This example renders a large instanced WebGL scene from the same synthetic
dataset through two browser-side data paths:

- Zeno binary records backed by one `ArrayBuffer`
- FlatBuffers JS table/vector projection
- JSON object materialization through `JSON.parse`

The point is not that Zeno replaces the GPU upload step. WebGL still needs typed
attribute buffers. The point is that Zeno can keep the source dataset binary and
scan only the fields needed to pack the visible instance buffer.

```powershell
npm install
npm run dev --workspace @exornea/zeno-example-webgl-instance-streamer
```

The schema lives in `src/schema.zeno.ts`; the generated view is
`src/schema.view.ts`.
