import room90s from './rooms/90s.json';

// Where everything sits in the art, in percent of the plate (spec rules: Art
// Is Measured, Rooms Are Swappable). A room is its art plus this measured
// layout: the art step writes rooms/<id>.json from the masks and nothing is
// hand-tuned in components. `final` is false while the page runs on the test
// plate, so the safe-area check waits for the real art.
export const ROOMS = { '90s': room90s };
export const ROOM_ID = '90s';
export const LAYOUT = ROOMS[ROOM_ID];
export const ROOM = LAYOUT.room;
// The screens' dressing for this room's era (couch-crt for the 90s).
export const SCREEN_CLASS = `couch-${ROOM.screen}`;
export const SAFE = { x: [12.5, 87.5], y: [12, 88] };
export const ART_ASPECT = LAYOUT.art.width / LAYOUT.art.height;
export const DOOR_IDS = ['tv', 'note', 'laptop', 'tapes', 'guide', 'games', 'remote', 'photo'];

export function insideSafe([x, y, w, h]) {
  return x >= SAFE.x[0] && x + w <= SAFE.x[1] && y >= SAFE.y[0] && y + h <= SAFE.y[1];
}

const widths = (map) => Object.keys(map).map(Number).sort((a, b) => a - b);

export const plateSrcSet = (map) => widths(map).map((w) => `${map[w]} ${w}w`).join(', ');

export function plateSrc(map) {
  const ws = widths(map);
  return map[ws.find((w) => w >= 1920) ?? ws[ws.length - 1]];
}

export const pctStyle = ([x, y, w, h]) => ({ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });

// `inner` re-expressed in percent of `outer` (both in percent of the art).
export function within([ox, oy, ow, oh], [ix, iy, iw, ih]) {
  return [((ix - ox) / ow) * 100, ((iy - oy) / oh) * 100, (iw / ow) * 100, (ih / oh) * 100];
}

// Style for an <img> of the whole art, inside an overflow-hidden box, so that
// `rect` fills the box.
export function cropStyle([x, y, w, h]) {
  return {
    position: 'absolute',
    maxWidth: 'none',
    width: `${10000 / w}%`,
    height: `${10000 / h}%`,
    left: `${(-x / w) * 100}%`,
    top: `${(-y / h) * 100}%`,
  };
}

// A rect's width / height in the art's pixels.
export const rectAspect = ([, , w, h]) => (w * LAYOUT.art.width) / (h * LAYOUT.art.height);

export const center = ([x, y, w, h]) => [x + w / 2, y + h / 2];

// The share of `rect` (0..1) that falls inside `frame`.
export function overlapShare([fx, fy, fw, fh], [rx, ry, rw, rh]) {
  const w = Math.min(fx + fw, rx + rw) - Math.max(fx, rx);
  const h = Math.min(fy + fh, ry + rh) - Math.max(fy, ry);
  if (w <= 0 || h <= 0 || rw <= 0 || rh <= 0) return 0;
  return (w * h) / (rw * rh);
}
export const intersects = ([ax, ay, aw, ah], [bx, by, bw, bh]) => ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
