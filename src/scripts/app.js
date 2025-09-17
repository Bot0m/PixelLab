import {
  FILTER_DEFAULTS,
  formatFilterValue,
  composeFilterString,
} from "./filters.js";
import {
  reset as resetHistory,
  push as pushHistory,
  undo as undoHistory,
  canUndo,
} from "./history.js";
import { registerShortcuts } from "./shortcuts.js";

const TRANSFORM_DEFAULTS = {
  crop: { x: 0, y: 0, width: 1, height: 1 },
};

const fileInput = document.getElementById("file-input");
const previewFrame = document.getElementById("preview-frame");
const previewCaption = document.getElementById("preview-caption");
const canvas = document.getElementById("editor-canvas");
const resetFiltersButton = document.getElementById("reset-filters");
const undoButton = document.getElementById("undo-button");
const redoButton = document.getElementById("redo-button");
const exportButton = document.getElementById("export-button");
const exportModal = document.getElementById("export-modal");
const exportCloseButton = document.getElementById("export-close");
const exportCancelButton = document.getElementById("export-cancel");
const exportConfirmButton = document.getElementById("export-confirm");
const exportForm = document.getElementById("export-form");
const cropToggle = document.getElementById("crop-toggle");
const liveRegion = document.getElementById("pl-live-region");
const cropOverlay = document.getElementById("crop-overlay");
const cropRect = document.getElementById("crop-rect");
const cropHint = document.getElementById("crop-hint");

const exportNameInput = document.getElementById("export-name");
const exportFormatSelect = document.getElementById("export-format");
const exportWidthInput = document.getElementById("export-width");
const exportHeightInput = document.getElementById("export-height");
const exportLockRatioToggle = document.getElementById("export-lock-ratio");
const exportFollowCanvasToggle = document.getElementById("export-follow-canvas");
const exportSizeOutput = document.getElementById("export-size");

const infoToggle = document.getElementById("info-toggle");
const infoModal = document.getElementById("info-modal");
const infoCloseButton = document.getElementById("info-close");
const themeToggle = document.getElementById("theme-toggle");
const rootElement = document.documentElement;
const localeButtons = Array.from(document.querySelectorAll(".pl-locale-button"));

const filterInputs = Array.from(document.querySelectorAll("[data-filter]"));
const filterOutputs = new Map(
  filterInputs.map((input) => [
    input.dataset.filter,
    document.getElementById(`${input.id}-output`),
  ])
);

const SUPPORTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

const MIME_TYPES = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

const EXTENSIONS = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  svg: "svg",
  pdf: "pdf",
};

const THEME_STORAGE_KEY = "pixellab-theme";
const LOCALE_STORAGE_KEY = "pixellab-locale";
let userThemeOverride = false;
let systemThemeQuery;

const state = {
  filters: { ...FILTER_DEFAULTS },
  transform: { crop: { ...TRANSFORM_DEFAULTS.crop } },
  image: null,
  fileMeta: null,
  initialSnapshot: null,
  isCropping: false,
  exportOptions: {
    name: "pixellab-image",
    format: "png",
    width: 0,
    height: 0,
    aspectRatio: 1,
    lockRatio: true,
    followCanvas: true,
  },
};

let cropSession = null;
const context = canvas.getContext("2d");
const textEncoder = new TextEncoder();

