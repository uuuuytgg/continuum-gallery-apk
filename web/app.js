const stage = document.getElementById("stage");
const gallery = document.getElementById("gallery");
const grainCanvas = document.getElementById("grainCanvas");
const grainCtx = grainCanvas.getContext("2d");
const modeButtons = document.getElementById("modeButtons");
const modeLabel = document.getElementById("modeLabel");
const modeToast = document.getElementById("modeToast");
const immersiveButton = document.getElementById("immersiveButton");
const focusButton = document.getElementById("focusButton");
const importButton = document.getElementById("importButton");
const photosPanel = document.getElementById("photosPanel");
const photosPanelClose = document.getElementById("photosPanelClose");
const photoFileInput = document.getElementById("photoFileInput");
const clearPhotosButton = document.getElementById("clearPhotosButton");
const importPhotosButton = document.getElementById("importPhotosButton");
const photosStatus = document.getElementById("photosStatus");
const viewer = document.getElementById("viewer");
const viewerImage = document.getElementById("viewerImage");
const viewerTitle = document.getElementById("viewerTitle");
const viewerMeta = document.getElementById("viewerMeta");
const viewerClose = document.getElementById("viewerClose");
const viewerFrame = document.getElementById("viewerFrame");
const viewerImageStage = document.getElementById("viewerImageStage");
const viewerZoomOut = document.getElementById("viewerZoomOut");
const viewerZoomReset = document.getElementById("viewerZoomReset");
const viewerZoomIn = document.getElementById("viewerZoomIn");

const MODES = ["waterfall", "orbit", "sphere"];
const PHOTO_DB_NAME = "continuum-gallery.photos";
const PHOTO_DB_VERSION = 1;
const PHOTO_STORE_NAME = "albums";
const ACTIVE_ALBUM_ID = "active-local-photos";
const IS_ANDROID_WEBVIEW = /Android/i.test(navigator.userAgent);
const PREFERS_REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const EFFECT_TIER_OVERRIDE_KEY = "continuum-gallery.effectTier";
const EFFECT_PROFILES = {
  low: {
    importDisplayMaxSide: 1600,
    importPreviewMaxSide: 420,
    importDisplayQuality: 0.78,
    importPreviewQuality: 0.68,
    canvasDpr: 1,
    particles: 72,
    lanes: 3,
    layoutInterval: 32,
    particleWaterfallInterval: 180,
    particleMotionInterval: 66,
    fastMotionLayout: true,
  },
  balanced: {
    importDisplayMaxSide: 1700,
    importPreviewMaxSide: 500,
    importDisplayQuality: 0.8,
    importPreviewQuality: 0.72,
    canvasDpr: 1.25,
    particles: 112,
    lanes: 4,
    layoutInterval: 32,
    particleWaterfallInterval: 120,
    particleMotionInterval: 40,
    fastMotionLayout: false,
  },
  full: {
    importDisplayMaxSide: 1800,
    importPreviewMaxSide: 560,
    importDisplayQuality: 0.82,
    importPreviewQuality: 0.76,
    canvasDpr: 2,
    particles: 170,
    lanes: 6,
    layoutInterval: 0,
    particleWaterfallInterval: 0,
    particleMotionInterval: 0,
    fastMotionLayout: false,
  },
};
const GPU_RENDERER = getGpuRenderer();
let effectTier = detectInitialEffectTier(GPU_RENDERER);
let effectProfile = EFFECT_PROFILES[effectTier];
const MODE_NAMES = {
  waterfall: "瀑布流",
  orbit: "球形滑动",
  sphere: "粒子球",
};

const titles = [
  "潮汐", "暮野", "冷焰", "雾港", "蓝径", "赤桥", "金屿", "霓窗",
  "回声", "云井", "石歌", "松影", "夜航", "镜湖", "风塔", "花火",
  "远山", "沙时", "微光", "白昼", "深巷", "长坡", "星幕", "玻璃",
  "雨台", "旧梦", "轻轨", "野餐", "晴面", "流金", "群青", "新雪",
  "环岛", "低云", "暖墙", "细浪", "纸月", "暗房", "海盐", "慢坡",
];

const places = [
  "城市", "海边", "旷野", "屋顶", "清晨", "黄昏", "雨后", "山口",
  "街角", "展厅", "天台", "湖畔",
];

const state = {
  mode: "waterfall",
  selected: 0,
  isPointerDown: false,
  didDrag: false,
  lastX: 0,
  lastY: 0,
  pointerX: -9999,
  pointerY: -9999,
  transitionUntil: 0,
  lastZoomSwitch: 0,
  viewer: {
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    lastX: 0,
    lastY: 0,
  },
  orbit: {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  },
  sphere: {
    rotX: -0.22,
    rotY: 0.34,
    vx: 0.0018,
    vy: 0.0024,
    radiusBoost: 0,
  },
  photos: {
    isImporting: false,
    objectUrls: [],
  },
};

const items = createItems();
const cards = [];
const cardLayouts = new WeakMap();
let spherePoints = [];
let physics = [];
let grainParticles = [];
let resizeTimer = 0;
let imageLayoutTimer = 0;
let lastParticleFrame = 0;
let lastLayoutFrame = 0;

init();

function getGpuRenderer() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
    return debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "") : "";
  } catch {
    return "";
  }
}

function detectInitialEffectTier(renderer) {
  const override = readEffectTierOverride();
  if (override) return override;
  if (PREFERS_REDUCED_MOTION) return "low";

  const gpuTier = tierFromGpuRenderer(renderer);
  if (gpuTier) return gpuTier;

  return IS_ANDROID_WEBVIEW ? "low" : "full";
}

function readEffectTierOverride() {
  try {
    const value = localStorage.getItem(EFFECT_TIER_OVERRIDE_KEY);
    return Object.prototype.hasOwnProperty.call(EFFECT_PROFILES, value) ? value : "";
  } catch {
    return "";
  }
}

function tierFromGpuRenderer(renderer) {
  const text = renderer.toLowerCase();
  const adrenoMatch = text.match(/adreno(?:\s+\(tm\))?\s+(\d+)/i);
  if (adrenoMatch) {
    const model = Number(adrenoMatch[1]);
    if (model >= 730) return "full";
    if (model >= 650 || model >= 710) return "balanced";
    return "low";
  }

  if (/\bimmortalis\b|\bmali-g7[12]\d\b|\bxclipse\b/.test(text)) return "full";
  if (/\bmali-g6\d\d\b|\bmali-g5\d\b/.test(text)) return "balanced";

  return "";
}

