import { act, render, screen } from '@testing-library/react';
import { buildCouch } from '../couchModel';
import { COUCH_FIXTURES as F } from '../couchFixtures';
import { liteConnection, reelItems, reelMode } from '../reel';
import useTvReel from '../useTvReel';

const CARDS = [{ kicker: 'Off air', text: 'A' }, { kicker: 'Tapes', text: 'B' }];
const loop = (id) => ({ id, title: id, sources: { h264: `/tv/reel/${id}.mp4` }, poster: `/tv/reel/${id}.jpg` });
const tag = (i) => (i.kind === 'ad' ? `ad:${i.ad}` : `${i.kind}:${i.id}`);
const adsFor = (input) => buildCouch(input).tv.ads;

// The reel as a loop: start right after the last commercial, so every run of
// segments between two commercials is whole, the wrap included.
function breaks(items) {
  const last = items.map((i) => i.kind).lastIndexOf('ad');
  const turned = [...items.slice(last + 1), ...items.slice(0, last + 1)];
  const runs = [];
  let run = [];
  turned.forEach((i) => {
    if (i.kind === 'ad') {
      runs.push({ ad: i.ad, clips: run.filter((r) => r.kind === 'video' || r.kind === 'still').length });
      run = [];
    } else run.push(i);
  });
  return runs;
}

test('off air a commercial follows every two clips, GSN, Goofer Video and the Guide in turn', () => {
  const items = reelItems({ reel: ['a', 'b', 'c', 'd'].map(loop), cards: CARDS, ads: adsFor(F.offair.input) });
  expect(items.slice(0, 8).map(tag)).toEqual([
    'video:a', 'card:card-0', 'video:b', 'ad:gsn', 'card:card-1', 'video:c', 'video:d', 'ad:video',
  ]);
  // Round the loop too: always two clips, and the three keep their turn.
  const runs = breaks(items);
  expect(runs.every((r) => r.clips === 2)).toBe(true);
  expect(runs.map((r) => r.ad)).toEqual(['gsn', 'video', 'guide', 'gsn', 'video', 'guide']);
});

test('the reel loop keeps the pattern with an odd number of clips', () => {
  const items = reelItems({ reel: ['a', 'b', 'c'].map(loop), cards: CARDS, ads: adsFor(F.offair.input) });
  const runs = breaks(items);
  expect(runs.every((r) => r.clips === 2)).toBe(true);
  expect(runs.length % 3).toBe(0);
  expect(runs.slice(0, 3).map((r) => r.ad)).toEqual(['gsn', 'video', 'guide']);
});

test('without a schedule the Guide sits out and the other two take turns', () => {
  const ads = adsFor({ ...F.offair.input, schedule: [] });
  expect(ads.map((a) => a.ad)).toEqual(['gsn', 'video']);
  const runs = breaks(reelItems({ reel: ['a', 'b', 'c', 'd'].map(loop), cards: CARDS, ads }));
  expect(runs.map((r) => r.ad)).toEqual(['gsn', 'video']);
  expect(adsFor({ ...F.offair.input, schedule: null }).map((a) => a.ad)).toEqual(['gsn', 'video']);
});

test('the Guide commercial carries the next three shows', () => {
  const guide = adsFor(F.offair.input).find((a) => a.ad === 'guide');
  expect(guide.listings).toEqual([
    { day: 'Tomorrow', time: '11:00 AM', show: 'Bonus Hunt Time!' },
    { day: 'Tue', time: '5:00 PM', show: 'Freestyle Chilling' },
  ]);
  // Never more than three, soonest first, days off left out.
  const week = [
    { day: 'FRIDAY', time: '8:00 PM AZ', content: 'Slots', gameName: 'Fry-day', status: 'on' },
    { day: 'WEDNESDAY', time: '7:00 PM', content: 'Win Wednesdays', gameName: '', status: 'on' },
    { day: 'THURSDAY', time: '', content: 'Slots', gameName: 'Thursday Thing', status: 'off' },
    { day: 'SATURDAY', time: 'late-ish', content: 'Slots', gameName: 'Whenever', status: 'on' },
    ...F.offair.input.schedule,
  ];
  expect(adsFor({ ...F.offair.input, schedule: week }).find((a) => a.ad === 'guide').listings).toEqual([
    { day: 'Tomorrow', time: '11:00 AM', show: 'Bonus Hunt Time!' },
    { day: 'Tue', time: '5:00 PM', show: 'Freestyle Chilling' },
    { day: 'Wed', time: '7:00 PM', show: 'Win Wednesdays' },
  ]);
  // A time that doesn't read is listed as typed.
  expect(adsFor({ ...F.offair.input, schedule: [week[3]] }).find((a) => a.ad === 'guide').listings).toEqual([
    { day: 'Sat', time: 'late-ish', show: 'Whenever' },
  ]);
});

test('live there are no commercials', () => {
  expect(adsFor(F.live.input)).toEqual([]);
  expect(adsFor(F.loading.input)).toEqual([]);
  const items = reelItems({ reel: ['a', 'b', 'c', 'd'].map(loop), cards: [], ads: adsFor(F.live.input) });
  expect(items.some((i) => i.kind === 'ad')).toBe(false);
});