const EXPORT_SIZE_DEBOUNCE_MS = 400;
let exportSizeTimeoutId = null;
let exportSizeJobToken = 0;
const translations = {
  fr: {
    tagline: "Éditeur d'images léger",
    heroAction: "Sélectionnez ou déposez une image pour commencer",
    dragUnsupported: "Format non pris en charge pour le glisser-déposer.",
    unsupported: "Format non pris en charge. Essayez PNG, JPEG, WEBP, GIF ou SVG.",
    loadError: "Impossible de charger cette image.",
    loadSuccess: (name) => `Image ${name} chargée, filtres réinitialisés.`,
    filtersReset: "Filtres réinitialisés.",
    cropApplied: "Recadrage appliqué.",
    cropCancelled: "Recadrage annulé.",
    cropTooSmall: "Sélection trop petite, recadrage annulé.",
    cropDisabled: "Mode recadrage désactivé.",
    fileDialogOpened: "Fenêtre de sélection de fichier ouverte.",
    undo: "Dernière action annulée.",
    restore: "Image restaurée à son état d'origine.",
    exportEstimated: "Taille estimée —",
    exportEstimating: "Taille estimée…",
    exportComplete: (format, width, height) => `Image exportée en ${format} (${width} × ${height}).`,
    exportFailed: "Export impossible.",
    exportSize: (size) => `Taille estimée ~ ${size}`,
    exportSizeFinal: (size) => `Taille exportée ~ ${size}`,
    exportModalTitle: "Exporter l'image",
    exportFileLabel: "Nom du fichier",
    exportFormatLabel: "Format",
    exportWidthLabel: "Largeur (px)",
    exportHeightLabel: "Hauteur (px)",
    exportLockRatio: "Verrouiller le ratio",
    exportFollowCanvas: "Suivre la taille du canvas",
    exportHint: "Si disponible, l'API du navigateur permettra de choisir l'emplacement du fichier.",
    exportOpenModal: "Exporter",
    exportCancel: "Annuler",
    exportConfirm: "Exporter",
    footer: "Développé par Tom",
    infoTitle: "Raccourcis & aide",
    shortcuts: [
      "Ctrl/Cmd + O : Ouvrir une image",
      "Ctrl/Cmd + Z : Annuler la dernière action",
      "Ctrl/Cmd + Shift + Z : Rétablir l'image d'origine",
      "Ctrl/Cmd + Shift + F : Réinitialiser uniquement les filtres",
      "Ctrl/Cmd + Shift + C : Basculer le mode recadrage",
      "Ctrl/Cmd + E : Exporter"
    ],
    importButton: "Importer une image",
    undoButton: "Annuler",
    redoButton: "Rétablir original",
    cropButton: "Mode recadrage",
    exportButton: "Exporter",
    filtersLegend: "Filtres rapides",
    contrastLabel: "Contraste",
    saturationLabel: "Saturation",
    blurLabel: "Flou",
    resetFilters: "Réinitialiser les filtres",
    exportCancelShort: "Annuler",
    exportConfirmShort: "Exporter",
  },
  en: {
    tagline: "Lightweight image editor",
    heroAction: "Select or drop an image to get started",
    dragUnsupported: "Format not supported for drag & drop.",
    unsupported: "Unsupported format. Try PNG, JPEG, WEBP, GIF or SVG.",
    loadError: "Unable to load this image.",
    loadSuccess: (name) => `Image ${name} loaded, filters reset.`,
    filtersReset: "Filters reset.",
    cropApplied: "Crop applied.",
    cropCancelled: "Crop cancelled.",
    cropTooSmall: "Selection too small, crop cancelled.",
    cropDisabled: "Crop mode disabled.",
    fileDialogOpened: "File picker opened.",
    undo: "Last action undone.",
    restore: "Image restored to initial state.",
    exportEstimated: "Estimated size —",
    exportEstimating: "Estimating size…",
    exportComplete: (format, width, height) => `Image exported as ${format} (${width} × ${height}).`,
    exportFailed: "Export failed.",
    exportSize: (size) => `Estimated size ~ ${size}`,
    exportSizeFinal: (size) => `Exported size ~ ${size}`,
    exportModalTitle: "Export image",
    exportFileLabel: "File name",
    exportFormatLabel: "Format",
    exportWidthLabel: "Width (px)",
    exportHeightLabel: "Height (px)",
    exportLockRatio: "Lock ratio",
    exportFollowCanvas: "Follow canvas size",
    exportHint: "If available, the browser will let you choose where to save the file.",
    exportOpenModal: "Export",
    exportCancel: "Cancel",
    exportConfirm: "Export",
    footer: "Built by Tom",
    infoTitle: "Shortcuts & help",
    shortcuts: [
      "Ctrl/Cmd + O: Open an image",
      "Ctrl/Cmd + Z: Undo last action",
      "Ctrl/Cmd + Shift + Z: Restore original image",
      "Ctrl/Cmd + Shift + F: Reset filters only",
      "Ctrl/Cmd + Shift + C: Toggle crop mode",
      "Ctrl/Cmd + E: Export"
    ],
    importButton: "Import image",
    undoButton: "Undo",
    redoButton: "Restore original",
    cropButton: "Crop mode",
    exportButton: "Export",
    filtersLegend: "Quick filters",
    contrastLabel: "Contrast",
    saturationLabel: "Saturation",
    blurLabel: "Blur",
    resetFilters: "Reset filters",
    exportCancelShort: "Cancel",
    exportConfirmShort: "Export",
  },
};

function announce(message) {
  if (!message) {
    return;
  }
  liveRegion.textContent = message;
}

