import { act, fireEvent, render, screen } from '@testing-library/react';
import CouchTv from '../CouchTv';
import { AD_MS, commercials } from '../commercials';
import { STATIC_MS } from '../reel';

const STILL = { kind: 'still', id: 's1', src: '/a.jpg' };
const CARD = { kind: 'card', id: 'card-0', kicker: 'Off air', text: 'Back tomorrow.' };
const VIDEO = { kind: 'video', id: 'v1', sources: { av1: '/v1.webm', h264: '/v1.mp4' }, poster: '/v1.jpg' };
const OFF = { state: 'offair', preview: null, viewers: null, cards: [] };
const LISTINGS = [
  { day: 'Tomorrow', time: '11:00 AM', show: 'Bonus Hunt Time!' },
  { day: 'Tue', time: '5:00 PM', show: 'Freestyle Chilling' },
];
const [GSN, TAPES, GUIDE] = commercials({ listings: LISTINGS });
const srcs = (el) => Array.from(el.querySelectorAll('img')).map((i) => i.getAttribute('src'));
// Every animation class is behind motion-safe (Motion Has An Off Switch).
const classes = (el) => Array.from(el.querySelectorAll('[class]')).flatMap((n) => n.getAttribute('class').split(/\s+/));

beforeEach(() => {
  jest.useFakeTimers();
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});
afterEach(() => jest.useRealTimers());

test('waiting shows static and the whole TV is decorative', () => {
  render(<CouchTv tv={{ ...OFF, state: 'waiting' }} items={[]} mode="video" />);
  expect(screen.getByTestId('tv-static')).toBeTruthy();
  expect(screen.getByTestId('couch-tv').getAttribute('aria-hidden')).toBe('true');
});

test('live shows the preview and the tally', () => {
  render(<CouchTv tv={{ state: 'live', preview: '/p-640x360.jpg?p=1', viewers: 214, cards: [] }} items={[STILL]} mode="video" />);
  expect(screen.getByTestId('tv-live').getAttribute('src')).toBe('/p-640x360.jpg?p=1');
  expect(screen.getByText('Live · 214')).toBeTruthy();
  expect(screen.queryByTestId('tv-still')).toBeNull();
});

test('stills advance through a static cut to the card', () => {
  render(<CouchTv tv={OFF} items={[STILL, CARD]} mode="stills" segmentMs={1000} />);
  expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/a.jpg');
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByTestId('tv-switch')).toBeTruthy();
  act(() => jest.advanceTimersByTime(STATIC_MS));
  expect(screen.getByTestId('tv-card').textContent).toContain('Back tomorrow.');
});

test('hold mode keeps one still with the sentence and never advances', () => {
  render(<CouchTv tv={OFF} items={[CARD, STILL]} mode="hold" segmentMs={1000} />);
  act(() => jest.advanceTimersByTime(10000));
  expect(screen.getByTestId('tv-still')).toBeTruthy();
  expect(screen.getByText('Back tomorrow.')).toBeTruthy();
  expect(screen.queryByTestId('tv-switch')).toBeNull();
});

test('stills mode shows a loop as its poster', () => {
  render(<CouchTv tv={OFF} items={[VIDEO]} mode="stills" />);
  expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/v1.jpg');
});

test('video mode plays muted and reports a refused autoplay', async () => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })));
  const onBlocked = jest.fn();
  render(<CouchTv tv={OFF} items={[VIDEO]} mode="video" onAutoplayBlocked={onBlocked} />);
  const video = screen.getByTestId('tv-video');
  expect(video.muted).toBe(true);
  expect(video.querySelectorAll('source')).toHaveLength(2);
  await act(async () => {});
  expect(onBlocked).toHaveBeenCalled();
});

test('an aborted play is not a refused autoplay', async () => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })));
  const onBlocked = jest.fn();
  render(<CouchTv tv={OFF} items={[VIDEO]} mode="video" onAutoplayBlocked={onBlocked} />);
  await act(async () => {});
  expect(onBlocked).not.toHaveBeenCalled();
});

test('a refusal is reported once even with an inline callback', async () => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.reject(Object.assign(new Error('b'), { name: 'NotAllowedError' })));
  const onBlocked = jest.fn();
  const ui = () => <CouchTv tv={OFF} items={[VIDEO]} mode="video" onAutoplayBlocked={() => onBlocked()} />;
  const { rerender } = render(ui());
  await act(async () => {});
  rerender(ui());
  await act(async () => {});
  expect(onBlocked).toHaveBeenCalledTimes(1);
});