function applyEffectTier(nextTier) {
  effectTier = Object.prototype.hasOwnProperty.call(EFFECT_PROFILES, nextTier) ? nextTier : "low";
  effectProfile = EFFECT_PROFILES[effectTier];
  document.body.dataset.effectTier = effectTier;
  document.body.classList.toggle("is-low-power", effectTier === "low");
  document.body.classList.toggle("is-balanced-power", effectTier === "balanced");
  document.body.classList.toggle("is-full-power", effectTier === "full");
}

function schedulePerformanceCalibration() {
  if (!IS_ANDROID_WEBVIEW || PREFERS_REDUCED_MOTION || readEffectTierOverride() || tierFromGpuRenderer(GPU_RENDERER)) {
    return;
  }

  window.setTimeout(async () => {
    const score = await measureCanvasThroughput();
    const nextTier = score > 5.6 ? "full" : score > 3.2 ? "balanced" : "low";
    if (nextTier !== effectTier) {
      applyEffectTier(nextTier);
      buildSpherePoints();
      resizeCanvas();
      applyLayout({ immediate: true });
    }
    console.info(`Continuum Gallery effect tier: ${effectTier}`, { renderer: GPU_RENDERER || "unknown", score });
  }, 900);
}

async function measureCanvasThroughput() {
  await nextFrame();
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 240;
  const ctx = canvas.getContext("2d", { alpha: false });
  const start = performance.now();
  for (let frame = 0; frame < 120; frame += 1) {
    ctx.fillStyle = `rgb(${frame % 255}, ${(frame * 3) % 255}, ${(frame * 7) % 255})`;
    ctx.fillRect(0, 0, 240, 240);
    for (let dot = 0; dot < 96; dot += 1) {
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc((dot * 37 + frame * 5) % 240, (dot * 19 + frame * 3) % 240, 5 + dot % 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const elapsed = Math.max(1, performance.now() - start);
  return 120 / elapsed;
}

function init() {
  applyEffectTier(effectTier);
  setImportStatus("选择本地照片");
  renderCards();
  buildSpherePoints();
  resizeCanvas();
  applyLayout({ immediate: true });
  requestAnimationFrame(tick);
  schedulePerformanceCalibration();
  restorePersistedPhotos();

  window.addEventListener("resize", handleResize);
  modeButtons.addEventListener("click", handleModeButton);
  immersiveButton.addEventListener("click", handleImmersive);
  focusButton.addEventListener("click", () => openViewer(state.selected));
  importButton.addEventListener("click", openPhotosPanel);
  photosPanelClose.addEventListener("click", closePhotosPanel);
  clearPhotosButton.addEventListener("click", clearImportedPhotos);
  importPhotosButton.addEventListener("click", () => photoFileInput.click());
  photoFileInput.addEventListener("change", handleLocalPhotosSelected);
  gallery.addEventListener("click", handleCardClick);
  stage.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  stage.addEventListener("wheel", handleWheel, { passive: false });
  viewerClose.addEventListener("click", closeViewer);
  viewerZoomOut.addEventListener("click", () => zoomViewerBy(0.8));
  viewerZoomReset.addEventListener("click", resetViewerTransform);
  viewerZoomIn.addEventListener("click", () => zoomViewerBy(1.25));
  viewerFrame.addEventListener("wheel", handleViewerWheel, { passive: false });
  viewerFrame.addEventListener("pointerdown", handleViewerPointerDown);
  viewerFrame.addEventListener("dblclick", handleViewerDoubleClick);
  window.addEventListener("pointermove", handleViewerPointerMove);
  window.addEventListener("pointerup", handleViewerPointerUp);
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) closeViewer();
  });
  window.addEventListener("keydown", (event) => {
    if (!viewer.classList.contains("is-open")) return;
    if (event.key === "Escape") closeViewer();
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomViewerBy(1.2);
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomViewerBy(0.84);
    }
    if (event.key === "0") {
      event.preventDefault();
      resetViewerTransform();
    }
  });
}

function createItems() {
  const ratios = [1.22, 0.78, 1.45, 0.92, 1.08, 1.58, 0.72, 1.34, 0.84, 1.18];
  const generated = Array.from({ length: 39 }, (_, index) => {
    const ratio = ratios[index % ratios.length];
    return {
      title: titles[index % titles.length],
      place: places[index % places.length],
      ratio,
      source: "demo",
      src: makeArtwork(index, ratio),
    };
  });

  return generated;
}

function makeArtwork(index, ratio) {
  const width = 520;
  const height = Math.max(360, Math.round(width * ratio));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const palette = [
    ["126, 231, 255", "216, 255, 99", "14, 16, 18"],
    ["240, 90, 162", "216, 255, 99", "12, 12, 16"],
    ["157, 140, 255", "126, 231, 255", "10, 13, 18"],
    ["233, 227, 210", "216, 255, 99", "13, 14, 12"],
    ["126, 231, 255", "157, 140, 255", "10, 10, 15"],
  ][index % 5];

  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = `rgb(${palette[2]})`;
  ctx.fillRect(0, 0, width, height);

  const baseGlow = ctx.createLinearGradient(0, 0, width, height);
  baseGlow.addColorStop(0, `rgba(${palette[0]}, 0.34)`);
  baseGlow.addColorStop(0.38, "rgba(255, 255, 255, 0.04)");
  baseGlow.addColorStop(0.68, `rgba(${palette[1]}, 0.22)`);
  baseGlow.addColorStop(1, "rgba(0, 0, 0, 0.58)");
  ctx.fillStyle = baseGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "screen";
  for (let layer = 0; layer < 7; layer += 1) {
    const y = height * (0.16 + layer * 0.12);
    const alpha = 0.08 - layer * 0.006;
    ctx.strokeStyle = `rgba(${layer % 2 ? palette[1] : palette[0]}, ${alpha})`;
    ctx.lineWidth = 1 + layer * 0.24;
    ctx.beginPath();
    ctx.moveTo(-30, y);
    for (let x = -30; x <= width + 30; x += 28) {
      const wave = Math.sin(index * 0.7 + layer + x * 0.017) * (16 + layer * 3);
      ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 16; i += 1) {
    const x = ((index * 73 + i * 47) % width);
    const bandWidth = 1 + i % 3;
    ctx.fillStyle = `rgba(${i % 2 ? palette[1] : palette[0]}, ${0.035 + (i % 4) * 0.012})`;
    ctx.fillRect(x, 0, bandWidth, height);
  }

  for (let i = 0; i < 2200; i += 1) {
    const tone = 140 + ((i + index * 19) % 96);
    const alpha = i % 11 === 0 ? 0.09 : 0.035;
    ctx.fillStyle = `rgba(${tone}, ${tone}, ${tone}, ${alpha})`;
    ctx.fillRect((i * 31) % width, (i * 67) % height, 1, 1);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i += 1) {
    const y = height * (0.12 + i * 0.075);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + Math.sin(index + i) * 22);
    ctx.stroke();
  }

  return canvas.toDataURL("image/jpeg", 0.86);
}