function sanitizeFileName(name) {
  const normalized = name?.trim().replace(/\.[^.]+$/, "");
  return normalized ? normalized.replace(/[^a-z0-9_-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "pixellab-image" : "pixellab-image";
}

function formatFileSize(bytes) {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) {
    return "—";
  }
  const units = ["octets", "Ko", "Mo", "Go", "To"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function resetExportSizeDisplay() {
  if (exportSizeOutput) {
    exportSizeOutput.textContent = "Taille estimée —";
  }
  if (exportSizeTimeoutId) {
    clearTimeout(exportSizeTimeoutId);
    exportSizeTimeoutId = null;
  }
  exportSizeJobToken += 1;
}

function updateThemeToggleUi(theme) {
  if (!themeToggle) {
    return;
  }
  const isLight = theme === "light";
  themeToggle.classList.toggle("is-light", isLight);
  themeToggle.setAttribute("aria-pressed", isLight ? "true" : "false");
  themeToggle.setAttribute("aria-label", isLight ? "Activer le thème sombre" : "Activer le thème clair");
}

function applyTheme(theme, { persist = true } = {}) {
  const normalized = theme === "light" ? "light" : "dark";
  rootElement.dataset.theme = normalized;
  rootElement.style.colorScheme = normalized;
  updateThemeToggleUi(normalized);
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch (error) {
      console.warn("Impossible d'enregistrer le thème", error);
    }
  }
}

function resolveStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch (error) {
    console.warn("Lecture du thème impossible", error);
  }
  return null;
}

function queueExportSizeUpdate({ immediate = false } = {}) {
  if (!exportSizeOutput) {
    return;
  }
  if (!hasImageLoaded()) {
    resetExportSizeDisplay();
    return;
  }

  const modalVisible = !exportModal || !exportModal.hidden;
  if (!modalVisible && !immediate) {
    resetExportSizeDisplay();
    return;
  }

  const jobId = ++exportSizeJobToken;
  exportSizeOutput.textContent = "Taille estimée…";

  const triggerComputation = async () => {
    exportSizeTimeoutId = null;
    try {
      const { format } = state.exportOptions;
      const { width, height } = getExportDimensions();
      const blob = await createExportBlob(format, width, height);
      if (jobId !== exportSizeJobToken) {
        return;
      }
      exportSizeOutput.textContent = `Taille estimée ~ ${formatFileSize(blob.size)}`;
    } catch (error) {
      if (jobId !== exportSizeJobToken) {
        return;
      }
      console.warn("Estimation de taille échouée", error);
      resetExportSizeDisplay();
    }
  };

  if (exportSizeTimeoutId) {
    clearTimeout(exportSizeTimeoutId);
  }

  if (immediate) {
    triggerComputation();
  } else {
    exportSizeTimeoutId = setTimeout(triggerComputation, EXPORT_SIZE_DEBOUNCE_MS);
  }
}

function setupTheme() {
  const storedTheme = resolveStoredTheme();
  if (storedTheme) {
    userThemeOverride = true;
    applyTheme(storedTheme, { persist: false });
  } else {
    if (window.matchMedia) {
      systemThemeQuery = window.matchMedia("(prefers-color-scheme: light)");
      applyTheme(systemThemeQuery.matches ? "light" : "dark", { persist: false });
      const handleSystemThemeChange = (event) => {
        if (!userThemeOverride) {
          applyTheme(event.matches ? "light" : "dark", { persist: false });
        }
      };
      if (typeof systemThemeQuery.addEventListener === "function") {
        systemThemeQuery.addEventListener("change", handleSystemThemeChange);
      } else if (typeof systemThemeQuery.addListener === "function") {
        systemThemeQuery.addListener(handleSystemThemeChange);
      }
    } else {
      applyTheme("dark", { persist: false });
    }
  }

  themeToggle?.addEventListener("click", () => {
    const nextTheme = rootElement.dataset.theme === "light" ? "dark" : "light";
    userThemeOverride = true;
    applyTheme(nextTheme);
  });
}

function setupLocale() {
  const storedLocale = resolveStoredLocale();
  const initialLocale = storedLocale || (navigator.language?.startsWith("en") ? "en" : "fr");
  applyLocale(initialLocale, { persist: false });

  localeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextLocale = button.dataset.locale;
      applyLocale(nextLocale);
    });
  });
}

function applyLocale(locale, { persist = true } = {}) {
  const nextLocale = locale === "en" ? "en" : "fr";
  const dict = translations[nextLocale];
  if (!dict) {
    return;
  }

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    const value = dict[key];
    if (typeof value === "string") {
      node.textContent = value;
    }
  });

  if (exportNameInput) exportNameInput.placeholder = nextLocale === "en" ? "pixel-lab-image" : "pixellab-image";
  if (previewCaption) previewCaption.textContent = dict.heroAction;
  if (exportSizeOutput) exportSizeOutput.textContent = dict.exportEstimated;
  if (themeToggle) themeToggle.setAttribute("aria-label", themeToggle.classList.contains("is-light") ? (nextLocale === "en" ? "Switch to dark theme" : "Activer le thème sombre") : (nextLocale === "en" ? "Switch to light theme" : "Activer le thème clair"));

  localeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.locale === nextLocale);
  });

  if (exportModal) {
    exportModal.querySelector("[id='export-title']")?.replaceChildren(document.createTextNode(dict.exportModalTitle));
    exportModal.querySelector("label[for='export-name']")?.replaceChildren(document.createTextNode(dict.exportFileLabel));
    exportModal.querySelector("label[for='export-format']")?.replaceChildren(document.createTextNode(dict.exportFormatLabel));
    exportModal.querySelector("label[for='export-width']")?.replaceChildren(document.createTextNode(dict.exportWidthLabel));
    exportModal.querySelector("label[for='export-height']")?.replaceChildren(document.createTextNode(dict.exportHeightLabel));
    const lockLabel = exportModal.querySelector("label[for='export-lock-ratio']");
    if (lockLabel) {
      lockLabel.lastChild.nodeValue = ` ${dict.exportLockRatio}`;
    }
    const followLabel = exportModal.querySelector("label[for='export-follow-canvas']");
    if (followLabel) {
      followLabel.lastChild.nodeValue = ` ${dict.exportFollowCanvas}`;
    }
    exportModal.querySelector(".pl-hint")?.replaceChildren(document.createTextNode(dict.exportHint));
    exportCancelButton?.replaceChildren(document.createTextNode(dict.exportCancelShort));
    exportConfirmButton?.replaceChildren(document.createTextNode(dict.exportConfirmShort));
  }

  document.querySelector("label[for='filter-contrast']")?.replaceChildren(document.createTextNode(dict.contrastLabel));
  document.querySelector("label[for='filter-saturation']")?.replaceChildren(document.createTextNode(dict.saturationLabel));
  document.querySelector("label[for='filter-blur']")?.replaceChildren(document.createTextNode(dict.blurLabel));
  document.querySelector("legend")?.replaceChildren(document.createTextNode(dict.filtersLegend));
  resetFiltersButton?.replaceChildren(document.createTextNode(dict.resetFilters));
  document.querySelector("label.pl-upload span:last-of-type")?.replaceChildren(document.createTextNode(dict.importButton));
  undoButton?.querySelector("span")?.replaceChildren(document.createTextNode(dict.undoButton));
  redoButton?.querySelector("span")?.replaceChildren(document.createTextNode(dict.redoButton));
  cropToggle?.querySelector("span")?.replaceChildren(document.createTextNode(dict.cropButton));
  exportButton?.querySelector("span")?.replaceChildren(document.createTextNode(dict.exportButton));
  document.getElementById("info-title")?.replaceChildren(document.createTextNode(dict.infoTitle));
  const shortcutsList = infoModal?.querySelector("ul");
  if (shortcutsList) {
    shortcutsList.innerHTML = "";
    dict.shortcuts.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      shortcutsList.append(li);
    });
  }
  document.getElementById("preview-caption")?.replaceChildren(document.createTextNode(dict.heroAction));
  document.querySelector(".pl-footer small")?.replaceChildren(document.createTextNode(dict.footer));

  if (persist) {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch (error) {
      console.warn("Impossible d'enregistrer la langue", error);
    }
  }
}

function resolveStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "en" || stored === "fr") {
      return stored;
    }
  } catch (error) {
    console.warn("Lecture de la langue impossible", error);
  }
  return null;
}

function hasImageLoaded() {
  return Boolean(state.image);
}

function cloneSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }
  return {
    filters: { ...FILTER_DEFAULTS, ...(snapshot.filters || {}) },
    transform: {
      crop: { ...TRANSFORM_DEFAULTS.crop, ...(snapshot.transform?.crop || {}) },
    },
  };
}

function createSnapshot() {
  return {
    filters: { ...state.filters },
    transform: {
      crop: { ...state.transform.crop },
    },
  };
}

function applySnapshot(snapshot) {
  if (!snapshot) {
    return;
  }
  const next = cloneSnapshot(snapshot);
  Object.assign(state.filters, next.filters);
  state.transform.crop = { ...next.transform.crop };
  syncFilterControls();
  renderImage();
  updateHistoryControls();
}

function isAtInitialState() {
  if (!state.initialSnapshot) {
    return true;
  }
  const current = createSnapshot();
  return JSON.stringify(current) === JSON.stringify(state.initialSnapshot);
}

function updateHistoryControls() {
  const imageReady = hasImageLoaded();
  undoButton.disabled = !imageReady || !canUndo();
  redoButton.disabled = !imageReady || isAtInitialState();
  exportButton.disabled = !imageReady;
  if (exportConfirmButton) {
    exportConfirmButton.disabled = !imageReady;
  }
  cropToggle.disabled = !imageReady;
}

function resetStateToDefaults({ preserveCrop = false } = {}) {
  Object.assign(state.filters, FILTER_DEFAULTS);
  if (!preserveCrop) {
    state.transform.crop = { ...TRANSFORM_DEFAULTS.crop };
  }
}

function resetExportOptions() {
  state.exportOptions = {
    name: "pixellab-image",
    format: "png",
    width: canvas.width || 0,
    height: canvas.height || 0,
    aspectRatio: canvas.width && canvas.height ? canvas.width / canvas.height : 1,
    lockRatio: true,
    followCanvas: true,
  };
  updateExportFormInputs();
  resetExportSizeDisplay();
}

function resetPreview(message = "Sélectionnez ou déposez une image pour commencer") {
  state.image = null;
  state.fileMeta = null;
  state.initialSnapshot = cloneSnapshot({ filters: FILTER_DEFAULTS, transform: TRANSFORM_DEFAULTS });
  resetStateToDefaults();
  canvas.hidden = true;
  canvas.width = 0;
  canvas.height = 0;
  previewCaption.textContent = message;
  deactivateCropMode();
  resetHistory(createSnapshot());
  resetExportOptions();
  updateHistoryControls();
  closeInfoModal();
  closeExportModal();
  announce(message);
}

function syncFilterControls() {
  filterInputs.forEach((input) => {
    const filterName = input.dataset.filter;
    const value = state.filters[filterName];
    if (typeof value === "number") {
      input.value = String(value);
      updateFilterOutput(filterName, value);
    }
  });
}

function updateFilterOutput(filterName, value) {
  const output = filterOutputs.get(filterName);
  if (output) {
    output.textContent = formatFilterValue(filterName, value);
  }
}

function renderImage() {
  if (!state.image) {
    return;
  }

  const crop = state.transform.crop;
  const sourceWidth = state.image.width;
  const sourceHeight = state.image.height;
  const sx = Math.round(clamp(crop.x, 0, 1) * sourceWidth);
  const sy = Math.round(clamp(crop.y, 0, 1) * sourceHeight);
  const sWidth = Math.round(clamp(crop.width, 0.01, 1) * sourceWidth);
  const sHeight = Math.round(clamp(crop.height, 0.01, 1) * sourceHeight);

  canvas.width = Math.max(sWidth, 1);
  canvas.height = Math.max(sHeight, 1);
  canvas.hidden = false;

  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.filter = composeFilterString(state.filters);
  context.drawImage(state.image, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
  context.restore();

  syncExportOptionsWithCanvas();
  queueExportSizeUpdate();
}

function syncExportOptionsWithCanvas({ force = false } = {}) {
  if (!canvas.width || !canvas.height) {
    return;
  }
  state.exportOptions.aspectRatio = canvas.width / canvas.height || 1;
  if (state.exportOptions.followCanvas || force) {
    state.exportOptions.width = canvas.width;
    state.exportOptions.height = canvas.height;
    updateExportFormInputs();
  }
}

function updateExportFormInputs() {
  if (document.activeElement !== exportNameInput) {
    exportNameInput.value = state.exportOptions.name;
  }
  exportFormatSelect.value = state.exportOptions.format;
  exportWidthInput.value = state.exportOptions.width ? Math.round(state.exportOptions.width) : "";
  exportHeightInput.value = state.exportOptions.height ? Math.round(state.exportOptions.height) : "";
  exportLockRatioToggle.checked = state.exportOptions.lockRatio;
  exportFollowCanvasToggle.checked = state.exportOptions.followCanvas;
  const disabled = state.exportOptions.followCanvas;
  exportWidthInput.disabled = disabled;
  exportHeightInput.disabled = disabled;
}

function resizeCanvasToImage(image) {
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.hidden = false;
}

async function decodeImage(file) {
  if ("createImageBitmap" in window && typeof window.createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de décoder cette image."));
    };
    image.src = objectUrl;
  });
}

