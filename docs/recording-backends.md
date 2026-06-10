# 录制后端

## 平台差异

Recordly 针对不同操作系统使用不同的录制技术：

| 平台 | 屏幕录制 | 音频录制 | 光标追踪 |
|------|---------|---------|---------|
| macOS | ScreenCaptureKit（Swift） | CoreAudio | 原生 Swift helper |
| Windows | Windows Graphics Capture（C++） | WASAPI | 原生 C++ helper |
| Linux | Electron desktopCapturer | Web Audio API | Electron UI 事件 |

---

## macOS 后端

`electron/ipc/recording/mac.ts` + `electron/native/*.swift`

### ScreenCaptureKit 录制流程

```pseudocode
// Swift 原生层
func startRecording(sourceId, options):
  filter = SCContentFilter(display: sourceId)
  config = SCStreamConfiguration()
  config.width = options.width
  config.height = options.height
  config.minimumFrameInterval = 1.0 / options.fps
  config.capturesAudio = false  // 音频单独处理

  stream = SCStream(filter, config, delegate: self)
  stream.startCapture()

// 每帧回调
func stream(output: CMSampleBuffer, type: .screen):
  // 将 CMSampleBuffer 写入 VideoToolbox 编码管道
  // 或通过 IPC 传递给 Node.js 层
  encodeFrame(output)
```

### 音频录制

macOS 使用系统音频扩展（System Audio Extension）捕获系统音频，需用户授权安装虚拟音频设备。麦克风音频通过标准 CoreAudio API 采集，两路音频在后期混合。

---

## Windows 后端

`electron/ipc/recording/windows.ts` + `electron/native/*.cpp`

### WGC（Windows Graphics Capture）录制流程

```pseudocode
// C++ 层
void StartCapture(HWND targetWindow, CaptureOptions options):
  // 创建 GraphicsCaptureItem
  item = CreateCaptureItemForWindow(targetWindow)
  // 或 CreateCaptureItemForMonitor(monitorHandle)

  framePool = Direct3D11CaptureFramePool::Create(
    device, DirectXPixelFormat::B8G8R8A8UIntNormalized,
    2,  // 双缓冲
    item.Size
  )

  session = item.CreateCaptureSession(framePool)
  framePool.FrameArrived += OnFrameArrived
  session.StartCapture()

void OnFrameArrived(framePool, args):
  frame = framePool.TryGetNextFrame()
  surface = frame.Surface  // ID3D11Texture2D
  // 传递给 GPU 导出路径或写入中间文件
  ProcessFrame(surface)
```

### 音频录制（WASAPI）

```pseudocode
// 系统音频（Loopback）
audioClient = GetDefaultAudioEndpoint(eRender, eConsole)
audioClient.Initialize(AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, ...)
captureClient = audioClient.GetService(IAudioCaptureClient)
audioClient.Start()

// 麦克风
micClient = GetDefaultAudioEndpoint(eCapture, eConsole)
// ... 类似流程
```

---

## FFmpeg 回退后端

`electron/ipc/recording/ffmpeg.ts`

当平台原生 API 不可用时（Linux、或原生录制失败），使用 Electron 的 `desktopCapturer` + Web Media API 获取视频流，再通过 FFmpeg 编码：

```pseudocode
// 渲染进程获取媒体流
stream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: {
    mandatory: {
      chromeMediaSource: "desktop",
      chromeMediaSourceId: sourceId,
    }
  }
})

// 通过 MediaRecorder 录制为 WebM
recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" })
recorder.ondataavailable = (chunk) => writeChunkToFile(chunk)
recorder.start(1000)  // 每秒产生一个数据块
```

录制完成后用 `fix-webm-duration` 修复 WebM 元数据中的时长信息。

---

## 光标追踪

`electron/ipc/cursor/`

光标数据是实现"自动缩放到光标位置"效果的核心数据源。

### 原生追踪（macOS / Windows）

`electron/native/` 中的原生进程以高频率（200Hz）采样光标位置，通过 IPC 持续上报：

```pseudocode
// 伪代码：光标监控循环
while recording:
  pos = getCursorPosition()
  clicks = getClickEvents()

  // 批量发送（每 50ms 一批）
  buffer.push({ timestamp, x: pos.x, y: pos.y, clicks })

  if buffer.size >= BATCH_SIZE:
    ipc.send("cursor:data", buffer.flush())
```

录制结束后，所有光标数据保存到 `.recordly` 文件，供编辑器在时间轴上展示光标运动轨迹，并驱动导出时的缩放动画生成。

### 数据结构

```typescript
interface CursorEvent {
  timestamp: number    // 相对于录制开始的 ms
  x: number           // 屏幕坐标（像素）
  y: number
  type: "move" | "leftClick" | "rightClick" | "scroll"
}
```

---

## 录制会话管理

`electron/ipc/project/session.ts`

```pseudocode
RecordingSession:
  state: "idle" | "countdown" | "recording" | "paused" | "stopped"
  startTime: Date
  sourceType: "display" | "window"
  tempVideoPath: string     // 录制中写入的临时文件
  tempAudioPath: string     // 系统音频临时文件
  tempMicPath: string       // 麦克风临时文件
  cursorEvents: CursorEvent[]

// 录制结束时
function onRecordingStopped(session):
  // 合并音频轨道
  mergedAudio = ffmpeg.mergeAudio(session.tempAudioPath, session.tempMicPath)

  // 生成 .recordly 项目文件
  project = createProject(session.tempVideoPath, mergedAudio, session.cursorEvents)
  projectPath = saveProject(project)

  // 打开编辑器窗口
  openEditorWindow(projectPath)
```