function renderCards() {
  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    const card = createPhotoCard(item, index);
    cards.push(card);
    fragment.appendChild(card);
  });
  gallery.appendChild(fragment);
}

function createPhotoCard(item, index) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "photo-card";
  card.dataset.index = String(index);
  card.setAttribute("aria-label", `${item.title} ${item.place}`);
  card.innerHTML = `
    <img alt="${item.title}" draggable="false" loading="lazy" decoding="async" src="${getCardImageSrc(item)}">
    <span class="caption">
      <strong>${item.title}</strong>
      <span>${item.place}</span>
    </span>
  `;

  const image = card.querySelector("img");
  image.addEventListener("load", () => {
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      item.ratio = image.naturalHeight / image.naturalWidth;
      if (state.mode === "waterfall") scheduleWaterfallRelayout();
    }
  });

  return card;
}

function getCardImageSrc(item) {
  return item.previewSrc || item.src;
}

function updateCardPreview(index) {
  const card = cards[index];
  const item = items[index];
  if (!card || !item) return;
  const image = card.querySelector("img");
  const src = getCardImageSrc(item);
  if (image && image.src !== src) image.src = src;
}

function scheduleWaterfallRelayout() {
  window.clearTimeout(imageLayoutTimer);
  imageLayoutTimer = window.setTimeout(() => {
    if (state.mode === "waterfall") applyLayout({ immediate: true });
  }, 80);
}

function replacePhotoItems(newItems) {
  if (!newItems.length) return;
  const fragment = document.createDocumentFragment();
  releaseDisplayedObjectUrls();
  cards.length = 0;
  items.length = 0;
  gallery.replaceChildren();

  newItems.forEach((item, index) => {
    items.push(item);
    const card = createPhotoCard(item, index);
    cards.push(card);
    fragment.appendChild(card);
  });

  gallery.appendChild(fragment);
  buildSpherePoints();
  state.selected = 0;
  if (state.mode === "orbit") {
    centerOrbitOn(0);
    applyLayout({ immediate: false });
  } else {
    setMode("orbit", { focusIndex: 0 });
  }
}

function restorePhotoItems(newItems) {
  if (!newItems.length) return;
  const fragment = document.createDocumentFragment();
  releaseDisplayedObjectUrls();
  cards.length = 0;
  items.length = 0;
  gallery.replaceChildren();

  newItems.forEach((item, index) => {
    items.push(item);
    const card = createPhotoCard(item, index);
    cards.push(card);
    fragment.appendChild(card);
  });

  gallery.appendChild(fragment);
  buildSpherePoints();
  state.selected = 0;
  applyLayout({ immediate: true });
}

function releaseDisplayedObjectUrls() {
  items.forEach((item) => {
    if (item.source !== "demo" && typeof item.src === "string" && item.src.startsWith("blob:")) {
      URL.revokeObjectURL(item.src);
    }
    if (item.source !== "demo" && typeof item.previewSrc === "string" && item.previewSrc.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewSrc);
    }
  });
}

function buildSpherePoints() {
  const golden = Math.PI * (3 - Math.sqrt(5));
  spherePoints = items.map((_, index) => {
    const y = 1 - (index / Math.max(1, items.length - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * index;
    return {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    };
  });

  physics = items.map(() => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 36,
  }));

  const particleCount = effectProfile.particles;
  grainParticles = Array.from({ length: particleCount }, (_, index) => ({
    a: index * 0.78,
    r: 0.15 + ((index * 17) % 100) / 100,
    drift: 0.35 + ((index * 7) % 100) / 180,
    size: 0.75 + ((index * 13) % 8) / 10,
    lane: index % 9,
    tone: index % 4,
  }));
}

function handleResize() {
  resizeCanvas();
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    applyLayout({ immediate: true });
  }, 80);
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, effectProfile.canvasDpr);
  grainCanvas.width = Math.round(window.innerWidth * dpr);
  grainCanvas.height = Math.round(window.innerHeight * dpr);
  grainCanvas.style.width = `${window.innerWidth}px`;
  grainCanvas.style.height = `${window.innerHeight}px`;
  grainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function handleModeButton(event) {
  const button = event.target.closest("button[data-mode]");
  if (!button) return;
  setMode(button.dataset.mode);
}

function handleImmersive() {
  if (state.mode === "orbit") {
    setMode("waterfall");
    return;
  }
  if (state.mode === "sphere") {
    setMode("orbit", { focusIndex: state.selected });
    return;
  }
  openViewer(state.selected);
}

function openPhotosPanel() {
  photosPanel.classList.add("is-open");
  photosPanel.setAttribute("aria-hidden", "false");
  importPhotosButton.focus();
}

function closePhotosPanel() {
  photosPanel.classList.remove("is-open");
  photosPanel.setAttribute("aria-hidden", "true");
}

async function handleLocalPhotosSelected(event) {
  if (state.photos.isImporting) return;
  const files = Array.from(event.target.files || [])
    .filter((file) => file.type.startsWith("image/"));

  photoFileInput.value = "";

  if (!files.length) {
    setImportStatus("没有选择图片");
    return;
  }

  state.photos.isImporting = true;
  importPhotosButton.disabled = true;
  clearPhotosButton.disabled = true;
  setImportStatus(`读取 ${files.length} 张照片...`);

  try {
    const importedItems = await materializeLocalPhotos(files);
    if (!importedItems.length) {
      setImportStatus("没有可导入的图片");
      return;
    }

    await savePersistedPhotos(importedItems);
    replacePhotoItems(importedItems);
    closePhotosPanel();
    showToast(`本地照片 +${importedItems.length}`);
    setImportStatus(`已导入 ${importedItems.length} 张`);
  } catch (error) {
    setImportStatus(error.message || "导入失败");
  } finally {
    state.photos.isImporting = false;
    importPhotosButton.disabled = false;
    clearPhotosButton.disabled = false;
  }
}

