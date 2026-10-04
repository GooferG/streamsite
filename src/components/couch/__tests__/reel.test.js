import { act, render, screen } from '@testing-library/react';
import { reelItems, reelMode } from '../reel';
import useTvReel from '../useTvReel';

const CARDS = [{ kicker: 'Off air', text: 'A' }, { kicker: 'Tapes', text: 'B' }];

test('with a manifest the reel alternates loops and cards', () => {
  const reel = [
    { id: 'one', title: 'one', sources: { av1: '/tv/reel/one.webm', h264: '/tv/reel/one.mp4' }, poster: '/tv/reel/one.jpg' },
    { id: 'two', title: 'two', sources: { av1: '/tv/reel/two.webm', h264: '/tv/reel/two.mp4' }, poster: '/tv/reel/two.jpg' },
    { id: 'three', title: 'three', sources: { av1: '/tv/reel/three.webm', h264: '/tv/reel/three.mp4' }, poster: '/tv/reel/three.jpg' },
  ];
  expect(reelItems({ reel, cards: CARDS }).map((i) => `${i.kind}:${i.id}`)).toEqual([
    'video:one', 'card:card-0', 'video:two', 'card:card-1', 'video:three',
  ]);
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
  expect(reelMode({ saveData: true })).toBe('stills');
  expect(reelMode({ autoplayBlocked: true })).toBe('stills');
  expect(reelMode({ reducedMotion: true, saveData: true })).toBe('hold');
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
