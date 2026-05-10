# Zeno Raw WebGL Double Buffer

This is a renderer-layer experiment, not a Zeno core feature.

It demonstrates the more aggressive path described in the WebGL notes:

```txt
SharedArrayBuffer
-> worker writes GPU-ready interleaved Float32Array frames
-> atomic frame publication
-> main thread uploads the published frame with gl.bufferSubData
-> raw WebGL2 instanced draw
```

The control block uses padded `Int32Array` cells for:

- `writeBuffer`: the slot the worker wants to write next
- `readBuffer`: the latest fully published slot
- `frameVersion`: monotonically increasing publication counter
- `ready`: first-frame publication flag
- `uploadingBuffer`: slot currently being uploaded by the renderer
- `consumedBuffer`: last slot the renderer finished uploading
- `skippedFrames`: worker ticks dropped because both slots were unsafe
- `buffer0Version` / `buffer1Version`: per-slot publication versions used to
  reject torn frame snapshots
- `tornFrames`: rejected publication snapshots where the global version did not
  match the version recorded on the published slot

The worker never writes the slot currently marked as uploading, and it does not
overwrite the published read slot until the renderer has acknowledged it through
`consumedBuffer`. If both slots are unsafe, the worker skips that simulation
tick instead of risking a torn GPU upload source.

The renderer claims a frame before upload. A claimed frame is valid only when
the global `frameVersion` matches the version stored on the published slot. If
those values disagree, the renderer treats the snapshot as torn, clears the
upload claim, and waits for the next frame.

The purpose is to keep the layer boundary honest:

- Zeno core owns binary layout, projection, scan, and typed vector views.
- This example owns renderer-facing memory layout, double buffering, and raw
  WebGL upload.
- `gl.bufferSubData` still copies CPU memory into a GPU buffer. The win is
  zero JS object materialization and no per-record renderer packing loop.

Run it:

```powershell
npm install
npm run dev --workspace @exornea/zeno-example-webgl-raw-double-buffer
```

Build and smoke-test:

```powershell
npm run example:webgl-raw:build
npm run browser:smoke:raw
```
