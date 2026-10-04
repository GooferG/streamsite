import { NAV_H } from '../nav/navMetrics';

export { NAV_H }; // the nav bar's height; ControlRoom imports it from here

export const PANEL_W = 380;
export const DOCK_W = 400;
export const EDGE = 16;
export const SNAP = 24;
export const DOCK_ZONE = 48;
export const UNDOCK_DIST = 64;
export const GRAB = 48; // px of the header that must stay reachable
export const HEADER_H = 36;
export const LIVE_BADGE_CLEARANCE = 104; // bottom offset that clears "Goofer is live"

// Hand resizing (floating panel and dock width).
export const MIN_W = 320;
export const MAX_W = 720;
export const MIN_H = 240;
export const DOCK_MIN = 320;
export const DOCK_MAX = 720;
export const PAGE_MIN = 480; // page width the dock always leaves
export const RESIZE_STEP = 16;
export const RESIZE_STEP_BIG = 64;

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const maxPanelW = (vw) => Math.max(MIN_W, Math.min(MAX_W, vw - 2 * EDGE));
const maxPanelH = (vh) => Math.max(MIN_H, vh - NAV_H - EDGE);

// The floating size for this window. No stored size means the default width
// and auto height (h: null).
export function clampSize(size, view) {
  const w = clamp(size && Number.isFinite(size.w) ? size.w : PANEL_W, MIN_W, maxPanelW(view.vw));
  const h = size && Number.isFinite(size.h) ? clamp(size.h, MIN_H, maxPanelH(view.vh)) : null;
  return { w, h };
}

export function clampDockW(w, vw) {
  const max = Math.max(DOCK_MIN, Math.min(DOCK_MAX, vw - PAGE_MIN));
  return clamp(Number.isFinite(w) ? w : DOCK_W, DOCK_MIN, max);
}

const LEFT_EDGES = ['l', 'bl'];
const RIGHT_EDGES = ['r', 'br'];
const BOTTOM_EDGES = ['b', 'bl', 'br'];

// One resize from a handle. Left-side handles move x so the right edge stays
// put; widths stay inside the limits and on screen. A bottom handle sets a
// height; other handles keep the stored one (fixedH, null = auto).
export function resizeFrom(edge, start, dx, dy, view) {
  let { x, w } = start;
  let h = start.fixedH;
  if (LEFT_EDGES.includes(edge)) {
    const right = start.x + start.w;
    w = clamp(start.w - dx, MIN_W, Math.max(MIN_W, Math.min(maxPanelW(view.vw), right)));
    x = right - w;
  } else if (RIGHT_EDGES.includes(edge)) {
    w = clamp(start.w + dx, MIN_W, Math.max(MIN_W, Math.min(maxPanelW(view.vw), view.vw - start.x)));
  }
  if (BOTTOM_EDGES.includes(edge)) {
    h = clamp(start.h + dy, MIN_H, Math.max(MIN_H, Math.min(maxPanelH(view.vh), view.vh - start.y)));
  }
  return { rect: { x, y: start.y }, size: { w, h } };
}

// The visible grip sits in the bottom corner that faces the screen centre.
export const gripSide = (rect, w, vw) => (rect.x + w / 2 > vw / 2 ? 'bl' : 'br');

export function defaultRect(vw, w = PANEL_W) {
  return { x: Math.max(EDGE, vw - w - EDGE), y: NAV_H + EDGE };
}

// Keeps at least GRAB px of the header on screen sideways and the whole header
// on screen vertically, so the panel can always be dragged back.
export function clampRect(rect, size, view) {
  return {
    x: Math.min(Math.max(rect.x, GRAB - size.w), view.vw - GRAB),
    y: Math.min(Math.max(rect.y, NAV_H), view.vh - HEADER_H),
  };
}

function cornerPoints(size, view) {
  return {
    tl: { x: EDGE, y: NAV_H + EDGE },
    tr: { x: view.vw - size.w - EDGE, y: NAV_H + EDGE },
    bl: { x: EDGE, y: view.vh - size.h - EDGE },
    br: { x: view.vw - size.w - EDGE, y: view.vh - size.h - EDGE },
  };
}

export function snapToCorner(rect, size, view) {
  for (const [corner, p] of Object.entries(cornerPoints(size, view))) {
    if (Math.abs(rect.x - p.x) <= SNAP && Math.abs(rect.y - p.y) <= SNAP) return { rect: p, corner };
  }
  return { rect, corner: null };
}

export function nearestCorner(rect, size, view) {
  const v = rect.y + size.h / 2 < view.vh / 2 ? 't' : 'b';
  const h = rect.x + size.w / 2 < view.vw / 2 ? 'l' : 'r';
  return `${v}${h}`;
}

export const inDockZone = (pointerX, vw) => pointerX >= vw - DOCK_ZONE;
export const shouldUndock = (startX, pointerX) => startX - pointerX > UNDOCK_DIST;

export function pillAnchor(corner, restoreTo) {
  if (restoreTo === 'dock') return { right: EDGE, bottom: LIVE_BADGE_CLEARANCE };
  switch (corner) {
    case 'tl':
      return { left: EDGE, top: NAV_H + EDGE };
    case 'bl':
      return { left: EDGE, bottom: EDGE };
    case 'br':
      return { right: EDGE, bottom: LIVE_BADGE_CLEARANCE };
    default:
      return { right: EDGE, top: NAV_H + EDGE };
  }
}

// The panel powers on from the corner its pill sits in.
export function originFor(corner, restoreTo) {
  if (restoreTo === 'dock') return 'bottom right';
  return { tl: 'top left', tr: 'top right', bl: 'bottom left', br: 'bottom right' }[corner] || 'top right';
}
