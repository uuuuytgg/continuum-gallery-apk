# Continuum Gallery APK

An Android wrapper for Continuum Gallery, built with Capacitor. This fork removes Google Photos/OAuth and uses local on-device photo import through the Android file picker.

No GitHub Pages deployment is required for this repository.

## Features

- Local image import with `<input type="file" multiple>`.
- Imported photos are stored in IndexedDB and restored on next launch.
- Imported images are recompressed before storage to reduce import time and memory pressure.
- Adaptive Android WebView effects:
  - `low`: Snapdragon 778G / Adreno 642-class anchor, using the fast fixed-size motion layout.
  - `balanced`: mid/high GPUs, using full motion layout with lighter effects and throttling.
  - `full`: Snapdragon 8+ Gen 1 / Adreno 730 and above, using the full visual treatment.
- No Google Photos, OAuth, Client ID, or cloud photo API dependency.
- No `INTERNET` permission in the Android manifest.

## Requirements

- Node.js 18+
- JDK 21
- Android SDK with platform/build tools for API 36

## Build

```powershell
npm install
npm run check:web
npm run sync
cd android
.\gradlew.bat assembleDebug
```

The debug APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Effect Tier Override

For debugging, set this key in the app WebView console:

```js
localStorage.setItem("continuum-gallery.effectTier", "low");
localStorage.setItem("continuum-gallery.effectTier", "balanced");
localStorage.setItem("continuum-gallery.effectTier", "full");
```

Clear the override:

```js
localStorage.removeItem("continuum-gallery.effectTier");
```

## Changelog

### v1.0.9 (2026-06-05)

- **Fixed:** Topbar controls overlapped by Android status bar on edge-to-edge devices.
  - Increased topbar offset from 18px to 72px to clear system status bar area.
  - Pre-injected `--native-safe-top` CSS variable in `<head>` for first-paint correctness.
  - Viewer frame padding also adjusted for consistent safe-area handling.
- Updated app.js version cache-bust.

### v1.0.8 (2026-06-04)

- Rollback: Revert "Delay viewer scrim until image reveal".

### v1.0.7 (2026-06-04)

- Delay viewer scrim until image reveal.

### v1.0.6 (2026-06-04)

- Fix viewer image promotion and splash overlay.

### v1.0.5 (2026-06-04)

- Fix viewer image swap and edge-to-edge insets.

### v1.0.4 (2026-06-04)

- Lower full tier threshold and stabilize viewer open.

### v1.0.3 (2026-06-04)

- Broaden high-end Android full tier detection.

### v1.0.2 (2026-06-04)

- Detect high-end Android SoCs for full effects.

### v1.0.1 (2026-06-04)

- Fix low-tier viewer transition flicker.

### v1.0.0 (2026-06-03)

- Initial open source release.

## Source Notes

This repository is a standalone Android packaging version. It intentionally does not enable GitHub Pages and does not depend on the original Google Photos picker flow.

## License

MIT

---

# Continuum Gallery APK 简体中文版

这是 Continuum Gallery 的 Android 打包版，使用 Capacitor 构建。这个版本移除了 Google Photos / OAuth，改为通过 Android 系统文件选择器导入本地照片。

这个仓库不需要开启 GitHub Pages。

## 功能

- 支持从本机批量导入图片。
- 导入后的图片会存入 IndexedDB，下次打开 App 会自动恢复。
- 导入时会压缩图片，降低导入耗时和内存压力。
- Android WebView 动效自适应分级：
  - `low`：以 Snapdragon 778G / Adreno 642 档位为锚点，使用更稳的固定尺寸滑动态。
  - `balanced`：中高端 GPU，保留完整运动布局，但降低粒子、阴影和刷新频率。
  - `full`：Snapdragon 8+ Gen 1 / Adreno 730 及以上，开启满血动效。
- 不依赖 Google Photos、OAuth、Client ID 或云端照片 API。
- Android Manifest 不申请 `INTERNET` 权限。

## 更新日志

### v1.0.9 (2026-06-05)

- **修复：** 顶部控制栏被 Android 状态栏遮挡（全面屏设备）。
  - topbar 偏移从 18px 增加到 72px，避开系统状态栏区域。
  - 在 `<head>` 中预注入 `--native-safe-top` CSS 变量，确保首帧渲染正确。
  - 查看器内边距同步调整，兼容安全区域逻辑。
- 更新 app.js 版本缓存。

### v1.0.8 (2026-06-04)

- 回滚：撤销「延迟查看器遮罩至图片显示」。

### v1.0.7 (2026-06-04)

- 延迟查看器遮罩至图片显示。

### v1.0.6 (2026-06-04)

- 修复查看器图片切换与启动遮罩。

### v1.0.5 (2026-06-04)

- 修复查看器图片交换与全屏安全区域。

### v1.0.4 (2026-06-04)

- 降低满血档位门槛，优化查看器打开稳定性。

### v1.0.3 (2026-06-04)

- 扩展高端 Android 满血动效检测范围。

### v1.0.2 (2026-06-04)

- 新增高端 Android SoC 检测，自动开启满血动效。

### v1.0.1 (2026-06-04)

- 修复低端设备查看器切换闪烁。

### v1.0.0 (2026-06-03)

- 初始开源版本。

## 构建环境

- Node.js 18+
- JDK 21
- Android SDK，包含 API 36 平台和构建工具

## 构建命令

```powershell
npm install
npm run check:web
npm run sync
cd android
.\gradlew.bat assembleDebug
```

生成的 debug APK 位于：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 手动指定动效档位

调试时可以在 App 的 WebView 控制台设置：

```js
localStorage.setItem("continuum-gallery.effectTier", "low");
localStorage.setItem("continuum-gallery.effectTier", "balanced");
localStorage.setItem("continuum-gallery.effectTier", "full");
```

清除手动指定：

```js
localStorage.removeItem("continuum-gallery.effectTier");
```

## 说明

这是独立的 Android 打包版本，不需要 GitHub Pages，也不包含原来的 Google Photos 选择器流程。

## 许可证

MIT