test('with no clips the commercials still rotate, with the stills and the cards', () => {
  const ads = adsFor(F.offair.input);
  // An empty manifest: the newest tape and the clip thumbnails stand in.
  const stills = reelItems({ reel: [], videos: F.offair.input.videos, clips: F.offair.input.clips, cards: CARDS, ads });
  expect(stills.slice(0, 4).map(tag)).toEqual(['still:vod-2585950001', 'card:card-0', 'still:clip-c1', 'ad:gsn']);
  expect(breaks(stills).every((r) => r.clips === 2)).toBe(true);
  // Nothing to show at all: a commercial after every two cards.
  const cardsOnly = reelItems({ reel: [], cards: [...CARDS, { kicker: 'Laptop', text: 'C' }], ads });
  expect(cardsOnly.slice(0, 4).map(tag)).toEqual(['card:card-0', 'card:card-1', 'ad:gsn', 'card:card-2']);
});

test('every commercial gets its own id and slot length', () => {
  const items = reelItems({ reel: ['a', 'b', 'c', 'd'].map(loop), cards: CARDS, ads: adsFor(F.offair.input) });
  const ids = items.filter((i) => i.kind === 'ad').map((i) => i.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(items.filter((i) => i.kind === 'ad').every((i) => i.ms === 8000)).toBe(true);
});

test('with a manifest the reel alternates loops and cards', () => {
  const reel = ['one', 'two', 'three'].map(loop);
  expect(reelItems({ reel, cards: CARDS }).map((i) => `${i.kind}:${i.id}`)).toEqual([
    'video:one', 'card:card-0', 'video:two', 'card:card-1', 'video:three',
  ]);
  expect(reelItems({ reel }).find((i) => i.id === 'one').sources).toEqual({ h264: '/tv/reel/one.mp4' });
});

test('a malformed manifest entry is skipped, and an AV1 file is never passed on', () => {
  const reel = [
    null,
    { id: 'no-file', title: 'x', sources: {}, poster: '/tv/reel/x.jpg' },
    { id: 'no-sources', title: 'x', poster: '/tv/reel/x.jpg' },
    { id: 'no-poster', title: 'x', sources: { h264: '/tv/reel/x.mp4' } },
    { ...loop('old'), sources: { av1: '/tv/reel/old.webm', h264: '/tv/reel/old.mp4' } },
    loop('good'),
  ];
  const items = reelItems({ reel });
  expect(items.map((i) => i.id)).toEqual(['old', 'good']);
  expect(items[0].sources).toEqual({ h264: '/tv/reel/old.mp4' });
  // Nothing playable: the newest tape and the clip thumbnails stand in.
  const stills = reelItems({ reel: [null, { id: 'x' }], clips: [{ id: 'c1', thumbnail_url: 'https://x/c1.jpg' }] });
  expect(stills.map((i) => `${i.kind}:${i.id}`)).toEqual(['still:clip-c1']);
});

test('the shipped manifest is H.264 only, smallest loop first, every entry playable', () => {
  const manifest = require('../../../../public/tv/reel/manifest.json');
  expect(manifest.length).toBeGreaterThan(0);
  expect(manifest[0].id).toBe('i-guess');
  manifest.forEach((m) => {
    expect(Object.keys(m.sources)).toEqual(['h264']);
    expect(m.sources.h264).toMatch(/^\/tv\/reel\/[a-z0-9-]+\.mp4$/);
    expect(m.poster).toMatch(/^\/tv\/reel\/[a-z0-9-]+\.jpg$/);
  });
  expect(reelItems({ reel: manifest })).toHaveLength(manifest.length);
});

test('without a manifest it uses the newest tape and clip thumbnails', () => {
  const items = reelItems({
    reel: [],
    videos: [{ id: 'v1', thumbnail_url: 'https://x/thumb-%{width}x%{height}.jpg' }],
    clips: [{ id: 'c1', thumbnail_url: 'https://x/c1.jpg' }, { id: 'c2' }],
    cards: CARDS,
  });
  expect(items).toEqual([
    { kind: 'still', id: 'vod-v1', src: 'https://x/thumb-640x360.jpg' },
    { kind: 'card', id: 'card-0', kicker: 'Off air', text: 'A' },
    { kind: 'still', id: 'clip-c1', src: 'https://x/c1.jpg' },
    { kind: 'card', id: 'card-1', kicker: 'Tapes', text: 'B' },
  ]);
});

test('reelMode', () => {
  expect(reelMode({})).toBe('video');
  // Save-Data is its own mode: posters, and commercials as still frames.
  expect(reelMode({ saveData: true })).toBe('lite');
  expect(reelMode({ saveData: true, autoplayBlocked: true })).toBe('lite');
  // A refused autoplay is no data concern: posters, full commercials.
  expect(reelMode({ autoplayBlocked: true })).toBe('stills');
  expect(reelMode({ reducedMotion: true, saveData: true })).toBe('hold');
});

test('liteConnection: Save-Data or a connection rated 3G or slower', () => {
  expect(liteConnection({ saveData: true })).toBe(true);
  ['slow-2g', '2g', '3g'].forEach((effectiveType) => expect(liteConnection({ effectiveType })).toBe(true));
  expect(liteConnection({ effectiveType: '4g' })).toBe(false);
  expect(liteConnection({ effectiveType: '4g', saveData: false })).toBe(false);
  expect(liteConnection({})).toBe(false);
  expect(liteConnection(undefined)).toBe(false);
  expect(liteConnection(null)).toBe(false);
});

function Probe() {
  const reel = useTvReel();
  return <p data-testid="reel">{reel === null ? 'null' : JSON.stringify(reel)}</p>;
}

test('useTvReel fetches the manifest once the page is idle, and [] when there is none', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
  render(<Probe />);
  expect(screen.getByTestId('reel').textContent).toBe('null');
  await act(async () => {
    jest.advanceTimersByTime(1300);
  });
  jest.useRealTimers();
  expect(global.fetch).toHaveBeenCalledWith('/tv/reel/manifest.json');
  expect(screen.getByTestId('reel').textContent).toBe('[]');
});