async function renderImageFromFile(file) {
  try {
    const image = await decodeImage(file);
    resizeCanvasToImage(image);
    state.image = image;
    state.fileMeta = {
      name: file.name,
      size: `${Math.round(file.size / 1024)} Ko`,
    };

    resetStateToDefaults();
    syncFilterControls();

    previewCaption.textContent = `${state.fileMeta.name} — ${state.fileMeta.size}`;

    const snapshot = createSnapshot();
    state.initialSnapshot = cloneSnapshot(snapshot);
    resetHistory(snapshot);

    state.exportOptions.name = sanitizeFileName(file.name);
    state.exportOptions.followCanvas = true;
    renderImage();
    updateExportFormInputs();
    updateHistoryControls();
    announce(`Image ${file.name} chargée, filtres réinitialisés.`);
  } catch (error) {
    console.error(error);
    resetPreview("Impossible de charger cette image.");
  }
}

function handleFilterInput(event) {
  const input = event.target;
  const filterName = input.dataset.filter;
  if (!filterName) {
    return;
  }

  const nextValue = Number.parseFloat(input.value);
  if (Number.isNaN(nextValue)) {
    return;
  }

  if (state.filters[filterName] === nextValue) {
    updateFilterOutput(filterName, nextValue);
    return;
  }

  state.filters[filterName] = nextValue;
  updateFilterOutput(filterName, nextValue);
  renderImage();
  updateHistoryControls();
}

function handleFilterCommit(event) {
  if (!hasImageLoaded()) {
    return;
  }
  const input = event.target;
  const filterName = input.dataset.filter;
  if (!filterName) {
    return;
  }

  pushHistory(createSnapshot());
  updateHistoryControls();
  announce(`${input.dataset.label} réglé sur ${formatFilterValue(filterName, state.filters[filterName])}`);
}

function resetFiltersToDefaults({ recordHistory = true, announceMessage = true } = {}) {
  const previousSnapshot = createSnapshot();
  resetStateToDefaults({ preserveCrop: true });
  syncFilterControls();
  renderImage();

  if (recordHistory && hasImageLoaded() && JSON.stringify(previousSnapshot.filters) !== JSON.stringify(state.filters)) {
    pushHistory(createSnapshot());
  }

  updateHistoryControls();

  if (announceMessage) {
    announce("Filtres réinitialisés.");
  }
}

function handleFiles(files) {
  const [file] = files || [];
  if (!file) {
    resetPreview();
    return;
  }

  if (!SUPPORTED_TYPES.includes(file.type)) {
    resetPreview("Format non pris en charge. Essayez PNG, JPEG, WEBP, GIF ou SVG.");
    return;
  }

  renderImageFromFile(file);
}

function performUndo() {
  if (!canUndo() || !hasImageLoaded()) {
    return;
  }
  undoHistory(applySnapshot);
  updateHistoryControls();
  announce("Dernière action annulée.");
}

function resetAllChanges() {
  if (!hasImageLoaded() || !state.initialSnapshot) {
    return;
  }
  applySnapshot(state.initialSnapshot);
  resetHistory(state.initialSnapshot);
  state.exportOptions.followCanvas = true;
  syncExportOptionsWithCanvas({ force: true });
  updateExportFormInputs();
  updateHistoryControls();
  queueExportSizeUpdate();
  announce("Image restaurée à son état d'origine.");
}

function updateCropRectDisplay(selection) {
  if (!selection) {
    cropRect.setAttribute("hidden", "");
    return;
  }

  cropRect.removeAttribute("hidden");
  cropRect.style.left = `${selection.left * 100}%`;
  cropRect.style.top = `${selection.top * 100}%`;
  cropRect.style.width = `${selection.width * 100}%`;
  cropRect.style.height = `${selection.height * 100}%`;
}

function deactivateCropMode() {
  state.isCropping = false;
  cropToggle.classList.remove("is-active");
  const label = cropToggle.querySelector("span");
  if (label) {
    label.textContent = "Mode recadrage";
  }
  cropToggle.setAttribute("aria-pressed", "false");
  cropOverlay.setAttribute("hidden", "");
  cropOverlay.classList.remove("is-active");
  cropRect.setAttribute("hidden", "");
  if (cropSession) {
    cropSession = null;
    updateCropRectDisplay(null);
    cropHint.textContent = "Cliquez puis faites glisser pour définir la zone à conserver.";
  }
}

function activateCropMode() {
  if (!hasImageLoaded()) {
    return;
  }
  state.isCropping = true;
  cropToggle.classList.add("is-active");
  const label = cropToggle.querySelector("span");
  if (label) {
    label.textContent = "Sélection en cours";
  }
  cropToggle.setAttribute("aria-pressed", "true");
  cropOverlay.removeAttribute("hidden");
  cropOverlay.classList.add("is-active");
  cropRect.setAttribute("hidden", "");
  cropHint.textContent = "Cliquez puis faites glisser pour définir la zone à conserver.";
  announce("Mode recadrage activé. Cliquez et faites glisser sur l'image.");
}

