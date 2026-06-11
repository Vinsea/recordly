# 关闭时保存提示 & 自动保存状态提示

**日期**：2026-06-11  
**状态**：已批准

---

## 背景

编辑器窗口关闭时弹出的"未保存更改"对话框目前为英文硬编码；自动保存（1 秒延迟）静默运行，顶栏无任何状态反馈。

---

## 方案 A（已选）

### 1. 关闭对话框本地化

**目标**：让 Electron 主进程在弹出原生对话框时使用当前用户语言。

**约束**：主进程无法访问渲染层 localStorage，需通过 IPC 同步语言设置。

**实现流程**：

1. **`electron/preload.ts`**  
   `contextBridge` 新增 `setLocale(locale: string): void`，调用 `ipcRenderer.send("settings:set-locale", locale)`。

2. **`electron/ipc/register/`（settings handler 或 main.ts 顶部）**  
   - 主进程维护模块级变量 `let editorLocale = "en"`  
   - 注册 `ipcMain.on("settings:set-locale", (_e, locale) => { editorLocale = locale })`

3. **`src/contexts/I18nContext.tsx`**  
   - `I18nProvider` 中监听 `locale` 变化，调用 `window.electronAPI?.setLocale?.(locale)`（可选链，兼容 Web 模式）

4. **`electron/main.ts`**  
   - 关闭对话框改为调用工具函数 `getCloseDialogStrings(locale: string)`  
   - 函数内嵌 en / zh-CN / zh-TW 三套字符串，未知语言 fallback 到 en

**对话框字符串对照表**：

| 字段 | en | zh-CN | zh-TW |
|---|---|---|---|
| title | Unsaved Changes | 有未保存的更改 | 有未儲存的變更 |
| message | You have unsaved changes. | 您有未保存的更改。 | 您有未儲存的變更。 |
| detail | Do you want to save your project before closing? | 关闭前是否要保存项目？ | 關閉前是否要儲存專案？ |
| buttons[0] | Save & Close | 保存并关闭 | 儲存並關閉 |
| buttons[1] | Discard & Close | 不保存直接关闭 | 不儲存直接關閉 |
| buttons[2] | Cancel | 取消 | 取消 |

---

### 2. 顶栏自动保存状态提示

**目标**：让用户知道自动保存正在进行，以及上次保存的时机。

**状态机**：

```
idle ──(save starts)──▶ saving ──(save done)──▶ saved ──(2s timeout)──▶ idle
                                  └──(error)──▶ idle
```

**实现**：

- `VideoEditor.tsx` 新增 `autosaveStatus: 'idle' | 'saving' | 'saved'` state  
- `saveProject` 函数：  
  - 开始时若 `options.silent` → 设为 `'saving'`  
  - 成功后 → 设为 `'saved'`，启动 2 秒 timer 后重置为 `'idle'`  
  - 失败/取消 → 设为 `'idle'`  
- 手动保存（Ctrl+S / Save 按钮）成功后也短暂显示 `'saved'`

**UI 位置**：Save 按钮左侧，小灰字（`text-[11px] text-muted-foreground`）：

```
[保存中...]  或  [已保存]  或  （空）    [Save]
```

- `saving` → 显示 `t("editor.project.saving", "Saving...")`
- `saved` → 显示 `t("editor.project.saved", "Saved")`
- `idle` → 不渲染

**i18n key 新增**（`editor.json` + 各语言）：

| key | en | zh-CN | zh-TW |
|---|---|---|---|
| `editor.project.saving` | Saving... | 保存中... | 儲存中... |
| `editor.project.saved` | Saved | 已保存 | 已儲存 |

---

## 不在范围内

- 新建项目（无路径）的自动保存行为不变——关闭时弹框让用户主动选路径是合理行为
- 其他语言（es/fr/it 等）的关闭对话框翻译不在此次范围，继续使用 en fallback

---

## 受影响文件

| 文件 | 改动 |
|---|---|
| `electron/preload.ts` | 新增 `setLocale` API |
| `electron/main.ts` | 新增 `editorLocale` 变量、`getCloseDialogStrings`、注册 IPC handler |
| `src/contexts/I18nContext.tsx` | locale 变化时通知主进程 |
| `src/components/video-editor/VideoEditor.tsx` | 新增 `autosaveStatus` state 及 UI |
| `src/i18n/locales/en/editor.json` | 新增 `project.saving`、`project.saved` |
| `src/i18n/locales/zh-CN/editor.json` | 同上（中文） |
| `src/i18n/locales/zh-TW/editor.json` | 同上（繁中） |
