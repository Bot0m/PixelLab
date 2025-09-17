const registry = new Map();

function normalizeCombo(combo) {
  return combo
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.length === 1 ? part.toUpperCase() : capitalize(part)))
    .join("+");
}

function capitalize(value) {
  if (!value) {
    return value;
  }
  const lower = value.toLowerCase();
  switch (lower) {
    case "ctrl":
    case "control":
      return "Ctrl";
    case "meta":
    case "cmd":
    case "command":
      return "Meta";
    case "alt":
    case "option":
      return "Alt";
    case "shift":
      return "Shift";
    default:
      return value.length === 1 ? value.toUpperCase() : value;
  }
}

export function registerShortcuts(entries) {
  entries.forEach(([combo, handler]) => {
    registry.set(normalizeCombo(combo), handler);
  });
}

function eventToCombo(event) {
  const parts = [];
  if (event.ctrlKey) {
    parts.push("Ctrl");
  }
  if (event.metaKey) {
    parts.push("Meta");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  parts.push(key);
  return parts.join("+");
}

function shouldCapture(event) {
  const tagName = event.target?.tagName?.toLowerCase();
  const isEditable =
    event.target?.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";

  if (!isEditable) {
    return true;
  }

  // Laisser passer les raccourcis sans modificateurs dans les champs.
  return event.ctrlKey || event.metaKey || event.altKey;
}

document.addEventListener("keydown", (event) => {
  if (!shouldCapture(event)) {
    return;
  }

  const combo = eventToCombo(event);
  const handler = registry.get(combo);

  if (handler) {
    event.preventDefault();
    handler(event);
  }
});
