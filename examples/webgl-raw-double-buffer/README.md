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

## Production Risks

This example is a concurrency and renderer-memory witness, not a complete game
engine loop.

- The worker currently uses `setInterval(writeFrame, 16)`. That is simple and
  deterministic enough for smoke tests, but it is not a production timing
  policy. A real renderer pipeline should drive simulation with
  `performance.now()` deltas, and can use worker `requestAnimationFrame` where
  browser support and lifecycle semantics fit the workload.
- The example uses double buffering. That proves the tearing boundary, but a
  production engine may need triple buffering when `gl.bufferSubData` stalls or
  when upload latency spikes would otherwise force the worker to skip many
  frames.
- The interleaved 20-float row is intentionally local to this renderer
  experiment. If this shape becomes product code, promote the row layout into a
  Zeno schema or generated pack layer so stride, field offsets, and output shape
  remain reviewable instead of living as handwritten constants.

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