function toggleCropMode() {
  if (!hasImageLoaded()) {
    return;
  }
  if (state.isCropping) {
    deactivateCropMode();
  } else {
    activateCropMode();
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function startCropSession(event) {
  if (!state.isCropping || !hasImageLoaded()) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return;
  }

  const startX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const startY = clamp((event.clientY - rect.top) / rect.height, 0, 1);

  cropSession = {
    pointerId: event.pointerId,
    rect,
    startX,
    startY,
    currentX: startX,
    currentY: startY,
  };

  cropOverlay.setPointerCapture?.(event.pointerId);
  updateCropRectDisplay({ left: startX, top: startY, width: 0, height: 0 });
  cropHint.textContent = "Relâchez pour appliquer le recadrage.";
  event.preventDefault();
}

function updateCropSession(event) {
  if (!cropSession) {
    return;
  }
  const { rect, startX, startY } = cropSession;
  const currentX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const currentY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  cropSession.currentX = currentX;
  cropSession.currentY = currentY;

  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  updateCropRectDisplay({ left, top, width, height });
  event.preventDefault();
}

function finishCropSession(event) {
  if (!cropSession) {
    return;
  }

  cropOverlay.releasePointerCapture?.(event.pointerId);

  const { startX, startY, currentX, currentY } = cropSession;
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);

  cropSession = null;

  if (width < 0.01 || height < 0.01) {
    updateCropRectDisplay(null);
    cropHint.textContent = "Cliquez puis faites glisser pour définir la zone à conserver.";
    announce("Sélection trop petite, recadrage annulé.");
    return;
  }

  const currentCrop = state.transform.crop;
  const nextCrop = {
    x: currentCrop.x + left * currentCrop.width,
    y: currentCrop.y + top * currentCrop.height,
    width: currentCrop.width * width,
    height: currentCrop.height * height,
  };

  state.transform.crop = nextCrop;
  deactivateCropMode();
  renderImage();

  if (hasImageLoaded()) {
    pushHistory(createSnapshot());
    updateHistoryControls();
    announce("Recadrage appliqué.");
  }
}

function cancelCropSession(event) {
  if (!cropSession) {
    return;
  }
  cropOverlay.releasePointerCapture?.(event.pointerId);
  cropSession = null;
  updateCropRectDisplay(null);
  cropHint.textContent = "Cliquez puis faites glisser pour définir la zone à conserver.";
  announce("Recadrage annulé.");
}

function openInfoModal() {
  if (!infoModal) {
    return;
  }
  infoModal.hidden = false;
  infoModal.dataset.open = "true";
  infoToggle?.setAttribute("aria-expanded", "true");
  infoCloseButton?.focus();
}

function closeInfoModal() {
  if (!infoModal || infoModal.hidden) {
    return;
  }
  delete infoModal.dataset.open;
  infoModal.hidden = true;
  infoToggle?.setAttribute("aria-expanded", "false");
  infoToggle?.focus();
}

function toggleInfoModal() {
  if (!infoModal) {
    return;
  }
  if (infoModal.hidden) {
    openInfoModal();
  } else {
    closeInfoModal();
  }
}

function openExportModal() {
  if (!hasImageLoaded() || !exportModal) {
    return;
  }
  updateExportFormInputs();
  exportModal.hidden = false;
  exportModal.dataset.open = "true";
  exportButton?.setAttribute("aria-expanded", "true");
  exportNameInput?.focus();
  queueExportSizeUpdate({ immediate: true });
}

function closeExportModal() {
  if (!exportModal || exportModal.hidden) {
    return;
  }
  delete exportModal.dataset.open;
  exportModal.hidden = true;
  exportButton?.setAttribute("aria-expanded", "false");
  if (exportButton && !exportButton.disabled) {
    exportButton.focus();
  }
}

function setExportDimensions({ width, height, updateInputs = true }) {
  if (width) {
    state.exportOptions.width = Math.max(1, Math.round(width));
  }
  if (height) {
    state.exportOptions.height = Math.max(1, Math.round(height));
  }
  if (state.exportOptions.lockRatio) {
    state.exportOptions.aspectRatio = state.exportOptions.width / state.exportOptions.height || state.exportOptions.aspectRatio;
  }
  if (updateInputs) {
    updateExportFormInputs();
  }
}

function getExportDimensions() {
  if (state.exportOptions.followCanvas) {
    return { width: canvas.width, height: canvas.height };
  }
  return {
    width: Math.max(1, Math.round(state.exportOptions.width || canvas.width || 1)),
    height: Math.max(1, Math.round(state.exportOptions.height || canvas.height || 1)),
  };
}

function lockHeightToWidth(width) {
  const aspect = state.exportOptions.aspectRatio || canvas.width / (canvas.height || 1) || 1;
  const computedHeight = Math.round(width / aspect);
  state.exportOptions.width = Math.max(1, Math.round(width));
  state.exportOptions.height = Math.max(1, computedHeight);
  state.exportOptions.aspectRatio = state.exportOptions.width / state.exportOptions.height;
}

