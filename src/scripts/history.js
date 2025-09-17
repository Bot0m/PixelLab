const past = [];
const future = [];

function cloneSnapshot(snapshot) {
  if (typeof structuredClone === "function") {
    return structuredClone(snapshot);
  }
  return JSON.parse(JSON.stringify(snapshot));
}

export function reset(initialSnapshot) {
  past.length = 0;
  future.length = 0;
  if (initialSnapshot) {
    past.push(cloneSnapshot(initialSnapshot));
  }
}

export function push(snapshot) {
  past.push(cloneSnapshot(snapshot));
  future.length = 0;
}

export function undo(applySnapshot) {
  if (past.length <= 1) {
    return;
  }

  const current = past.pop();
  future.push(current);

  const previous = past[past.length - 1];
  if (previous) {
    applySnapshot(cloneSnapshot(previous));
  }
}

export function redo(applySnapshot) {
  if (!future.length) {
    return;
  }

  const snapshot = future.pop();
  past.push(cloneSnapshot(snapshot));
  applySnapshot(cloneSnapshot(snapshot));
}

export function canUndo() {
  return past.length > 1;
}

export function canRedo() {
  return future.length > 0;
}
