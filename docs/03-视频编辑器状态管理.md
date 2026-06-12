# 视频编辑器状态管理

## 设计原则

编辑器使用 **React hooks + Context** 管理状态，无 Redux/Zustand 等全局状态库。状态按功能模块拆分，通过 props 和 context 向下传递。

---

## 状态层级

```
VideoEditor.tsx（顶层状态容器）
    │
    ├── 时间轴状态（timelineModel）
    │     ├── 缩放区域（zoomRegions）
    │     ├── 裁剪点（trims）
    │     ├── 变速片段（speedChanges）
    │     ├── 标注（annotations）
    │     └── 音频片段（audioClips）
    │
    ├── 导出状态（exportProgressState / exportStatusModel）
    │
    ├── 历史记录（editorHistory）
    │
    └── 编辑器偏好（editorPreferences）
```

---

## 核心模块

### timelineModel（时间轴数据模型）

`src/components/video-editor/timeline/model/timelineModel.ts`

时间轴的完整数据结构，是编辑器的核心持久化状态，直接序列化进 `.recordly` 项目文件。

```typescript
// 伪结构
interface TimelineModel {
  duration: number            // 视频总时长（ms）
  zoomRegions: ZoomRegion[]   // 自动缩放区域（时间范围 + 缩放级别）
  trims: TrimPoint[]          // 裁剪/删除片段
  speedChanges: SpeedChange[] // 变速片段（0.25x ~ 4x）
  annotations: Annotation[]   // 文字/箭头/形状标注
  audioClips: AudioClip[]     // 额外音频轨道片段
  captionCues: CaptionCue[]   // 字幕条目
}
```

状态更新通过纯函数产生新对象（不可变更新），便于 undo/redo。

### editorHistory（历史记录 / Undo-Redo）

`src/components/video-editor/editorHistory.ts`

```
操作前快照 → 用户修改 → 操作后快照
             │
             └── pushHistory(prevSnapshot, nextSnapshot)

撤销（Ctrl+Z）：从 undoStack 弹出，恢复 prevSnapshot
重做（Ctrl+Y）：从 redoStack 弹出，恢复 nextSnapshot
```

- 快照内容：`TimelineModel` 的完整深拷贝
- 栈深度限制：最多 100 步
- 合并策略：连续的同类操作（如拖动缩放区域）合并为一步

### exportProgressState / exportStatusModel

`src/components/video-editor/exportProgressState.ts`
`src/components/video-editor/exportStatusModel.ts`

```typescript
// 导出状态机
type ExportStatus =
  | "idle"
  | "preparing"       // 分析时间轴，生成 FFmpeg 滤镜图
  | "encoding"        // FFmpeg/GPU 编码中
  | "muxing"          // 封装 MP4/WebM 容器
  | "completed"
  | "error"
  | "cancelled"

interface ExportProgress {
  status: ExportStatus
  percent: number         // 0-100
  currentFrame: number
  totalFrames: number
  eta: number             // 预计剩余时间（ms）
}
```

进度通过 IPC 事件从主进程推送到渲染进程，渲染进程更新 React state 触发 UI 刷新。

### editorPreferences（编辑器偏好）

`src/components/video-editor/editorPreferences.ts`

用户在编辑器内的 UI 偏好（非项目数据），持久化到本地设置：
- 时间轴缩放级别
- 侧边栏面板宽度
- 上次使用的导出格式

---

## Context 提供者

```
<ShortcutsContext>          键盘快捷键配置
  <I18nContext>             界面语言
    <ThemeContext>          深色/浅色主题
      <VideoEditor>         编辑器主状态
        ...
      </VideoEditor>
    </ThemeContext>
  </I18nContext>
</ShortcutsContext>
```

---

## 状态持久化流程

```
用户编辑操作
    │
    ▼
更新 timelineModel（React state）
    │
    ▼
标记项目为"已修改"（projectDirtyState.ts）
    │
    ▼
用户手动保存 / 自动保存触发
    │
    ▼
window.electronAPI.project.save(serializedModel)
    │
    ▼
主进程写入 .recordly 文件（JSON）
```

---

## 字幕状态

`src/components/video-editor/captionEditing.ts`
`src/components/video-editor/autoCaptionSource.ts`

字幕有独立的编辑状态，支持：
- 从 Whisper 转录结果自动生成
- 手动编辑每条字幕的文字和时间
- 每行最大字符数约束（maxCharsPerLine）
- 样式配置（字体、描边、对齐）独立于时间轴模型存储
