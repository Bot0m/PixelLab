export const FILTER_CONFIG = {
  contrast: {
    label: "Contraste",
    min: 50,
    max: 200,
    step: 1,
    unit: "%",
    defaultValue: 100,
  },
  saturation: {
    label: "Saturation",
    min: 0,
    max: 200,
    step: 1,
    unit: "%",
    defaultValue: 100,
  },
  blur: {
    label: "Flou",
    min: 0,
    max: 10,
    step: 0.1,
    unit: "px",
    defaultValue: 0,
  },
};

export const FILTER_DEFAULTS = Object.fromEntries(
  Object.entries(FILTER_CONFIG).map(([key, config]) => [key, config.defaultValue])
);

export function formatFilterValue(filterName, value) {
  const config = FILTER_CONFIG[filterName];
  const unit = config?.unit ?? "";
  return unit === "%" ? `${value} %` : `${value} ${unit}`;
}

export function composeFilterString(filters) {
  return `contrast(${filters.contrast}%) saturate(${filters.saturation}%) blur(${filters.blur}px)`;
}

export function applyFiltersToCanvas(context, image, filters) {
  const { canvas } = context;
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.filter = composeFilterString(filters);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.restore();
}
