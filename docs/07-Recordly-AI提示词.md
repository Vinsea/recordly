# Recordly `.recordly` 文件格式 — AI 生成参考文档

> 此文档用于指导 AI（大语言模型）直接生成合法的 `.recordly` 项目文件。
> `.recordly` 文件是纯 JSON，描述了一段屏幕录制的完整编辑状态。

---

## 顶层结构

```json
{
  "version": 1,
  "projectId": "<uuid-v4>",
  "videoPath": "<本地绝对路径>.mp4",
  "editor": { ... }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | `1` | 固定值，当前唯一版本 |
| `projectId` | string (UUID v4) | 项目唯一 ID |
| `videoPath` | string | 主视频绝对路径（Windows 反斜线转义） |
| `editor` | object | 所有编辑参数，见下方 |

---

## `editor` 字段完整说明

### 视觉外观

```json
"wallpaper": "/wallpapers/tahoe-dark.jpg"
```

**wallpaper** — 背景图 / 渐变色
- 内置图片路径：`/wallpapers/<slug>.jpg`
- 内置视频路径：`/wallpapers/wispysky.mp4`
- 自定义渐变：CSS `linear-gradient(...)` 或 `radial-gradient(...)` 字符串

可选内置 slug（25 个）：
`tahoe-light` · `tahoe-dark` · `midnight-8` · `ipad-17-dark` · `ipad-17-light` · `sequoia-blue` · `sequoia-blue-orange` · `ventura` · `ventura-dark` · `sonoma-clouds` · `sonoma-light` · `sonoma-dark` · `sonoma-evening` · `sonoma-horizon` · `glassmorphism-3` · `glassmorphism-4` · `energy-17` · `energy-19` · `wallpaper3` · `wallpaper4` · `wallpaper10` · `cityscape` · `levels` · `iridescent-9` · `wispysky`（视频）

---

```json
"shadowIntensity": 0.67,
"backgroundBlur": 3,
"borderRadius": 10,
"padding": { "top": 5, "bottom": 5, "left": 5, "right": 5, "linked": true },
"frame": null,
"aspectRatio": "native"
```

| 字段 | 范围 | 默认 | 说明 |
|------|------|------|------|
| `shadowIntensity` | 0–1 | 0.5 | 视频阴影强度 |
| `backgroundBlur` | 0–20 | 0 | 背景模糊（px 等效） |
| `borderRadius` | 0–40 | 8 | 视频圆角（px） |
| `padding.top/bottom/left/right` | 0–100 | 0 | 视频内边距（%） |
| `padding.linked` | bool | true | 四边联动 |
| `frame` | string \| null | null | 设备边框名称（如 `"macbook-pro-16"` ），null = 无 |
| `aspectRatio` | `"native"` \| `"16:9"` \| `"9:16"` \| `"1:1"` \| `"4:3"` \| `"4:5"` \| `"16:10"` \| `"10:16"` | `"native"` | 输出宽高比 |

---

### 裁切区域

```json
"cropRegion": { "x": 0, "y": 0, "width": 1, "height": 0.96 }
```

所有值均为归一化比例（0–1）。`width: 1, height: 1` = 不裁切。

---

### 鼠标光标

```json
"showCursor": true,
"loopCursor": false,
"cursorStyle": "tahoe",
"cursorSize": 2.5,
"cursorSmoothing": 0.67,
"cursorMotionBlur": 0.4,
"cursorSway": 0.4,
"cursorClickBounce": 3.5,
"cursorClickBounceDuration": 350,
"cursorClickEffect": "none",
"cursorClickEffectColor": "#ffffff",
"cursorClickEffectScale": 1.5,
"cursorClickEffectOpacity": 0.8,
"cursorClickEffectDurationMs": 400
```

| 字段 | 类型/范围 | 说明 |
|------|-----------|------|
| `showCursor` | bool | 是否显示光标 |
| `loopCursor` | bool | 循环光标轨迹 |
| `cursorStyle` | `"macos"` \| `"tahoe"` \| `"tahoe-inverted"` \| `"dot"` \| `"figma"` | 光标样式 |
| `cursorSize` | 0.5–5 | 光标缩放倍数 |
| `cursorSmoothing` | 0–1 | 运动平滑度（弹簧阻尼） |
| `cursorMotionBlur` | 0–1 | 运动模糊强度 |
| `cursorSway` | 0–1 | 微晃动幅度 |
| `cursorClickBounce` | 0–10 | 点击弹跳幅度 |
| `cursorClickBounceDuration` | ms | 弹跳动画时长 |
| `cursorClickEffect` | `"none"` \| `"ring"` \| `"ripple"` \| `"dot"` | 点击视觉特效 |
| `cursorSpringStiffnessMultiplier` | 0.5–3 | 弹簧刚度 |
| `cursorSpringDampingMultiplier` | 0.5–2 | 弹簧阻尼 |
| `cursorSpringMassMultiplier` | 0.5–3 | 弹簧质量 |
| `cameraSpringStiffnessMultiplier` | 0.5–3 | 摄像机弹簧刚度 |
| `cameraSpringDampingMultiplier` | 0.5–2 | 摄像机弹簧阻尼 |
| `cameraSpringMassMultiplier` | 0.5–3 | 摄像机弹簧质量 |

---

### 缩放区域（zoomRegions）

```json
"zoomRegions": [
  {
    "id": "zoom-1",
    "startMs": 572,
    "endMs": 6657,
    "depth": 2,
    "focus": { "cx": 0.25, "cy": 0.25 },
    "mode": "auto"
  }
]
```

| 字段 | 说明 |
|------|------|
| `id` | 唯一字符串，约定 `"zoom-N"` |
| `startMs` / `endMs` | 时间范围（毫秒，相对于原始视频） |
| `depth` | 缩放倍数（1 = 不缩，2 = 2× 放大） |
| `focus.cx` / `focus.cy` | 焦点归一化坐标（0–1） |
| `mode` | `"auto"` = 系统自动追踪，`"manual"` = 手动固定焦点 |

**缩放动效参数**（在 editor 根级）：

| 字段 | 范围 | 说明 |
|------|------|------|
| `zoomInDurationMs` | 0–1000 | 放大过渡时长 |
| `zoomInOverlapMs` | 0–500 | 放大时与内容重叠时长 |
| `zoomOutDurationMs` | 0–1000 | 缩小过渡时长 |
| `connectedZoomGapMs` | 100–5000 | 连续缩放间隔 |
| `connectedZoomDurationMs` | 100–3000 | 连续缩放过渡时长 |
| `zoomInEasing` | `"recordly"` \| `"glide"` \| `"smooth"` \| `"snappy"` \| `"linear"` | 放大缓动 |
| `zoomOutEasing` | 同上 | 缩小缓动 |
| `connectedZoomEasing` | 同上 | 连续缩放缓动 |
| `zoomSmoothness` | 0–1 | 缩放平滑度 |
| `zoomClassicMode` | bool | 传统缩放模式（无弹簧） |
| `zoomMotionBlur` | 0–1 | 缩放运动模糊强度 |
| `connectZooms` | bool | 连续缩放模式开关 |

---

### 音频区域（audioRegions）

```json
"audioRegions": [
  {
    "id": "audio-1",
    "startMs": 139,
    "endMs": 7436,
    "audioPath": "D:\\path\\to\\audio.wav",
    "volume": 1,
    "normalize": true,
    "trackIndex": 0
  }
]
```

| 字段 | 说明 |
|------|------|
| `audioPath` | 本地绝对路径（支持 wav/mp3/aac/m4a） |
| `volume` | 0–2，1 = 原始音量 |
| `normalize` | 是否自动均衡音量 |
| `trackIndex` | 轨道编号（0-based，多轨时区分） |

---

### 注释区域（annotationRegions）

```json
"annotationRegions": [
  {
    "id": "annotation-1",
    "startMs": 145,
    "endMs": 1599,
    "type": "text",
    "content": "标注文字",
    "position": { "x": 4.84, "y": 91.16 },
    "size": { "width": 90.17, "height": 8.19 },
    "style": {
      "color": "#ffffff",
      "backgroundColor": "#000000",
      "fontSize": 20,
      "fontFamily": "Georgia, serif",
      "fontWeight": "bold",
      "fontStyle": "normal",
      "textDecoration": "none",
      "textAlign": "center",
      "borderRadius": 8
    },
    "zIndex": 1,
    "trackIndex": 0,
    "textContent": "标注文字",
    "blurIntensity": 12
  }
]
```

`type` 可选值：`"text"` · `"arrow"` · `"blur"` · `"highlight"` · `"rectangle"` · `"spotlight"`

`position` 和 `size` 均为百分比（相对于视频画面宽高，0–100）。

---

### 字幕（autoCaptionSettings）

```json
"autoCaptions": [],
"autoCaptionSettings": {
  "enabled": true,
  "language": "zh",
  "fontFamily": "\"SF Pro Text\", Helvetica, sans-serif",
  "fontSize": 30,
  "bottomOffset": 3,
  "maxWidth": 62,
  "maxRows": 1,
  "animationStyle": "fade",
  "boxRadius": 17.5,
  "textColor": "#FFFFFF",
  "inactiveTextColor": "#A3A3A3",
  "backgroundOpacity": 0.9
}
```

| 字段 | 说明 |
|------|------|
| `enabled` | 是否启用自动字幕 |
| `language` | 语言代码（`"zh"` / `"en"` / `"ja"` 等） |
| `autoCaptions` | 已生成的字幕列表（空数组 = 尚未生成） |
| `animationStyle` | `"fade"` \| `"pop"` \| `"none"` |
| `bottomOffset` | 距底部百分比（0–50） |
| `backgroundOpacity` | 字幕背景透明度（0–1） |

---

### 摄像头叠加（webcam）

```json
"webcam": {
  "enabled": false,
  "sourcePath": null,
  "mirror": true,
  "positionPreset": "bottom-right",
  "positionX": 1,
  "positionY": 1,
  "corner": "bottom-right",
  "size": 40,
  "cornerRadius": 90,
  "shadow": 0.67,
  "timeOffsetMs": 0,
  "margin": 24,
  "reactToZoom": true,
  "cropRegion": { "x": 0, "y": 0, "width": 1, "height": 1 }
}
```

`positionPreset` / `corner` 可选：`"bottom-right"` · `"bottom-left"` · `"top-right"` · `"top-left"`

---

### 裁剪片段（clipRegions）

```json
"clipRegions": [
  {
    "id": "clip-1",
    "startMs": 0,
    "endMs": 14468,
    "speed": 1,
    "muted": false,
    "showSourceAudio": false
  }
]
```

`clipRegions` 定义视频的有效播放段，支持多段拼接。`speed` 为播放速率（0.25–4）。

---

### 修剪（trimRegions）/ 速度（speedRegions）

```json
"trimRegions": [],
"speedRegions": []
```

均为数组，空数组表示不启用。`speedRegions` 格式同 `clipRegions`，用于局部变速。

---

### 导出参数（通常不影响预览，用于导出）

```json
"aspectRatio": "native",
"exportFormat": "mp4",
"exportQuality": "source",
"exportEncodingMode": "balanced",
"mp4FrameRate": 60,
"gifFrameRate": 15,
"gifLoop": true,
"gifSizePreset": "medium"
```

---

## 最简合法文件示例

```json
{
  "version": 1,
  "projectId": "00000000-0000-4000-a000-000000000001",
  "videoPath": "C:\\Users\\user\\Videos\\demo.mp4",
  "editor": {
    "wallpaper": "/wallpapers/tahoe-dark.jpg",
    "shadowIntensity": 0.5,
    "backgroundBlur": 0,
    "borderRadius": 8,
    "padding": { "top": 0, "bottom": 0, "left": 0, "right": 0, "linked": true },
    "frame": null,
    "aspectRatio": "native",
    "cropRegion": { "x": 0, "y": 0, "width": 1, "height": 1 },
    "showCursor": true,
    "loopCursor": false,
    "cursorStyle": "tahoe",
    "cursorSize": 2,
    "cursorSmoothing": 0.67,
    "cursorMotionBlur": 0.4,
    "cursorSway": 0.4,
    "cursorClickBounce": 3.5,
    "cursorClickBounceDuration": 350,
    "cursorClickEffect": "none",
    "cursorClickEffectColor": "#ffffff",
    "cursorClickEffectScale": 1.5,
    "cursorClickEffectOpacity": 0.8,
    "cursorClickEffectDurationMs": 400,
    "cursorSpringStiffnessMultiplier": 1,
    "cursorSpringDampingMultiplier": 1,
    "cursorSpringMassMultiplier": 1,
    "cameraSpringStiffnessMultiplier": 1,
    "cameraSpringDampingMultiplier": 1,
    "cameraSpringMassMultiplier": 1,
    "zoomRegions": [],
    "trimRegions": [],
    "clipRegions": [{ "id": "clip-1", "startMs": 0, "endMs": 10000, "speed": 1, "muted": false, "showSourceAudio": false }],
    "speedRegions": [],
    "annotationRegions": [],
    "audioRegions": [],
    "autoCaptions": [],
    "autoCaptionSettings": {
      "enabled": false,
      "language": "zh",
      "fontFamily": "\"SF Pro Text\", Helvetica, sans-serif",
      "fontSize": 30,
      "bottomOffset": 3,
      "maxWidth": 62,
      "maxRows": 1,
      "animationStyle": "fade",
      "boxRadius": 17.5,
      "textColor": "#FFFFFF",
      "inactiveTextColor": "#A3A3A3",
      "backgroundOpacity": 0.9
    },
    "connectZooms": true,
    "zoomInDurationMs": 200,
    "zoomInOverlapMs": 200,
    "zoomOutDurationMs": 200,
    "connectedZoomGapMs": 1500,
    "connectedZoomDurationMs": 1000,
    "zoomInEasing": "recordly",
    "zoomOutEasing": "recordly",
    "connectedZoomEasing": "glide",
    "zoomSmoothness": 0.5,
    "zoomClassicMode": false,
    "zoomMotionBlur": 0.35,
    "webcam": {
      "enabled": false,
      "sourcePath": null,
      "mirror": true,
      "positionPreset": "bottom-right",
      "positionX": 1,
      "positionY": 1,
      "corner": "bottom-right",
      "size": 40,
      "cornerRadius": 90,
      "shadow": 0.67,
      "timeOffsetMs": 0,
      "margin": 24,
      "reactToZoom": true,
      "cropRegion": { "x": 0, "y": 0, "width": 1, "height": 1 }
    },
    "exportFormat": "mp4",
    "exportQuality": "source",
    "exportEncodingMode": "balanced",
    "exportBackendPreference": "auto",
    "exportPipelineModel": "modern",
    "mp4FrameRate": 60,
    "gifFrameRate": 15,
    "gifLoop": true,
    "gifSizePreset": "medium",
    "sourceAudioTrackSettingsByClip": {},
    "defaultSourceAudioTrackSettings": {}
  }
}
```

---

## AI 生成时的注意事项

1. **`version` 固定为 `1`**，不要生成其他值。
2. **所有时间单位为毫秒**，`endMs` 不能超过视频实际时长。
3. **归一化坐标**（`focus.cx/cy`、`cropRegion`、`webcam.cropRegion`）值域 0–1。
4. **`position`/`size` 在 annotationRegion 中是百分比**（0–100），不是归一化。
5. **`clipRegions` 必须至少有一条记录**，覆盖整个视频时长。
6. **`videoPath` 使用反斜线时需 JSON 转义**：`"C:\\Users\\..."`.
7. **`wallpaper` 为渐变色时**写完整 CSS 字符串，不要用 `url()`。
8. **不要随意省略字段**，缺失字段会使用代码内默认值，但最好显式提供所有字段以保证行为一致。
9. **`autoCaptions` 为空数组时**代表尚未识别，`autoCaptionSettings.enabled: true` 表示下次打开时自动识别。
10. **`id` 字段**在同类数组内必须唯一（如 `"zoom-1"`, `"zoom-2"`，不能重复）。
