/**
 * activeEditorStore — lightweight pub/sub registry for mounted CanvasInlineEditor instances.
 *
 * Designed to prevent React infinite update-loop (emit -> render -> emit) by enforcing:
 * 1. Strict equality/no-op guards on setters (setActiveEditor, pushState, registerEditor, unregisterEditor)
 * 2. Stable, cached snapshot reference identity for useSyncExternalStore (getSnapshot)
 * 3. Separation between API registration (once per editKey) and state pushing (on change)
 */

let activeKey = null;
/** @type {Map<string, React.RefObject>} key -> apiRef */
const editors = new Map();
/** @type {Map<string, object>} key -> snapshot object */
const toolbarState = new Map();
const subs = new Set();

const emit = () => subs.forEach(fn => fn());

const shallowEqual = (a, b) =>
  a && b &&
  Object.keys(b).every(k => Object.is(a[k], b[k])) &&
  Object.keys(a).every(k => k in b);

export function registerEditor(key, apiRef) {
  const isNew = !editors.has(key);
  editors.set(key, apiRef);
  if (isNew) emit();
}

export function unregisterEditor(key) {
  if (editors.delete(key)) {
    toolbarState.delete(key);
    if (activeKey === key) activeKey = null;
    emit();
  }
}

export function setActiveEditor(key) {
  if (activeKey === key) return; // ← Loop guard
  activeKey = key;
  emit();
}

export function pushState(key, state) {
  const prev = toolbarState.get(key);
  if (shallowEqual(prev, state)) return; // Keep snapshot identity stable
  toolbarState.set(key, state);
  emit();
}

export const getSnapshot = () =>
  (activeKey && toolbarState.get(activeKey)) || null;

export const getDirtySnapshot = () =>
  [...toolbarState.values()].some(s => s?.dirty === true);

export const getActiveEditor = () =>
  (activeKey && editors.get(activeKey)?.current) || null;

export const getEditorApi = (key) =>
  (key && editors.get(key)?.current) || null;

export const getActiveKey = () => activeKey;

export const hasStagedEdits = () => editors.size > 0;

export const hasDirtyStagedEdits = getDirtySnapshot;

export const stagedCount = () => editors.size;

export const subscribe = (fn) => {
  subs.add(fn);
  return () => subs.delete(fn);
};
