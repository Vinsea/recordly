# Recordly 整体架构

## 技术栈

- **桌面框架**：Electron 39
- **渲染层**：React 18 + TypeScript + Vite 5
- **样式**：TailwindCSS + Radix UI
- **图形渲染**：Pixi.js 8（GPU 加速合成）
- **视频处理**：FFmpeg（软件路径）+ 原生 D3D11/CUDA（硬件路径）
- **音频处理**：Web Audio API + WASAPI（Windows）
- **代码检查**：Biome
- **测试**：Vitest

---

## 进程模型

```
┌─────────────────────────────────────────────────────────┐
│                    Electron 主进程                        │
│  electron/main.ts                                        │
│  - 管理多个 BrowserWindow                                 │
│  - 注册所有 IPC 处理器                                    │
│  - 系统托盘、自动更新                                     │
│  - 调用原生二进制（录制、导出、光标追踪）                  │
└───────────────────┬─────────────────────────────────────┘
                    │ IPC (ipcMain.handle / ipcRenderer.invoke)
┌───────────────────▼─────────────────────────────────────┐
│                    预加载脚本                             │
│  electron/preload.ts                                     │
│  - contextBridge 暴露 window.electronAPI                 │
│  - 类型安全的 IPC 包装层                                  │
└───────────────────┬─────────────────────────────────────┘
                    │ window.electronAPI.*
┌───────────────────▼─────────────────────────────────────┐
│                    渲染进程（React SPA）                   │
│  src/main.tsx → src/App.tsx                              │
│  - 根据 URL 参数 windowType 渲染对应窗口 UI               │
└─────────────────────────────────────────────────────────┘
```

---

## 多窗口架构

应用同时运行多个 BrowserWindow，每个窗口加载相同的 `index.html`，通过 URL 参数 `?windowType=xxx` 区分：

| 窗口类型 | URL 参数 | 用途 |
|---------|---------|------|
| editor | `windowType=editor` | 主编辑器窗口 |
| launch | `windowType=launch` | 悬浮录制控制 HUD |
| sourceSelector | `windowType=sourceSelector` | 录制源选择器 |
| countdown | `windowType=countdown` | 倒计时叠加层 |
| updateToast | `windowType=updateToast` | 更新通知 |

---

## 目录结构总览

```
Recordly/
├── src/                    # 渲染进程（React）
├── electron/               # 主进程 + 原生集成
│   ├── ipc/                # IPC 处理器（按功能命名空间）
│   ├── extensions/         # 扩展系统
│   └── native/             # Swift/C++ 源码 + 预构建二进制
├── scripts/                # 构建脚本（原生助手、发布等）
├── public/                 # 静态资源
└── docs/                   # 技术文档
```

---

## 数据流向

```
用户操作（UI）
    │
    ▼
React 组件状态更新
    │ props / context
    ▼
业务逻辑模块（timelineModel、captionEditing 等）
    │ window.electronAPI.*
    ▼
IPC 调用（preload → main）
    │
    ▼
主进程处理器（electron/ipc/register/）
    │
    ├── 调用原生二进制（录制/导出）
    ├── 读写文件系统（项目文件）
    └── 返回结果给渲染进程
```

---

## 项目文件格式（.recordly）

`.recordly` 是 JSON 格式的项目存档，包含：

```jsonc
{
  "version": "1.x",
  "recording": {
    "sourceType": "display" | "window",
    "dimensions": { "width": 1920, "height": 1080 },
    "duration": 12345  // ms
  },
  "timeline": {
    "zoomRegions": [...],
    "trims": [...],
    "speedChanges": [...],
    "annotations": [...],
    "audioClips": [...]
  },
  "cursor": { "size": 1.0, "smoothing": 0.5, "effects": [...] },
  "webcam": { "position": {...}, "size": {...}, "mirror": false },
  "export": { "codec": "h264", "bitrate": 8000, "format": "mp4" }
}
```