async function clearImportedPhotos() {
  if (state.photos.isImporting) return;
  clearPhotosButton.disabled = true;
  importPhotosButton.disabled = true;

  try {
    await clearPersistedPhotos();
    restorePhotoItems(createItems());
    setImportStatus("已清空");
    showToast("已恢复示例照片");
  } catch (error) {
    setImportStatus(error.message || "清空失败");
  } finally {
    clearPhotosButton.disabled = false;
    importPhotosButton.disabled = false;
  }
}

async function materializeLocalPhotos(files) {
  const imported = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    setImportStatus(`处理 ${index + 1}/${files.length}`);

    try {
      const { blob, previewBlob, ratio } = await prepareLocalPhoto(file);
      const objectUrl = URL.createObjectURL(blob);
      const previewUrl = previewBlob ? URL.createObjectURL(previewBlob) : "";
      state.photos.objectUrls.push(objectUrl);
      if (previewUrl) state.photos.objectUrls.push(previewUrl);
      imported.push({
        id: `${Date.now()}-${index}-${file.name}`,
        title: cleanFilename(file.name || `Photo ${index + 1}`),
        place: "本地导入",
        ratio,
        source: "local",
        blob,
        previewBlob,
        src: objectUrl,
        previewSrc: previewUrl,
      });
    } catch (error) {
      console.warn("Skipping local photo", error);
    }

    if (index % 3 === 2) {
      await nextFrame();
    }
  }

  return imported;
}

async function prepareLocalPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const ratio = bitmap.height / Math.max(1, bitmap.width);
  const [blob, previewBlob] = await Promise.all([
    resizeBitmapToJpegBlob(bitmap, effectProfile.importDisplayMaxSide, effectProfile.importDisplayQuality),
    resizeBitmapToJpegBlob(bitmap, effectProfile.importPreviewMaxSide, effectProfile.importPreviewQuality),
  ]);
  bitmap.close?.();

  return {
    blob: blob || file.slice(0, file.size, file.type || "image/jpeg"),
    previewBlob,
    ratio,
  };
}

async function resizeBitmapToJpegBlob(bitmap, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvasToJpegBlob(canvas, quality);
}

async function restorePersistedPhotos() {
  try {
    const records = await loadPersistedPhotos();
    if (!records.length) return;

    const restored = records.map((record, index) => {
      const src = URL.createObjectURL(record.blob);
      const previewSrc = record.previewBlob ? URL.createObjectURL(record.previewBlob) : "";
      state.photos.objectUrls.push(src);
      if (previewSrc) state.photos.objectUrls.push(previewSrc);
      return {
        id: record.id || `restored-${index}`,
        title: record.title || `Photo ${index + 1}`,
        place: record.place || "本地导入",
        ratio: record.ratio || 1,
        source: record.source || "local",
        blob: record.blob,
        previewBlob: record.previewBlob,
        src,
        previewSrc,
      };
    });

    restorePhotoItems(restored);
    hydrateMissingPreviews(restored);
    setImportStatus(`已恢复 ${restored.length} 张`);
  } catch (error) {
    console.warn("Could not restore persisted photos", error);
  }
}

function hydrateMissingPreviews(photoItems) {
  if (!("createImageBitmap" in window)) return;
  const pending = photoItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.blob instanceof Blob && !item.previewBlob);

  if (!pending.length) return;

  const run = async () => {
    let didCreatePreview = false;
    for (const { item, index } of pending) {
      try {
        const previewBlob = await makePreviewBlob(item.blob);
        if (!previewBlob) continue;
        const previewSrc = URL.createObjectURL(previewBlob);
        item.previewBlob = previewBlob;
        item.previewSrc = previewSrc;
        state.photos.objectUrls.push(previewSrc);
        updateCardPreview(index);
        didCreatePreview = true;
        await delay(16);
      } catch (error) {
        console.warn("Could not build preview", error);
      }
    }
    if (didCreatePreview) savePersistedPhotos(photoItems).catch(() => {});
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => run(), { timeout: 1800 });
  } else {
    window.setTimeout(run, 600);
  }
}

async function makePreviewBlob(blob) {
  const bitmap = await createImageBitmap(blob);
  const previewBlob = await resizeBitmapToJpegBlob(bitmap, effectProfile.importPreviewMaxSide, effectProfile.importPreviewQuality);
  bitmap.close?.();
  return previewBlob;
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

async function savePersistedPhotos(photoItems) {
  if (!("indexedDB" in window)) return;
  const records = photoItems
    .filter((item) => item.blob instanceof Blob)
    .map((item, index) => ({
      id: item.id || `photo-${index}`,
      title: item.title,
      place: item.place,
      ratio: item.ratio,
      source: item.source,
      blob: item.blob,
      previewBlob: item.previewBlob,
    }));

  if (!records.length) return;
  const db = await openPhotoDb();
  await writePhotoDb(db, (store) => {
    store.put({
      id: ACTIVE_ALBUM_ID,
      updatedAt: Date.now(),
      photos: records,
    });
  });
  db.close();
}

async function loadPersistedPhotos() {
  if (!("indexedDB" in window)) return [];
  const db = await openPhotoDb();
  const album = await readPhotoDb(db, (store) => store.get(ACTIVE_ALBUM_ID));
  db.close();
  return album?.photos || [];
}

async function clearPersistedPhotos() {
  if (!("indexedDB" in window)) return;
  const db = await openPhotoDb();
  await writePhotoDb(db, (store) => {
    store.delete(ACTIVE_ALBUM_ID);
  });
  db.close();
}

function openPhotoDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PHOTO_DB_NAME, PHOTO_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
        db.createObjectStore(PHOTO_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readPhotoDb(db, action) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE_NAME, "readonly");
    const store = transaction.objectStore(PHOTO_STORE_NAME);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function writePhotoDb(db, action) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE_NAME, "readwrite");
    const store = transaction.objectStore(PHOTO_STORE_NAME);
    action(store);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function setImportStatus(text) {
  photosStatus.value = text;
}

function cleanFilename(filename) {
  return filename.replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, 42);
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function handleCardClick(event) {
  const card = event.target.closest(".photo-card");
  if (!card || state.didDrag) return;
  const index = Number(card.dataset.index);
  state.selected = index;

  if (state.mode === "sphere") {
    setMode("orbit", { focusIndex: index });
    return;
  }

  openViewer(index);
}

function handlePointerDown(event) {
  if (viewer.classList.contains("is-open")) return;
  if (state.mode === "waterfall") return;

  state.isPointerDown = true;
  state.didDrag = false;
  state.lastX = event.clientX;
  state.lastY = event.clientY;
  state.pointerX = event.clientX;
  state.pointerY = event.clientY;
  document.body.classList.add("is-dragging");
  stage.setPointerCapture?.(event.pointerId);
}