function lockWidthToHeight(height) {
  const aspect = state.exportOptions.aspectRatio || canvas.width / (canvas.height || 1) || 1;
  const computedWidth = Math.round(height * aspect);
  state.exportOptions.height = Math.max(1, Math.round(height));
  state.exportOptions.width = Math.max(1, computedWidth);
  state.exportOptions.aspectRatio = state.exportOptions.width / state.exportOptions.height;
}

function dataURLToBlob(dataUrl) {
  const [meta, content] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const isBase64 = meta.includes("base64");
  let byteString;
  if (isBase64) {
    byteString = atob(content);
  } else {
    byteString = decodeURIComponent(content);
  }
  const len = byteString.length;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    buffer[i] = byteString.charCodeAt(i);
  }
  return new Blob([buffer], { type: mime });
}

function canvasToBlob(sourceCanvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    sourceCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          try {
            const fallbackUrl = sourceCanvas.toDataURL(mimeType, quality);
            resolve(dataURLToBlob(fallbackUrl));
          } catch (error) {
            reject(error);
          }
        }
      },
      mimeType,
      quality,
    );
  });
}

async function createSvgBlobFromCanvas(sourceCanvas, width, height) {
  const dataUrl = sourceCanvas.toDataURL("image/png", 0.92);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">` +
    `<image href="${dataUrl}" width="${width}" height="${height}" />` +
    `</svg>`;
  return new Blob([svg], { type: MIME_TYPES.svg });
}

