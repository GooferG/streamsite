// Per-browser panel state and prefs. Every read and write is guarded: a
// private window, blocked storage or an older shape falls back to defaults.
import { DOCK_MAX, DOCK_MIN, MAX_W, MIN_H, MIN_W } from './geometry';

export const STORAGE_KEY = 'goofer:control-room';

const MODES = ['closed', 'pill', 'float', 'dock'];
const OPEN_MODES = ['float', 'dock'];
const CORNERS = ['tl', 'tr', 'bl', 'br'];
const TABS = ['giveaway', 'predict', 'redeem'];
const REDEEM_FILTERS = ['all', 'stream', 'payouts'];

export const DEFAULT_STORE = Object.freeze({
  mode: 'closed',
  restoreTo: 'float',
  rect: null,
  corner: 'tr',
  tab: 'giveaway',
  stage: false,
  hideLiveBadge: false,
  size: null,
  dockW: null,
  redeemSeenAt: null,
  redeemFilter: 'all',
});

export const isOpenMode = (mode) => OPEN_MODES.includes(mode);

function cleanRect(rect) {
  if (!rect || typeof rect !== 'object') return null;
  const { x, y } = rect;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

const clampNum = (n, min, max) => Math.min(Math.max(n, min), max);

// The window clamps again at render; this only keeps the absolute limits.
function cleanSize(size) {
  if (!size || typeof size !== 'object' || !Number.isFinite(size.w)) return null;
  const h = Number.isFinite(size.h) ? Math.max(Math.round(size.h), MIN_H) : null;
  return { w: clampNum(Math.round(size.w), MIN_W, MAX_W), h };
}

const cleanDockW = (w) => (Number.isFinite(w) ? clampNum(Math.round(w), DOCK_MIN, DOCK_MAX) : null);
const cleanMs = (ms) => (Number.isFinite(ms) && ms >= 0 ? ms : null);

export function sanitizeStore(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    mode: MODES.includes(s.mode) ? s.mode : DEFAULT_STORE.mode,
    restoreTo: OPEN_MODES.includes(s.restoreTo) ? s.restoreTo : DEFAULT_STORE.restoreTo,
    rect: cleanRect(s.rect),
    corner: CORNERS.includes(s.corner) ? s.corner : DEFAULT_STORE.corner,
    tab: TABS.includes(s.tab) ? s.tab : DEFAULT_STORE.tab,
    stage: s.stage === true,
    hideLiveBadge: s.hideLiveBadge === true,
    size: cleanSize(s.size),
    dockW: cleanDockW(s.dockW),
    redeemSeenAt: cleanMs(s.redeemSeenAt),
    redeemFilter: REDEEM_FILTERS.includes(s.redeemFilter) ? s.redeemFilter : DEFAULT_STORE.redeemFilter,
  };
}

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStore() {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    return sanitizeStore(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_STORE };
  }
}

export function writeStore(value) {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Quota, private mode or blocked storage: the panel still works this session.
  }
}