function handlePointerMove(event) {
  state.pointerX = event.clientX;
  state.pointerY = event.clientY;
  if (!state.isPointerDown) return;

  const dx = event.clientX - state.lastX;
  const dy = event.clientY - state.lastY;
  if (Math.abs(dx) + Math.abs(dy) > 4) state.didDrag = true;

  if (state.mode === "orbit") {
    state.orbit.x += dx;
    state.orbit.y += dy;
    state.orbit.vx = dx;
    state.orbit.vy = dy;
  }

  if (state.mode === "sphere") {
    state.sphere.rotY += dx * 0.008;
    state.sphere.rotX -= dy * 0.006;
    state.sphere.vy = dx * 0.00018;
    state.sphere.vx = -dy * 0.00014;
    state.sphere.radiusBoost = Math.min(26, state.sphere.radiusBoost + Math.hypot(dx, dy) * 0.08);
  }

  state.lastX = event.clientX;
  state.lastY = event.clientY;
}

function handlePointerUp() {
  if (!state.isPointerDown) return;
  state.isPointerDown = false;
  document.body.classList.remove("is-dragging");
  window.setTimeout(() => {
    state.didDrag = false;
  }, 40);
}

function handleWheel(event) {
  const now = performance.now();
  const isZoomIntent = event.ctrlKey;

  if (isZoomIntent && now - state.lastZoomSwitch > 620) {
    event.preventDefault();
    const current = MODES.indexOf(state.mode);
    const nextIndex = event.deltaY > 0
      ? Math.min(MODES.length - 1, current + 1)
      : Math.max(0, current - 1);
    if (nextIndex !== current) {
      state.lastZoomSwitch = now;
      setMode(MODES[nextIndex]);
    }
    return;
  }

  if (state.mode === "orbit") {
    event.preventDefault();
    state.orbit.x -= event.deltaX * 0.75;
    state.orbit.y -= event.deltaY * 0.75;
    state.orbit.vx = -event.deltaX * 0.08;
    state.orbit.vy = -event.deltaY * 0.08;
  }

  if (state.mode === "sphere") {
    event.preventDefault();
    state.sphere.radiusBoost = clamp(state.sphere.radiusBoost + event.deltaY * 0.025, -22, 34);
  }
}

function setMode(nextMode, options = {}) {
  if (!MODES.includes(nextMode) || nextMode === state.mode) return;
  state.mode = nextMode;
  if (typeof options.focusIndex === "number") state.selected = options.focusIndex;

  if (nextMode === "orbit") centerOrbitOn(state.selected);

  document.body.dataset.mode = nextMode;
  document.body.classList.add("is-switching");
  state.transitionUntil = performance.now() + 920;
  updateModeChrome();
  applyLayout({ immediate: false });
  showToast(MODE_NAMES[nextMode]);

  window.setTimeout(() => {
    document.body.classList.remove("is-switching");
    applyLayout({ immediate: true });
  }, 930);
}

function updateModeChrome() {
  modeLabel.textContent = MODE_NAMES[state.mode];
  for (const button of modeButtons.querySelectorAll("button[data-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
  }
  immersiveButton.textContent = state.mode === "waterfall" ? "观赏" : "沉浸";
}

function showToast(text) {
  modeToast.textContent = text;
  modeToast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    modeToast.classList.remove("is-visible");
  }, 620);
}

function centerOrbitOn(index) {
  const grid = getOrbitGrid();
  const point = getOrbitPoint(index, grid);
  state.orbit.x = -point.x;
  state.orbit.y = -point.y;
  state.orbit.vx = 0;
  state.orbit.vy = 0;
}

function applyLayout({ immediate = false } = {}) {
  if (immediate) cards.forEach((card) => card.classList.remove("is-settling"));
  if (state.mode === "waterfall") applyWaterfallLayout();
  if (state.mode === "orbit") applyOrbitLayout();
  if (state.mode === "sphere") applySphereLayout({ seedPhysics: true });
}

function applyWaterfallLayout() {
  const width = stage.clientWidth;
  const gap = width < 700 ? 12 : 16;
  const side = width < 700 ? 12 : 24;
  const top = width < 700 ? 82 : 96;
  const bottom = 116;
  const columnCount = width >= 1360 ? 5 : width >= 1080 ? 4 : width >= 760 ? 3 : width >= 520 ? 2 : 1;
  const cardWidth = Math.floor((width - side * 2 - gap * (columnCount - 1)) / columnCount);
  const columns = Array.from({ length: columnCount }, () => top);

  cards.forEach((card, index) => {
    const item = items[index];
    const column = columns.indexOf(Math.min(...columns));
    const x = side + column * (cardWidth + gap);
    const y = columns[column];
    const height = Math.round(cardWidth * clamp(item.ratio, 0.68, 1.62));
    columns[column] += height + gap;
    setCardStyle(card, {
      x,
      y,
      width: cardWidth,
      height,
      opacity: 1,
      z: 1,
      radius: 8,
      filter: "none",
    });
  });

  gallery.style.height = `${Math.max(stage.clientHeight, Math.max(...columns) + bottom)}px`;
}

function applyOrbitLayout() {
  if (effectProfile.fastMotionLayout) {
    applyFastOrbitLayout();
    return;
  }

  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  const base = width < 540 ? 58 : width < 920 ? 70 : 82;
  const grid = getOrbitGrid();
  gallery.style.height = `${height}px`;

  cards.forEach((card, index) => {
    const point = getOrbitPoint(index, grid);
    const fieldX = point.x + state.orbit.x;
    const fieldY = point.y + state.orbit.y;
    const distance = Math.hypot(fieldX, fieldY);
    const lens = 1 + Math.max(0, 1 - distance / 430) * 0.18;
    const screenX = centerX + fieldX * lens;
    const screenY = centerY + fieldY * lens;
    const scale = clamp(1.18 - distance / 560, 0.44, 1.18);
    const size = Math.round(base * scale);
    const isSelected = index === state.selected;

    setCardStyle(card, {
      x: screenX - size / 2,
      y: screenY - size / 2,
      width: size,
      height: size,
      opacity: distance > Math.max(width, height) * 0.82 ? 0.2 : 1,
      z: Math.round(scale * 1000) + (isSelected ? 2000 : 0),
      radius: size / 2,
      filter: isSelected ? "saturate(1.14) brightness(1.07)" : "none",
    });
  });
}

