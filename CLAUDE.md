# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
# 开发
npm run dev                    # 启动渲染进程开发服务器（Vite HMR）
npm run dev:viewer             # 启动独立 Web 播放器开发服务器

# 构建
npm run build                  # 完整生产构建（原生助手 + tsc + vite + electron-builder）
npm run build:win              # Windows 专用构建
npm run build:mac              # macOS 专用构建

# 代码检查与格式化
npm run lint                   # 运行 Biome 检查
npm run lint:fix               # 运行 Biome 并自动修复
npm run format                 # 用 Biome 格式化代码

# 测试
npm test                       # 单次运行所有测试（vitest --run）
npm run test:watch             # 监听模式
npx vitest run src/path/to/file.test.ts  # 运行单个测试文件

# 其他
npm run i18n:check             # 验证所有翻译文件是否完整
```

## 架构概览

Recordly 是一个 **Electron 桌面应用**（屏幕录制 + 视频编辑器），使用 React 18 + Vite 作为渲染层，并通过 Swift（macOS）和 C++/CUDA（Windows）原生助手实现录制和 GPU 加速导出。

详细技术文档见 `docs/` 目录：
- [整体架构](docs/01-整体架构.md)
- [IPC 通信机制](docs/02-IPC通信机制.md)
- [视频编辑器状态管理](docs/03-视频编辑器状态管理.md)
- [导出流水线](docs/04-导出流水线.md)
- [录制后端](docs/05-录制后端.md)
- [视频压缩工具](docs/08-视频压缩工具.md)

### 进程分离

- **主进程** (`electron/main.ts`)：管理应用生命周期、多窗口（Editor、LaunchHUD、SourceSelector、CountdownOverlay、UpdateToast）、系统托盘和 IPC 处理器注册。
- **预加载** (`electron/preload.ts`)：通过 `contextBridge` 向渲染进程暴露类型安全的 `electronAPI` 对象。
- **渲染进程** (`src/main.tsx`)：React SPA。`src/App.tsx` 读取 URL 参数 `windowType` 决定渲染哪个窗口的 UI。
- **Web 播放器** (`src/viewer-main.tsx`)：独立的 Vite 入口，构建到 `dist-viewer/`，无 Electron 依赖。

### IPC 模式

渲染进程调用 `window.electronAPI.someMethod(payload)` → 预加载层调用 `ipcRenderer.invoke("namespace:action", payload)` → 主进程 `electron/ipc/register/*.ts` 中的处理器响应。

频道按功能命名空间划分：`recording:*`、`export:*`、`sources:*`、`project:*`、`captions:*`、`assets:*`、`settings:*`、`permissions:*`。

### src/ 目录结构

```
src/
├── App.tsx                  # 根组件，根据 windowType URL 参数路由
├── components/
│   ├── launch/              # 启动/HUD 窗口（录制源选择、录制控制、摄像头预览）
│   ├── video-editor/        # 编辑器窗口，所有编辑 UI 和状态
│   │   ├── timeline/        # 拖放时间轴（dnd-timeline），缩放/裁剪/变速/标注轨道
│   │   ├── audio/           # 音频轨道编辑、波形 Worker
│   │   └── *.ts             # 功能模块（字幕、历史记录、导出路由、变速等）
│   └── ui/                  # Radix UI 原语封装（button、dialog、slider 等）
├── contexts/                # React Context：i18n、快捷键、主题
├── lib/
│   ├── exporter/            # 客户端导出流水线（软件路径，基于 FFmpeg）
│   ├── extensions/          # 扩展系统与市场
│   ├── geometry/            # 矩形/点数学计算
│   ├── web-media/           # 媒体加载、流式传输、元数据
│   └── web-project/         # 项目文件反序列化
└── pages/web-viewer/        # 独立播放器页面
```

### electron/ 目录结构

```
electron/
├── ipc/
│   ├── handlers.ts          # 注册所有 IPC 处理器
│   ├── register/            # 各命名空间的处理器实现
│   ├── recording/           # 平台录制后端（mac.ts、windows.ts、ffmpeg.ts）
│   ├── export/              # 导出后端（exportStream.ts、native-video.ts、frameRenderer.ts）
│   ├── cursor/              # 原生光标追踪与遥测
│   ├── captions/            # Whisper.cpp 语音转文字
│   └── project/             # .recordly 文件读写
├── extensions/              # 扩展加载器、市场、IPC 桥接
├── native/                  # Swift（macOS）和 C++（Windows）源码及预构建二进制
└── windows.ts               # 窗口创建辅助函数
```

### 代码风格

- **格式化**：Biome — Tab 缩进、LF 换行、100 字符行宽
- **Lint**：Biome 严格规则 — 禁止 `any`、禁止 `var`、依赖项需穷举、禁止未使用变量
- `@` 路径别名指向 `src/`
- 测试文件与源文件同目录，命名为 `*.test.ts`
