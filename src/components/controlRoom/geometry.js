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

export function defaultRect(vw) {
  return { x: Math.max(EDGE, vw - PANEL_W - EDGE), y: NAV_H + EDGE };
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