function applyFastOrbitLayout() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  const size = width < 540 ? 54 : 64;
  const grid = getOrbitGrid();
  const visibleRadius = Math.max(width, height) * 0.68;
  gallery.style.height = `${height}px`;

  cards.forEach((card, index) => {
    const point = getOrbitPoint(index, grid);
    const fieldX = point.x + state.orbit.x;
    const fieldY = point.y + state.orbit.y;
    const distance = Math.hypot(fieldX, fieldY);
    const isSelected = index === state.selected;
    const visible = distance < visibleRadius || isSelected;

    setCardStyle(card, {
      x: centerX + fieldX - size / 2,
      y: centerY + fieldY - size / 2,
      width: size,
      height: size,
      opacity: visible ? isSelected ? 1 : 0.92 : 0,
      z: isSelected ? 1000 : Math.max(1, Math.round(visibleRadius - distance)),
      radius: size / 2,
      filter: "none",
      visible,
    });
  });
}

function getOrbitGrid() {
  const base = stage.clientWidth < 540 ? 68 : stage.clientWidth < 920 ? 82 : 96;
  const cols = Math.ceil(Math.sqrt(items.length) * 1.25);
  const rows = Math.ceil(items.length / cols);
  return { base, cols, rows };
}

function getOrbitPoint(index, grid) {
  const col = index % grid.cols;
  const row = Math.floor(index / grid.cols);
  const offset = row % 2 ? grid.base * 0.34 : 0;
  return {
    x: (col - (grid.cols - 1) / 2) * grid.base + offset,
    y: (row - (grid.rows - 1) / 2) * grid.base * 0.88,
  };
}

function applySphereLayout({ seedPhysics = false } = {}) {
  if (effectProfile.fastMotionLayout) {
    applyFastSphereLayout();
    return;
  }

  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.34 + state.sphere.radiusBoost;
  const perspective = Math.max(width, height) * 1.05;
  gallery.style.height = `${height}px`;

  const sinX = Math.sin(state.sphere.rotX);
  const cosX = Math.cos(state.sphere.rotX);
  const sinY = Math.sin(state.sphere.rotY);
  const cosY = Math.cos(state.sphere.rotY);

  cards.forEach((card, index) => {
    const point = spherePoints[index];
    const x1 = point.x * cosY - point.z * sinY;
    const z1 = point.x * sinY + point.z * cosY;
    const y1 = point.y * cosX - z1 * sinX;
    const z2 = point.y * sinX + z1 * cosX;
    const depth = (z2 + 1) / 2;
    const projected = perspective / (perspective - z2 * radius);
    const targetX = centerX + x1 * radius * projected;
    const targetY = centerY + y1 * radius * projected;
    const targetSize = clamp(19 + depth * 28, 18, 48);
    const body = physics[index];

    if (seedPhysics || body.x === 0 && body.y === 0) {
      body.x = targetX;
      body.y = targetY;
      body.size = targetSize;
      body.vx = 0;
      body.vy = 0;
    } else {
      const dx = targetX - body.x;
      const dy = targetY - body.y;
      body.vx = body.vx * 0.78 + dx * 0.085;
      body.vy = body.vy * 0.78 + dy * 0.085 + Math.max(0, 0.22 - depth * 0.18);

      const pointerDistance = Math.hypot(body.x - state.pointerX, body.y - state.pointerY);
      if (pointerDistance < 105) {
        const force = (105 - pointerDistance) / 105;
        const angle = Math.atan2(body.y - state.pointerY, body.x - state.pointerX);
        body.vx += Math.cos(angle) * force * 2.2;
        body.vy += Math.sin(angle) * force * 2.2 + force * 0.35;
      }

      body.x += body.vx;
      body.y += body.vy;
      body.size += (targetSize - body.size) * 0.14;
    }

    setCardStyle(card, {
      x: body.x - body.size / 2,
      y: body.y - body.size / 2,
      width: body.size,
      height: body.size,
      opacity: clamp(0.36 + depth * 0.78, 0.28, 1),
      z: Math.round(depth * 1000),
      radius: body.size / 2,
      filter: "none",
    });
  });
}

function applyFastSphereLayout() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.3;
  const sinX = Math.sin(state.sphere.rotX);
  const cosX = Math.cos(state.sphere.rotX);
  const sinY = Math.sin(state.sphere.rotY);
  const cosY = Math.cos(state.sphere.rotY);
  gallery.style.height = `${height}px`;

  cards.forEach((card, index) => {
    const point = spherePoints[index];
    const x1 = point.x * cosY - point.z * sinY;
    const z1 = point.x * sinY + point.z * cosY;
    const y1 = point.y * cosX - z1 * sinX;
    const z2 = point.y * sinX + z1 * cosX;
    const depth = (z2 + 1) / 2;
    const size = 28;
    const visible = depth > 0.08;

    setCardStyle(card, {
      x: centerX + x1 * radius - size / 2,
      y: centerY + y1 * radius - size / 2,
      width: size,
      height: size,
      opacity: visible ? clamp(0.35 + depth * 0.55, 0.25, 0.9) : 0,
      z: Math.round(depth * 1000),
      radius: size / 2,
      filter: "none",
      visible,
    });
  });
}

function setCardStyle(card, layout) {
  const transform = `translate3d(${layout.x.toFixed(2)}px, ${layout.y.toFixed(2)}px, 0)`;
  const widthValue = Math.max(1, layout.width);
  const heightValue = Math.max(1, layout.height);
  const opacity = layout.opacity.toFixed(3);
  const radiusValue = layout.radius;
  const z = String(layout.z);
  const display = layout.visible === false ? "none" : "block";
  const cached = cardLayouts.get(card) || {};

  if (cached.display !== display) {
    card.style.display = display;
    cached.display = display;
  }
  if (display === "none") {
    cardLayouts.set(card, cached);
    return;
  }

  if (cached.transform !== transform) {
    card.style.setProperty("--card-transform", transform);
    card.style.transform = transform;
    cached.transform = transform;
  }
  if (cached.widthValue === undefined || Math.abs(cached.widthValue - widthValue) > 1) {
    card.style.width = `${widthValue.toFixed(2)}px`;
    cached.widthValue = widthValue;
  }
  if (cached.heightValue === undefined || Math.abs(cached.heightValue - heightValue) > 1) {
    card.style.height = `${heightValue.toFixed(2)}px`;
    cached.heightValue = heightValue;
  }
  if (cached.opacity !== opacity) {
    card.style.opacity = opacity;
    cached.opacity = opacity;
  }
  if (cached.z !== z) {
    card.style.zIndex = z;
    cached.z = z;
  }
  if (cached.radiusValue === undefined || Math.abs(cached.radiusValue - radiusValue) > 1) {
    card.style.borderRadius = `${radiusValue.toFixed(2)}px`;
    cached.radiusValue = radiusValue;
  }
  if (cached.filter !== layout.filter) {
    card.style.filter = layout.filter;
    cached.filter = layout.filter;
  }

  cardLayouts.set(card, cached);
}