test('items vanishing mid-switch and returning does not crash', () => {
  const { rerender } = render(<CouchTv tv={OFF} items={[STILL, CARD]} mode="stills" segmentMs={1000} />);
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByTestId('tv-switch')).toBeTruthy();
  rerender(<CouchTv tv={OFF} items={[]} mode="stills" segmentMs={1000} />);
  act(() => jest.advanceTimersByTime(STATIC_MS * 2));
  rerender(<CouchTv tv={OFF} items={[STILL, CARD]} mode="stills" segmentMs={1000} />);
  expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/a.jpg');
});

test('the remote flips the screen to the GSN ident', () => {
  render(<CouchTv tv={OFF} items={[STILL]} mode="stills" flipTo="gsn" />);
  expect(screen.getByTestId('tv-flip').getAttribute('src')).toBe('/gsn/ident.webp');
});

test('a still that fails to load is dropped, and a new src gets a fresh try', () => {
  const { rerender } = render(<CouchTv tv={OFF} items={[STILL]} mode="stills" />);
  fireEvent.error(screen.getByTestId('tv-still'));
  expect(screen.queryByTestId('tv-still')).toBeNull();
  rerender(<CouchTv tv={OFF} items={[{ ...STILL, src: '/b.jpg' }]} mode="stills" />);
  expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/b.jpg');
});

