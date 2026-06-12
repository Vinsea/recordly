# Windows 原生二进制文件说明

路径：`electron/native/bin/win32-x64/`

## 文件列表

| 文件 | 用途 |
|---|---|
| `wgc-capture.exe` | Windows Graphics Capture (WGC) 屏幕录制后端，捕获屏幕/窗口帧流 |
| `recordly-gpu-export.exe` | GPU 加速视频导出，通过 DirectX 硬件编码器合成帧并输出最终视频 |
| `recordly-nvidia-cuda-compositor.exe` | NVIDIA CUDA 合成器，利用 CUDA 加速帧处理（仅限 N 卡） |
| `cursor-monitor.exe` | 原生光标位置追踪，录制期间采集高频鼠标轨迹，供光标特效使用 |
| `whisper-cli.exe` | Whisper.cpp 语音识别 CLI，驱动"生成字幕"功能 |
| `whisper.dll` | Whisper 推理核心动态库 |
| `ggml.dll` | GGML 张量库（whisper-cli 依赖） |
| `ggml-base.dll` | GGML 基础层 |
| `ggml-cpu.dll` | GGML CPU 推理后端 |
| `helpers-manifest.json` | 各 helper 的版本与二进制名元数据，构建时用于校验和打包 |

## 各模块对应的主进程代码

| 二进制 | 调用方 |
|---|---|
| `wgc-capture.exe` | `electron/ipc/recording/windows.ts` |
| `recordly-gpu-export.exe` | `electron/ipc/export/native-video.ts` |
| `recordly-nvidia-cuda-compositor.exe` | `electron/ipc/export/native-video.ts` |
| `cursor-monitor.exe` | `electron/ipc/cursor/` |
| `whisper-cli.exe` | `electron/ipc/captions/` |

## 构建与更新

- 除 `whisper-cli.exe` 及其 ggml dll 外，其余二进制由各平台专用构建脚本生成：
  - `scripts/build-windows-capture.mjs` → `wgc-capture.exe`
  - `scripts/build-windows-gpu-export.mjs` → `recordly-gpu-export.exe`
  - `scripts/build-nvidia-cuda-compositor.mjs` → `recordly-nvidia-cuda-compositor.exe`
  - `scripts/build-cursor-monitor.mjs` → `cursor-monitor.exe`
- `whisper-cli.exe` 及 ggml dll 由 `scripts/build-whisper-runtime.mjs` 构建，或手动从 [whisper.cpp releases](https://github.com/ggml-org/whisper.cpp/releases) 解压放入此目录；若二进制已存在则自动跳过 CMake 构建。
- `helpers-manifest.json` 在构建流程中自动更新。