function tick() {
  const now = performance.now();
  const layoutInterval = effectProfile.layoutInterval;

  if (state.mode === "orbit" && now > state.transitionUntil) {
    if (!state.isPointerDown) {
      state.orbit.x += state.orbit.vx;
      state.orbit.y += state.orbit.vy;
      state.orbit.vx *= 0.9;
      state.orbit.vy *= 0.9;
    }

    const orbitSpeed = Math.abs(state.orbit.vx) + Math.abs(state.orbit.vy);
    if (effectProfile.fastMotionLayout && !state.isPointerDown && orbitSpeed < 0.08) {
      state.orbit.vx = 0;
      state.orbit.vy = 0;
    } else if (!layoutInterval || state.isPointerDown || now - lastLayoutFrame >= layoutInterval) {
      applyOrbitLayout();
      lastLayoutFrame = now;
    }
  }

  if (state.mode === "sphere") {
    if (now > state.transitionUntil) {
      if (!state.isPointerDown) {
        state.sphere.rotX += state.sphere.vx;
        state.sphere.rotY += state.sphere.vy;
        state.sphere.vx *= 0.985;
        state.sphere.vy *= 0.985;
        state.sphere.vy += 0.000012;
      }
      state.sphere.radiusBoost *= 0.94;

      const sphereSpeed = Math.abs(state.sphere.vx) + Math.abs(state.sphere.vy) + Math.abs(state.sphere.radiusBoost) * 0.001;
      if (effectProfile.fastMotionLayout && !state.isPointerDown && sphereSpeed < 0.00035) {
        state.sphere.vx = 0;
        state.sphere.vy = 0;
        state.sphere.radiusBoost = 0;
      } else if (!layoutInterval || state.isPointerDown || now - lastLayoutFrame >= layoutInterval) {
        applySphereLayout();
        lastLayoutFrame = now;
      }
    }
  }

  const particleInterval = state.mode === "waterfall"
    ? effectProfile.particleWaterfallInterval
    : effectProfile.particleMotionInterval;
  if (!particleInterval || state.isPointerDown || now - lastParticleFrame >= particleInterval) {
    drawParticleField(now);
    lastParticleFrame = now;
  }

  requestAnimationFrame(tick);
}

function drawParticleField(now) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  grainCtx.clearRect(0, 0, width, height);
  grainCtx.save();
  grainCtx.globalCompositeOperation = "screen";
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.34;
  const palette = [
    "126, 231, 255",
    "216, 255, 99",
    "240, 90, 162",
    "157, 140, 255",
  ];

  const laneCount = effectProfile.lanes;
  for (let lane = 0; lane < laneCount; lane += 1) {
    const y = height * (0.14 + lane * 0.14);
    const shift = (now * 0.006 * (lane + 1)) % (width + 300);
    const alpha = state.mode === "sphere" ? 0.08 : 0.034;
    grainCtx.strokeStyle = `rgba(${palette[lane % palette.length]}, ${alpha})`;
    grainCtx.lineWidth = 1;
    grainCtx.beginPath();
    grainCtx.moveTo(-260 + shift, y);
    grainCtx.lineTo(width + shift, y + Math.sin(now * 0.00036 + lane) * 24);
    grainCtx.stroke();
  }

  for (const particle of grainParticles) {
    const wobble = Math.sin(now * 0.0012 * particle.drift + particle.a) * 0.055;
    const modeDrift = state.mode === "sphere" ? state.sphere.rotY * 0.8 : now * 0.00008;
    const angle = particle.a + modeDrift + wobble;
    const band = Math.sin(particle.a * 1.7 + state.sphere.rotX);
    const laneOffset = (particle.lane - 4) * height * 0.052;
    const r = radius * particle.r * (state.mode === "sphere" ? 0.74 + Math.abs(band) * 0.34 : 1.32);
    const x = state.mode === "sphere"
      ? cx + Math.cos(angle) * r
      : (Math.cos(angle) * r + cx + now * particle.drift * 0.018) % (width + 160) - 80;
    const y = state.mode === "sphere"
      ? cy + Math.sin(angle) * r * 0.72 + band * radius * 0.32
      : cy + laneOffset + Math.sin(angle * 1.8) * 38;
    const alpha = state.mode === "sphere" ? 0.075 + Math.abs(band) * 0.11 : 0.045;
    grainCtx.fillStyle = `rgba(${palette[particle.tone]}, ${alpha})`;
    grainCtx.beginPath();
    grainCtx.arc(x, y, particle.size, 0, Math.PI * 2);
    grainCtx.fill();
  }

  if (state.mode === "sphere") {
    for (let ring = 0; ring < 4; ring += 1) {
      const ringRadius = radius * (0.74 + ring * 0.1 + Math.sin(now * 0.001 + ring) * 0.012);
      grainCtx.strokeStyle = `rgba(${palette[ring]}, ${0.09 - ring * 0.012})`;
      grainCtx.lineWidth = 1.2;
      grainCtx.beginPath();
      grainCtx.ellipse(cx, cy, ringRadius, ringRadius * (0.28 + ring * 0.08), state.sphere.rotY + ring * 0.7, 0, Math.PI * 2);
      grainCtx.stroke();
    }
  }
  grainCtx.restore();
}