describe('commercials', () => {
  test('GSN: the ident, the operator standing by, the lineup popping in, and the lower-third', () => {
    render(<CouchTv tv={OFF} items={[GSN, STILL]} mode="video" />);
    const ad = screen.getByTestId('tv-ad');
    expect(ad.getAttribute('data-ad')).toBe('gsn');
    expect(screen.getByTestId('tv-ad-key').getAttribute('src')).toBe('/gsn/operator-call.webp');
    expect(srcs(ad)).toEqual(
      expect.arrayContaining(['/tv/ads/gsn-ident.webp', '/tv/ads/bonus-buy.webp', '/tv/ads/pick-a-slot.webp', '/tv/ads/smoke-break.webp'])
    );
    expect(ad.textContent).toContain('Operators are standing by.');
    expect(ad.textContent).toContain('Spend your tickets.');
    const lower = screen.getByTestId('tv-ad-lower');
    expect(lower.textContent).toContain('goofer.tv/store');
    expect(lower.textContent).toContain('Call now');
    const animated = classes(ad).filter((c) => c.includes('animate-'));
    expect(animated.length).toBeGreaterThan(0);
    expect(animated.every((c) => c.startsWith('motion-safe:'))).toBe(true);
  });

  test('Goofer Video: the clerk restocking, then asleep, and the lower-third', () => {
    render(<CouchTv tv={OFF} items={[TAPES, STILL]} mode="video" />);
    const ad = screen.getByTestId('tv-ad');
    expect(ad.getAttribute('data-ad')).toBe('video');
    expect(screen.getByTestId('tv-ad-key').getAttribute('src')).toBe('/gsn/video/clerk-restock.webp');
    expect(srcs(ad)).toContain('/gsn/video/clerk-asleep.webp');
    expect(ad.textContent).toContain('New tapes on the shelf.');
    expect(ad.textContent).toContain('Be kind, rewind.');
    expect(screen.getByTestId('tv-ad-lower').textContent).toContain('goofer.tv/vods');
  });

  test('Goofer Guide: the next shows crawl up the listings grid', () => {
    render(<CouchTv tv={OFF} items={[GUIDE, STILL]} mode="video" />);
    const ad = screen.getByTestId('tv-ad');
    expect(ad.getAttribute('data-ad')).toBe('guide');
    expect(ad.textContent).toContain('Goofer Guide');
    const rows = screen.getAllByTestId('tv-ad-listing');
    expect(rows).toHaveLength(2);
    LISTINGS.forEach((l, i) => [l.day, l.time, l.show].forEach((bit) => expect(rows[i].textContent).toContain(bit)));
    expect(screen.getByTestId('tv-ad-lower').textContent).toContain('goofer.tv/schedule');
    expect(classes(ad)).toContain('motion-safe:animate-tv-ad-crawl');
  });

  test('a commercial runs its own slot, then cuts through static; the TV reports what is on', () => {
    const onSegment = jest.fn();
    render(<CouchTv tv={OFF} items={[GSN, CARD]} mode="stills" segmentMs={1000} onSegment={onSegment} />);
    expect(onSegment).toHaveBeenLastCalledWith(GSN);
    act(() => jest.advanceTimersByTime(AD_MS - 1));
    expect(screen.queryByTestId('tv-switch')).toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByTestId('tv-switch')).toBeTruthy();
    act(() => jest.advanceTimersByTime(STATIC_MS));
    expect(screen.queryByTestId('tv-ad')).toBeNull();
    expect(screen.getByTestId('tv-card')).toBeTruthy();
    expect(onSegment).toHaveBeenLastCalledWith(CARD);
  });

  test('new reel data with the same running order does not restart the slot', () => {
    const { rerender } = render(<CouchTv tv={OFF} items={[GSN, CARD]} mode="stills" segmentMs={1000} />);
    act(() => jest.advanceTimersByTime(AD_MS - 2000));
    rerender(<CouchTv tv={OFF} items={[{ ...GSN }, { ...CARD }]} mode="stills" segmentMs={1000} />);
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByTestId('tv-switch')).toBeTruthy();
  });

  test('a dead image unrenders and the words stay', () => {
    render(<CouchTv tv={OFF} items={[GSN, STILL]} mode="video" />);
    fireEvent.error(screen.getByTestId('tv-ad-key'));
    expect(screen.queryByTestId('tv-ad-key')).toBeNull();
    const item = screen.getByTestId('tv-ad').querySelector('img[src="/tv/ads/pick-a-slot.webp"]');
    fireEvent.error(item);
    expect(screen.getByTestId('tv-ad').querySelector('img[src="/tv/ads/pick-a-slot.webp"]')).toBeNull();
    expect(screen.getByTestId('tv-ad').textContent).toContain('Operators are standing by.');
  });

  test('Save-Data: a commercial is its still frame (one key image, nothing animated), loops are posters', () => {
    const onSegment = jest.fn();
    render(<CouchTv tv={OFF} items={[GSN, VIDEO]} mode="lite" onSegment={onSegment} />);
    const ad = screen.getByTestId('tv-ad');
    expect(ad.getAttribute('data-still')).toBe('true');
    expect(srcs(ad)).toEqual(['/gsn/operator-call.webp']);
    expect(ad.textContent).toContain('Operators are standing by.');
    expect(ad.textContent).not.toContain('Spend your tickets.');
    expect(screen.getByTestId('tv-ad-lower').textContent).toContain('goofer.tv/store');
    expect(classes(screen.getByTestId('couch-tv')).filter((c) => c.includes('animate'))).toEqual([]);
    // It still holds its slot (the TV door follows it), then cuts to the next.
    expect(onSegment).toHaveBeenLastCalledWith(GSN);
    act(() => jest.advanceTimersByTime(AD_MS));
    act(() => jest.advanceTimersByTime(STATIC_MS));
    expect(screen.queryByTestId('tv-ad')).toBeNull();
    expect(screen.queryByTestId('tv-video')).toBeNull();
    expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/v1.jpg');
  });

  test('a refused autoplay keeps the full commercial', () => {
    render(<CouchTv tv={OFF} items={[GSN, VIDEO]} mode="stills" />);
    const ad = screen.getByTestId('tv-ad');
    expect(ad.getAttribute('data-still')).toBeNull();
    expect(srcs(ad)).toContain('/tv/ads/gsn-ident.webp');
    expect(ad.textContent).toContain('Spend your tickets.');
  });

  test('every commercial has a still frame: key image, headline, lower-third', () => {
    const { rerender } = render(<CouchTv tv={OFF} items={[TAPES]} mode="lite" />);
    expect(srcs(screen.getByTestId('tv-ad'))).toEqual(['/gsn/video/clerk-restock.webp']);
    expect(screen.getByTestId('tv-ad').textContent).toContain('New tapes on the shelf.');
    expect(screen.getByTestId('tv-ad').textContent).not.toContain('Be kind, rewind.');
    expect(screen.getByTestId('tv-ad-lower').textContent).toContain('goofer.tv/vods');
    rerender(<CouchTv tv={OFF} items={[GUIDE]} mode="lite" />);
    expect(screen.getAllByTestId('tv-ad-listing')).toHaveLength(2);
    expect(screen.getByTestId('tv-ad-lower').textContent).toContain('goofer.tv/schedule');
    expect(classes(screen.getByTestId('couch-tv')).filter((c) => c.includes('animate'))).toEqual([]);
  });

  test('reduced motion with no picture holds the card, never a commercial', () => {
    const onSegment = jest.fn();
    render(<CouchTv tv={OFF} items={[GSN, CARD, TAPES]} mode="hold" onSegment={onSegment} />);
    expect(screen.queryByTestId('tv-ad')).toBeNull();
    expect(screen.getByTestId('tv-card').textContent).toContain('Back tomorrow.');
    expect(onSegment).toHaveBeenLastCalledWith(CARD);
    act(() => jest.advanceTimersByTime(AD_MS * 3));
    expect(screen.queryByTestId('tv-switch')).toBeNull();
    expect(screen.queryByTestId('tv-ad')).toBeNull();
  });

  test('reduced motion with a picture holds the picture, never a commercial', () => {
    const onSegment = jest.fn();
    render(<CouchTv tv={OFF} items={[GSN, STILL, CARD]} mode="hold" onSegment={onSegment} />);
    expect(screen.getByTestId('tv-still')).toBeTruthy();
    expect(screen.queryByTestId('tv-ad')).toBeNull();
    expect(onSegment).toHaveBeenLastCalledWith(STILL);
  });

  test('when the reel leaves the screen the TV reports nothing on', () => {
    const onSegment = jest.fn();
    const { rerender } = render(<CouchTv tv={OFF} items={[GSN, STILL]} mode="video" onSegment={onSegment} />);
    expect(onSegment).toHaveBeenLastCalledWith(GSN);
    rerender(<CouchTv tv={{ state: 'live', preview: null, viewers: 3, cards: [] }} items={[GSN, STILL]} mode="video" onSegment={onSegment} />);
    expect(onSegment).toHaveBeenLastCalledWith(null);
  });
});

