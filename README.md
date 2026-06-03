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