function clearGrain() {
  if (!grainCanvas.width) return;
  grainCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function resetViewerTransform() {
  state.viewer.zoom = 1;
  state.viewer.panX = 0;
  state.viewer.panY = 0;
  state.viewer.isPanning = false;
  document.body.classList.remove("viewer-panning");
  updateViewerTransform();
}

function updateViewerTransform() {
  const zoom = state.viewer.zoom.toFixed(3);
  const panX = `${state.viewer.panX.toFixed(1)}px`;
  const panY = `${state.viewer.panY.toFixed(1)}px`;
  viewerImage.style.setProperty("--viewer-zoom", zoom);
  viewerImage.style.setProperty("--viewer-pan-x", panX);
  viewerImage.style.setProperty("--viewer-pan-y", panY);
  viewerImage.style.transform = `translate3d(${panX}, ${panY}, 0) scale(${zoom})`;
  viewer.dataset.zoomed = state.viewer.zoom > 1.01 ? "true" : "false";
  viewerZoomReset.textContent = `${Math.round(state.viewer.zoom * 100)}%`;
}

function zoomViewerBy(multiplier, event) {
  zoomViewerTo(state.viewer.zoom * multiplier, event);
}

function zoomViewerTo(nextZoom, event) {
  const previousZoom = state.viewer.zoom;
  const zoom = clamp(nextZoom, 1, 5);
  if (Math.abs(zoom - previousZoom) < 0.001) return;

  if (event && viewerImageStage) {
    const rect = viewerImageStage.getBoundingClientRect();
    const originX = event.clientX - rect.left - rect.width / 2 - state.viewer.panX;
    const originY = event.clientY - rect.top - rect.height / 2 - state.viewer.panY;
    const ratio = zoom / previousZoom;
    state.viewer.panX -= originX * (ratio - 1);
    state.viewer.panY -= originY * (ratio - 1);
  }

  state.viewer.zoom = zoom;
  boundViewerPan();
  updateViewerTransform();
}

function boundViewerPan() {
  if (state.viewer.zoom <= 1.01 || !viewerImageStage) {
    state.viewer.panX = 0;
    state.viewer.panY = 0;
    return;
  }

  const rect = viewerImageStage.getBoundingClientRect();
  const maxX = rect.width * (state.viewer.zoom - 1) * 0.5;
  const maxY = rect.height * (state.viewer.zoom - 1) * 0.5;
  state.viewer.panX = clamp(state.viewer.panX, -maxX, maxX);
  state.viewer.panY = clamp(state.viewer.panY, -maxY, maxY);
}

function handleViewerWheel(event) {
  if (!viewer.classList.contains("is-open")) return;
  event.preventDefault();

  const panIntent = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.25;
  if (panIntent && state.viewer.zoom > 1.01) {
    state.viewer.panX -= event.deltaX || event.deltaY;
    state.viewer.panY -= event.shiftKey ? 0 : event.deltaY;
    boundViewerPan();
    updateViewerTransform();
    return;
  }

  const multiplier = Math.exp(-event.deltaY * 0.0014);
  zoomViewerBy(multiplier, event);
}

function handleViewerPointerDown(event) {
  if (!viewer.classList.contains("is-open")) return;
  const isMiddleButton = event.button === 1;
  const canPan = state.viewer.zoom > 1.01 || isMiddleButton || event.pointerType === "touch";
  if (!canPan) return;

  event.preventDefault();
  state.viewer.isPanning = true;
  state.viewer.lastX = event.clientX;
  state.viewer.lastY = event.clientY;
  document.body.classList.add("viewer-panning");
  viewerFrame.setPointerCapture?.(event.pointerId);
}

function handleViewerPointerMove(event) {
  if (!state.viewer.isPanning) return;
  const dx = event.clientX - state.viewer.lastX;
  const dy = event.clientY - state.viewer.lastY;
  state.viewer.panX += dx;
  state.viewer.panY += dy;
  state.viewer.lastX = event.clientX;
  state.viewer.lastY = event.clientY;
  boundViewerPan();
  updateViewerTransform();
}

function handleViewerPointerUp() {
  if (!state.viewer.isPanning) return;
  state.viewer.isPanning = false;
  document.body.classList.remove("viewer-panning");
}

function handleViewerDoubleClick(event) {
  event.preventDefault();
  if (state.viewer.zoom > 1.01) {
    resetViewerTransform();
  } else {
    zoomViewerTo(2.2, event);
  }
}

function openViewer(index) {
  const card = cards[index];
  if (!card) return;
  state.selected = index;
  const item = items[index];
  const sourceRect = card.getBoundingClientRect();

  resetViewerTransform();
  viewerTitle.textContent = item.title;
  viewerMeta.textContent = item.place;
  viewerImage.src = item.src;
  viewerImage.alt = item.title;
  viewerImage.classList.remove("is-visible");
  viewer.classList.add("is-open");
  viewer.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    const imageReady = viewerImage.decode ? viewerImage.decode().catch(() => {}) : Promise.resolve();
    imageReady.finally(() => {
      const targetRect = getViewerTargetRect(item);
      const clone = makeFlightClone(item.src, sourceRect);
      document.body.appendChild(clone);
      const flight = clone.animate(
        [
          rectKeyframe(sourceRect, 0.98),
          rectKeyframe(targetRect, 1),
        ],
        {
          duration: 720,
          easing: "cubic-bezier(0.2, 0.82, 0.18, 1)",
          fill: "forwards",
        },
      );
      flight.finished.finally(() => {
        clone.remove();
        viewerImage.classList.add("is-visible");
      });
    });
  });
}

function closeViewer() {
  if (!viewer.classList.contains("is-open")) return;
  const card = cards[state.selected];
  const sourceRect = state.viewer.zoom > 1.01
    ? viewerImage.getBoundingClientRect()
    : getViewerTargetRect(items[state.selected] || {});
  const targetRect = card ? card.getBoundingClientRect() : sourceRect;
  const clone = makeFlightClone(viewerImage.src, sourceRect);
  document.body.appendChild(clone);
  viewerImage.classList.remove("is-visible");

  clone.animate(
    [
      rectKeyframe(sourceRect, 1),
      rectKeyframe(targetRect, 0.98),
    ],
    {
      duration: 620,
      easing: "cubic-bezier(0.2, 0.82, 0.18, 1)",
      fill: "forwards",
    },
  ).finished.finally(() => {
    clone.remove();
    resetViewerTransform();
    viewer.classList.remove("is-open");
    viewer.setAttribute("aria-hidden", "true");
  });
}

function makeFlightClone(src, rect) {
  const clone = document.createElement("div");
  clone.className = "flight-clone";
  clone.innerHTML = `<img alt="" src="${src}">`;
  Object.assign(clone.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  return clone;
}

function getViewerTargetRect(item) {
  const stageRect = (viewerImageStage || viewerFrame).getBoundingClientRect();
  const naturalRatio = viewerImage.naturalWidth > 0 && viewerImage.naturalHeight > 0
    ? viewerImage.naturalHeight / viewerImage.naturalWidth
    : item.ratio || 1;
  const ratio = clamp(naturalRatio, 0.08, 8);
  let width = stageRect.width;
  let height = width * ratio;

  if (height > stageRect.height) {
    height = stageRect.height;
    width = height / ratio;
  }

  return {
    left: stageRect.left + (stageRect.width - width) / 2,
    top: stageRect.top + (stageRect.height - height) / 2,
    width,
    height,
  };
}

function rectKeyframe(rect, scale) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    transform: `scale(${scale})`,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
