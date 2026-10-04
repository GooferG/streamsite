import fs from 'fs';
import path from 'path';
import { DOOR_IDS, LAYOUT, ROOM, SCREEN_CLASS, center, cropStyle, insideSafe, plateSrc, plateSrcSet, within } from '../couchLayout';

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
