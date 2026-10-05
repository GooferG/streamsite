import fs from 'fs';
import path from 'path';
import { ART_ASPECT, DOOR_IDS, LAYOUT, ROOM, SCREEN_CLASS, center, cropStyle, insideSafe, intersects, overlapShare, plateSrc, plateSrcSet, within } from '../couchLayout';
import { moonBox } from '../RoomWindow';
import { themeLinks } from '../themes';

const PUBLIC = path.resolve(__dirname, '../../../../public');

test('every door has a rect and an anchor, and both screens exist', () => {
  for (const id of DOOR_IDS) {
    expect(LAYOUT.doors[id].rect).toHaveLength(4);
    expect(LAYOUT.doors[id].anchor).toHaveLength(2);
  }
  expect(LAYOUT.screens.tv).toHaveLength(4);
  expect(LAYOUT.screens.laptop).toHaveLength(4);
  expect(LAYOUT.phoneCrop).toHaveLength(4);
});

// Every '/couch/…' string anywhere in the layout: plates, cutouts, toys, window, themes.
const srcs = (node) => {
  if (typeof node === 'string') return node.startsWith('/couch/') ? [node] : [];
  return node && typeof node === 'object' ? Object.values(node).flatMap(srcs) : [];
};

test('every image the layout names is in public/', () => {
  const files = srcs(LAYOUT);
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) expect([f, fs.existsSync(path.join(PUBLIC, f))]).toEqual([f, true]);
});

test('the room names its objects, its screen skin and its window', () => {
  expect(ROOM.id).toBe('90s');
  expect(SCREEN_CLASS).toBe('couch-crt');
  for (const id of DOOR_IDS) expect(typeof ROOM.names[id]).toBe('string');
  expect(LAYOUT.window.glass).toHaveLength(4);
});

test('the final art keeps every door inside the safe area', () => {
  if (!LAYOUT.final) return;
  for (const id of DOOR_IDS) expect(insideSafe(LAYOUT.doors[id].rect)).toBe(true);
});

test('helpers', () => {
  expect(insideSafe([20, 20, 10, 10])).toBe(true);
  expect(insideSafe([5, 20, 10, 10])).toBe(false);
  expect(plateSrcSet({ 1920: '/b.webp', 1280: '/a.webp' })).toBe('/a.webp 1280w, /b.webp 1920w');
  expect(plateSrc({ 1280: '/a.webp', 1920: '/b.webp', 2560: '/c.webp' })).toBe('/b.webp');
  expect(plateSrc({ 1280: '/a.webp' })).toBe('/a.webp');
  expect(within([10, 10, 20, 40], [15, 20, 10, 10])).toEqual([25, 25, 50, 25]);
  expect(cropStyle([25, 50, 50, 25])).toMatchObject({ width: '200%', height: '400%', left: '-50%', top: '-200%' });
  expect(center([10, 20, 30, 40])).toEqual([25, 40]);
});

test('intersects', () => {
  expect(intersects([0, 0, 10, 10], [5, 5, 10, 10])).toBe(true);
  expect(intersects([0, 0, 10, 10], [10, 0, 5, 5])).toBe(false);
});

test('in the final art no toy or dressing sits on a door', () => {
  if (!LAYOUT.final) return;
  const items = [
    ...(LAYOUT.toys || []),
    ...Object.values(LAYOUT.themes || {}).flatMap((t) => [...(t.toys || []), ...(t.dressing || [])]),
  ];
  for (const item of items) {
    for (const id of DOOR_IDS) expect([item.id, id, intersects(item.rect, LAYOUT.doors[id].rect)]).toEqual([item.id, id, false]);
  }
});

// A linked dressing layer (the Halloween poster) paints over the toys and the
// window, so it must never sit on one or it would swallow their pokes.
test('in the final art no linked dressing sits on a toy or the window toys', () => {
  if (!LAYOUT.final) return;
  const win = LAYOUT.window;
  const windowToys = [win.cord, moonBox(win.glass, false, ART_ASPECT, win.blinds && win.blinds.rect), moonBox(win.glass, true, ART_ASPECT, win.blinds && win.blinds.rect)].filter(Boolean);
  for (const [id, theme] of Object.entries(LAYOUT.themes || {})) {
    const links = themeLinks(id);
    const toys = [...(LAYOUT.toys || []), ...(theme.toys || [])].map((t) => t.rect);
    for (const layer of (theme.dressing || []).filter((l) => links[l.id])) {
      for (const rect of [...toys, ...windowToys]) expect([layer.id, rect, intersects(layer.rect, rect)]).toEqual([layer.id, rect, false]);
    }
  }
});

test('overlapShare is the part of a rect inside a frame', () => {
  const frame = [10, 10, 20, 20];
  expect(overlapShare(frame, [12, 12, 4, 4])).toBe(1);
  expect(overlapShare(frame, [28, 10, 4, 4])).toBe(0.5);
  expect(overlapShare(frame, [0, 0, 5, 5])).toBe(0);
  expect(overlapShare(frame, [30, 10, 5, 5])).toBe(0); // touching edges only
  expect(overlapShare(frame, [0, 0, 100, 100])).toBeCloseTo(0.04, 10);
  expect(overlapShare(frame, [12, 12, 0, 4])).toBe(0);
});
