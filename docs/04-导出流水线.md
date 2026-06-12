# 导出流水线

## 双后端架构

Recordly 支持两种导出后端，在运行时由 `mp4ExportRouting.ts` 自动选择：

```
mp4ExportRouting.ts
    │
    ├── 硬件路径（Windows）
    │     ├── NVIDIA CUDA compositor   → CUDA GPU 编码
    │     └── D3D11 compositor         → Direct3D 11 GPU 合成
    │
    └── 软件路径（跨平台）
          ├── Pixi.js 帧渲染器         → 逐帧合成到 canvas
          └── FFmpeg 编码器            → H.264 / H.265 / VP9 / GIF
```

---

## 路由决策逻辑

`electron/ipc/export/nativeStaticLayoutRoutePlan.ts`

```pseudocode
function selectExportBackend(config):
  if platform != "win32":
    return SOFTWARE_PATH

  if config.hasComplexEffects():
    // 软件路径支持更多滤镜效果
    return SOFTWARE_PATH

  if nvidia_cuda_available():
    return CUDA_PATH

  if d3d11_available():
    return D3D11_PATH

  return SOFTWARE_PATH
```

---

## 软件导出路径

### 1. 准备阶段

```pseudocode
// 分析时间轴，生成导出配置
function prepareExport(timelineModel, outputOptions):
  segments = buildSegmentList(timelineModel.trims, timelineModel.speedChanges)
  filterGraph = buildFFmpegFilterGraph(
    zoomRegions = timelineModel.zoomRegions,
    cursorEffects = ...,
    webcamOverlay = ...,
  )
  return { segments, filterGraph, outputOptions }
```

### 2. 帧渲染（Pixi.js）

`electron/ipc/export/frameRenderer.ts`

```pseudocode
// 逐帧渲染（软件合成）
for frame in totalFrames:
  // 解码原始视频帧
  rawFrame = videoDecoder.getFrame(frame.timestamp)

  // Pixi.js 合成层叠效果
  pixiStage.clear()
  pixiStage.addVideoFrame(rawFrame, zoomTransform)
  pixiStage.addCursorOverlay(cursorData[frame.timestamp])
  pixiStage.addWebcamFrame(webcamData[frame.timestamp])
  pixiStage.addAnnotations(annotations.at(frame.timestamp))

  // 提取合成后的像素数据
  composited = pixiRenderer.extract.pixels()

  // 送入 FFmpeg 编码
  ffmpegProcess.stdin.write(composited)

  reportProgress(frame.index / totalFrames)
```

### 3. FFmpeg 编码

`electron/ipc/export/exportStream.ts`

```bash
# 软件路径 FFmpeg 调用示例（伪命令）
ffmpeg \
  -f rawvideo -pix_fmt rgba -s 1920x1080 -r 60 -i pipe:0 \
  -i audio.wav \
  -vf "scale=1920:1080" \
  -c:v libx264 -preset fast -crf 18 \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  output.mp4
```

---

## 硬件导出路径（Windows）

### NVIDIA CUDA

`electron/native/` 中的 C++ CUDA 程序：

```pseudocode
// CUDA GPU 合成 + NVENC 编码
cudaCompositor.init(outputDimensions)

for frame in videoStream:
  // GPU 端合成（无需 CPU 回读）
  cudaCompositor.compositeFrame(
    videoFrame,
    cursorOverlay,
    webcamOverlay,
    zoomTransform,
  )
  nvencEncoder.encodeFrame(cudaCompositor.getOutputSurface())

nvencEncoder.flush()
muxer.writeToFile(outputPath)
```

### D3D11

类似 CUDA 路径，使用 Direct3D 11 API 进行 GPU 合成，通过 Intel/AMD/NVIDIA 通用图形驱动编码。

---

## 支持的输出格式

| 格式 | 编码器 | 说明 |
|------|--------|------|
| MP4 (H.264) | libx264 / NVENC H264 | 默认格式，兼容性最好 |
| MP4 (H.265) | libx265 / NVENC H265 | 更小文件体积 |
| WebM (VP9) | libvpx-vp9 | 网页分享 |
| GIF | gif.js（纯 JS） | 无声动图，体积大 |

---

## 进度上报

```
导出进程（主进程）
    │
    │ 每 500ms 采样一次编码进度
    │
    ▼
mainWindow.webContents.send("export:progress", {
  percent, currentFrame, totalFrames, eta
})
    │
    ▼
渲染进程更新 exportProgressState
    │
    ▼
导出进度条 UI 更新
```

---

## GIF 导出特殊处理

GIF 导出完全在渲染进程中完成（`src/lib/exporter/`），不经过 FFmpeg：

```pseudocode
// 使用 gif.js 库逐帧编码
gifEncoder = new GIF({ workers: 4, quality: 10, width, height })

for frame in sampledFrames:  // 按 GIF 帧率采样（通常 15fps）
  canvas = renderFrame(frame)
  gifEncoder.addFrame(canvas, { delay: frameDelay })

gifEncoder.on("finished", (blob) => {
  saveFile(blob, outputPath)
})
gifEncoder.render()
```