test('a live preview that fails to load is dropped', () => {
  render(<CouchTv tv={{ state: 'live', preview: '/dead.jpg', viewers: 3, cards: [] }} items={[]} mode="video" />);
  fireEvent.error(screen.getByTestId('tv-live'));
  expect(screen.queryByTestId('tv-live')).toBeNull();
  expect(screen.getByText('Live · 3')).toBeTruthy();
});

describe('the segment clock', () => {
  test('loops replacing stills mid-segment (same length): the loop plays out, the stills clock is gone', () => {
    const { rerender } = render(<CouchTv tv={OFF} items={[STILL, CARD]} mode="video" segmentMs={1000} />);
    act(() => jest.advanceTimersByTime(500));
    rerender(<CouchTv tv={OFF} items={[VIDEO, CARD]} mode="video" segmentMs={1000} />);
    expect(screen.getByTestId('tv-video')).toBeTruthy();
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.queryByTestId('tv-switch')).toBeNull();
    fireEvent.ended(screen.getByTestId('tv-video'));
    expect(screen.getByTestId('tv-switch')).toBeTruthy();
    act(() => jest.advanceTimersByTime(STATIC_MS));
    expect(screen.getByTestId('tv-card')).toBeTruthy();
  });

  test('a new running order (a length change) starts over from its first segment, on a fresh clock', () => {
    const { rerender } = render(<CouchTv tv={OFF} items={[STILL, CARD]} mode="stills" segmentMs={1000} />);
    act(() => jest.advanceTimersByTime(500));
    const next = [{ ...STILL, id: 's2', src: '/b.jpg' }, CARD, STILL];
    rerender(<CouchTv tv={OFF} items={next} mode="stills" segmentMs={1000} />);
    expect(screen.getByTestId('tv-still').getAttribute('src')).toBe('/b.jpg');
    act(() => jest.advanceTimersByTime(999));
    expect(screen.queryByTestId('tv-switch')).toBeNull();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByTestId('tv-switch')).toBeTruthy();
    act(() => jest.advanceTimersByTime(STATIC_MS));
    expect(screen.getByTestId('tv-card')).toBeTruthy();
  });
});
