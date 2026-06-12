# IPC 通信机制

## 架构概览

Recordly 使用 Electron 的 `ipcMain` / `ipcRenderer` 实现主进程与渲染进程之间的通信。所有 IPC 调用通过预加载脚本中的 `contextBridge` 暴露，渲染进程无法直接访问 Node.js API。

---

## 调用链路

```
渲染进程（React 组件）
    │
    │  window.electronAPI.recording.start(options)
    ▼
预加载脚本（electron/preload.ts）
    │
    │  ipcRenderer.invoke("recording:start", options)
    ▼
主进程 IPC 处理器（electron/ipc/register/recording.ts）
    │
    │  ipcMain.handle("recording:start", async (event, options) => { ... })
    ▼
业务逻辑（原生录制 / FFmpeg / 文件系统操作）
    │
    └── 返回结果给调用方（Promise resolve）
```

---

## 频道命名规范

所有频道按功能命名空间划分，格式为 `namespace:action`：

| 命名空间 | 功能 | 示例频道 |
|---------|------|---------|
| `recording` | 录制控制 | `recording:start`, `recording:stop`, `recording:pause` |
| `export` | 视频导出 | `export:start`, `export:cancel`, `export:getProgress` |
| `sources` | 录制源枚举 | `sources:list`, `sources:getDisplays`, `sources:getWindows` |
| `project` | 项目文件 | `project:load`, `project:save`, `project:create` |
| `captions` | 字幕生成 | `captions:transcribe`, `captions:getStatus` |
| `assets` | 静态资源 | `assets:getWallpapers`, `assets:getFonts` |
| `settings` | 用户设置 | `settings:get`, `settings:set` |
| `permissions` | 系统权限 | `permissions:check`, `permissions:request` |

---

## 预加载层结构（伪代码）

```typescript
// electron/preload.ts
contextBridge.exposeInMainWorld("electronAPI", {
  recording: {
    start: (options) => ipcRenderer.invoke("recording:start", options),
    stop: ()         => ipcRenderer.invoke("recording:stop"),
    pause: ()        => ipcRenderer.invoke("recording:pause"),
    resume: ()       => ipcRenderer.invoke("recording:resume"),
    // 事件订阅（主进程推送到渲染进程）
    onProgress: (cb) => ipcRenderer.on("recording:progress", cb),
  },
  export: {
    start: (config) => ipcRenderer.invoke("export:start", config),
    cancel: ()      => ipcRenderer.invoke("export:cancel"),
    onProgress: (cb) => ipcRenderer.on("export:progress", cb),
  },
  project: {
    load: (path)    => ipcRenderer.invoke("project:load", path),
    save: (data)    => ipcRenderer.invoke("project:save", data),
  },
  // ... 其他命名空间
})
```

---

## 主进程处理器注册（伪代码）

```typescript
// electron/ipc/handlers.ts
import { registerRecordingHandlers } from "./register/recording"
import { registerExportHandlers }    from "./register/export"
import { registerProjectHandlers }   from "./register/project"
// ...

export function registerAllHandlers() {
  registerRecordingHandlers()
  registerExportHandlers()
  registerProjectHandlers()
  // ...
}

// electron/ipc/register/recording.ts
export function registerRecordingHandlers() {
  ipcMain.handle("recording:start", async (event, options) => {
    // 根据平台选择录制后端
    if (platform === "darwin") return await macRecorder.start(options)
    if (platform === "win32")  return await windowsRecorder.start(options)
    return await ffmpegRecorder.start(options)
  })

  ipcMain.handle("recording:stop", async () => {
    const result = await currentRecorder.stop()
    // 通知渲染进程录制完成
    mainWindow.webContents.send("recording:completed", result)
    return result
  })
}
```

---

## 主进程推送事件（单向通知）

部分场景需要主进程主动推送状态到渲染进程（非请求-响应模式）：

```typescript
// 主进程推送导出进度
mainWindow.webContents.send("export:progress", {
  percent: 42,
  stage: "encoding",
  eta: 8000,  // ms
})

// 渲染进程订阅（通过预加载层）
window.electronAPI.export.onProgress((event, progress) => {
  setExportProgress(progress.percent)
})
```

---

## 类型安全

`electron/ipc/types.ts` 定义所有 IPC 频道的请求/响应类型，预加载层和处理器都引用这些类型，确保两端类型一致。