async function createPdfBlobFromCanvas(sourceCanvas, width, height) {
  const jpegBlob = await canvasToBlob(sourceCanvas, MIME_TYPES.jpeg, 0.92);
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const objectsOffsets = [0];
  const chunks = [];
  let position = 0;

  function pushChunk(chunk) {
    if (typeof chunk === "string") {
      const bytes = textEncoder.encode(chunk);
      chunks.push(bytes);
      position += bytes.length;
    } else {
      chunks.push(chunk);
      position += chunk.length;
    }
  }

  function beginObject() {
    objectsOffsets.push(position);
  }

  pushChunk("%PDF-1.4\n");

  beginObject();
  pushChunk("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  beginObject();
  pushChunk("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  beginObject();
  pushChunk(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n`,
  );

  beginObject();
  pushChunk(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  pushChunk(jpegBytes);
  pushChunk("\nendstream\nendobj\n");

  const contentStream = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  const contentBytes = textEncoder.encode(contentStream);

  beginObject();
  pushChunk(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  pushChunk(contentStream);
  pushChunk("\nendstream\nendobj\n");

  const xrefOffset = position;
  const objectsCount = objectsOffsets.length;
  let xref = `xref\n0 ${objectsCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < objectsCount; i += 1) {
    xref += `${String(objectsOffsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objectsCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  pushChunk(xref);

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const pdfBytes = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    pdfBytes.set(chunk, offset);
    offset += chunk.length;
  });

  return new Blob([pdfBytes], { type: MIME_TYPES.pdf });
}

async function createExportBlob(format, width, height) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempContext = tempCanvas.getContext("2d");
  tempContext.drawImage(canvas, 0, 0, width, height);

  switch (format) {
    case "png":
      return canvasToBlob(tempCanvas, MIME_TYPES.png, 0.92);
    case "jpeg":
      return canvasToBlob(tempCanvas, MIME_TYPES.jpeg, 0.92);
    case "webp":
      return canvasToBlob(tempCanvas, MIME_TYPES.webp, 0.92);
    case "svg":
      return createSvgBlobFromCanvas(tempCanvas, width, height);
    case "pdf":
      return createPdfBlobFromCanvas(tempCanvas, width, height);
    default:
      return canvasToBlob(tempCanvas, MIME_TYPES.png, 0.92);
  }
}

async function saveBlob(blob, fileName, format) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: `${format.toUpperCase()} export`,
            accept: { [MIME_TYPES[format] || "application/octet-stream"]: [`.${EXTENSIONS[format] || "dat"}`] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      if (error.name === "AbortError") {
        return false;
      }
      console.warn("showSaveFilePicker indisponible", error);
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

async function exportCurrentImage() {
  if (!hasImageLoaded()) {
    return false;
  }
  renderImage();
  const { format } = state.exportOptions;
  const { width, height } = getExportDimensions();
  const baseName = sanitizeFileName(
    exportNameInput.value || state.exportOptions.name || state.fileMeta?.name || "pixellab-image",
  );
  const extension = EXTENSIONS[format] || "png";
  const fileName = `${baseName}.${extension}`;

  try {
    const blob = await createExportBlob(format, width, height);
    exportSizeJobToken += 1;
    if (exportSizeTimeoutId) {
      clearTimeout(exportSizeTimeoutId);
      exportSizeTimeoutId = null;
    }
    const saved = await saveBlob(blob, fileName, format);
    if (saved) {
      if (exportSizeOutput) {
        exportSizeOutput.textContent = `Taille exportée ~ ${formatFileSize(blob.size)}`;
      }
      announce(`Image exportée en ${format.toUpperCase()} (${width} × ${height}).`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Export error", error);
    announce("Export impossible.");
    return false;
  }
}

function openFilePicker() {
  if (typeof fileInput.click === "function") {
    fileInput.click();
    announce("Fenêtre de sélection de fichier ouverte.");
  }
}

fileInput.addEventListener("change", (event) => {
  handleFiles(event.target.files);
  event.target.value = "";
});

filterInputs.forEach((input) => {
  input.addEventListener("input", handleFilterInput);
  input.addEventListener("change", handleFilterCommit);
});

resetFiltersButton.addEventListener("click", () => {
  resetFiltersToDefaults();
});

undoButton.addEventListener("click", () => {
  performUndo();
});

redoButton.addEventListener("click", () => {
  resetAllChanges();
});

cropToggle.addEventListener("click", () => {
  toggleCropMode();
});

infoToggle?.addEventListener("click", () => {
  toggleInfoModal();
});

infoCloseButton?.addEventListener("click", () => {
  closeInfoModal();
});

infoModal?.addEventListener("click", (event) => {
  if (event.target === infoModal) {
    closeInfoModal();
  }
});

exportButton?.addEventListener("click", () => {
  if (exportButton.disabled) {
    return;
  }
  openExportModal();
});

exportCloseButton?.addEventListener("click", () => {
  closeExportModal();
});

exportCancelButton?.addEventListener("click", () => {
  closeExportModal();
});

exportModal?.addEventListener("click", (event) => {
  if (event.target === exportModal) {
    closeExportModal();
  }
});

exportForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (exportConfirmButton?.disabled) {
    return;
  }
  const success = await exportCurrentImage();
  if (success) {
    closeExportModal();
  }
});

exportNameInput.addEventListener("input", (event) => {
  state.exportOptions.name = sanitizeFileName(event.target.value || state.exportOptions.name);
  event.target.value = state.exportOptions.name;
});

exportFormatSelect.addEventListener("change", (event) => {
  state.exportOptions.format = event.target.value;
  queueExportSizeUpdate({ immediate: true });
});

exportWidthInput.addEventListener("input", (event) => {
  if (state.exportOptions.followCanvas) {
    state.exportOptions.followCanvas = false;
    exportFollowCanvasToggle.checked = false;
  }
  const value = Number.parseInt(event.target.value, 10);
  if (Number.isNaN(value) || value <= 0) {
    return;
  }
  if (state.exportOptions.lockRatio) {
    lockHeightToWidth(value);
  } else {
    state.exportOptions.width = value;
  }
  updateExportFormInputs();
  queueExportSizeUpdate({ immediate: true });
});

exportHeightInput.addEventListener("input", (event) => {
  if (state.exportOptions.followCanvas) {
    state.exportOptions.followCanvas = false;
    exportFollowCanvasToggle.checked = false;
  }
  const value = Number.parseInt(event.target.value, 10);
  if (Number.isNaN(value) || value <= 0) {
    return;
  }
  if (state.exportOptions.lockRatio) {
    lockWidthToHeight(value);
  } else {
    state.exportOptions.height = value;
  }
  updateExportFormInputs();
  queueExportSizeUpdate({ immediate: true });
});

exportLockRatioToggle.addEventListener("change", (event) => {
  state.exportOptions.lockRatio = event.target.checked;
  if (state.exportOptions.lockRatio) {
    state.exportOptions.aspectRatio = (state.exportOptions.width || canvas.width) / (state.exportOptions.height || canvas.height || 1) || 1;
    if (!state.exportOptions.followCanvas) {
      lockHeightToWidth(state.exportOptions.width);
    }
  }
  updateExportFormInputs();
  queueExportSizeUpdate({ immediate: true });
});

exportFollowCanvasToggle.addEventListener("change", (event) => {
  state.exportOptions.followCanvas = event.target.checked;
  syncExportOptionsWithCanvas({ force: state.exportOptions.followCanvas });
  updateExportFormInputs();
  queueExportSizeUpdate({ immediate: true });
});

previewFrame.addEventListener("dragover", (event) => {
  event.preventDefault();
  previewFrame.classList.add("is-dragover");
});

previewFrame.addEventListener("dragleave", () => {
  previewFrame.classList.remove("is-dragover");
});

previewFrame.addEventListener("drop", (event) => {
  event.preventDefault();
  previewFrame.classList.remove("is-dragover");
  handleFiles(event.dataTransfer?.files);
  fileInput.value = "";
});

fileInput.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && typeof fileInput.click === "function") {
    event.preventDefault();
    fileInput.click();
  }
});

cropOverlay.addEventListener("pointerdown", startCropSession);
window.addEventListener("pointermove", updateCropSession);
window.addEventListener("pointerup", finishCropSession);
window.addEventListener("pointercancel", cancelCropSession);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.isCropping) {
      deactivateCropMode();
      updateCropRectDisplay(null);
      announce("Mode recadrage désactivé.");
    }
    if (infoModal && !infoModal.hidden) {
      closeInfoModal();
    }
    if (exportModal && !exportModal.hidden) {
      closeExportModal();
    }
  }
});

registerShortcuts([
  ["Ctrl+Z", performUndo],
  ["Meta+Z", performUndo],
  ["Ctrl+Shift+Z", resetAllChanges],
  ["Meta+Shift+Z", resetAllChanges],
  ["Ctrl+O", openFilePicker],
  ["Meta+O", openFilePicker],
  ["Ctrl+Shift+F", () => resetFiltersToDefaults({ announceMessage: true })],
  ["Meta+Shift+F", () => resetFiltersToDefaults({ announceMessage: true })],
  ["Ctrl+E", openExportModal],
  ["Meta+E", openExportModal],
  ["Ctrl+Shift+C", toggleCropMode],
  ["Meta+Shift+C", toggleCropMode],
  ["Ctrl+I", toggleInfoModal],
  ["Meta+I", toggleInfoModal],
]);

setupTheme();
setupLocale();
resetPreview();
syncFilterControls();
updateExportFormInputs();
updateHistoryControls();
