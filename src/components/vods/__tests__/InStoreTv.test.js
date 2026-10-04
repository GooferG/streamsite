import { act, fireEvent, render, screen, within } from '@testing-library/react';
import InStoreTv, { SPOT_MS } from '../InStoreTv';
import { buildStore, promoSpots } from '../videoStoreModel';
import { VIDEO_STORE_FIXTURES as F } from '../videoStoreFixtures';

const SPOTS = promoSpots(buildStore(F.rich));
const LIVE_SPOTS = promoSpots(buildStore(F.rich), {
  isLive: true,
  stream: { title: 'Hunt night', game_name: 'Slots', viewer_count: 42, thumbnail_url: 'https://x/live-{width}x{height}.jpg' },
});

const tv = () => within(screen.getByRole('region', { name: 'In-store TV' }));
const title = () => screen.getByTestId('spot-title').textContent;
const tick = (n = 1) => {
  for (let k = 0; k < n; k += 1) act(() => jest.advanceTimersByTime(SPOT_MS));
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('the reel opens on the newest tape', () => {
  render(<InStoreTv spots={SPOTS} onOpen={() => {}} />);
  expect(title()).toBe('Win Wednesdays');
  expect(tv().getByText('Now on tape')).toBeTruthy();
  expect(tv().getByText('Spot 1 of 5')).toBeTruthy();
  expect(tv().getByText('Thu, Oct 1 · 4:37:20 · T-120 · EP')).toBeTruthy();
  expect(tv().getByRole('marquee', { name: 'Store ticker' })).toBeTruthy();
});

test('it cuts to the next spot every few seconds and wraps', () => {
  render(<InStoreTv spots={SPOTS} onOpen={() => {}} />);
  tick();
  expect(title()).toBe('Leprecher max ARS');
  expect(tv().getByText('Spot 2 of 5')).toBeTruthy();
  tick(4);
  expect(title()).toBe('Win Wednesdays');
});

test('pause holds the spot, play resumes', () => {
  render(<InStoreTv spots={SPOTS} onOpen={() => {}} />);
  fireEvent.click(tv().getByRole('button', { name: 'Pause the reel' }));
  tick(2);
  expect(title()).toBe('Win Wednesdays');
  fireEvent.click(tv().getByRole('button', { name: 'Play the reel' }));
  tick();
  expect(title()).toBe('Leprecher max ARS');
});

test('previous and next step through the reel and wrap', () => {
  render(<InStoreTv spots={SPOTS} onOpen={() => {}} />);
  fireEvent.click(tv().getByRole('button', { name: 'Previous spot' }));
  expect(title()).toBe('What just happened');
  expect(tv().getByText('Staff pick · 2018')).toBeTruthy();
  fireEvent.click(tv().getByRole('button', { name: 'Next spot' }));
  expect(title()).toBe('Win Wednesdays');
});

test('hovering or focusing the TV holds the spot', () => {
  render(<InStoreTv spots={SPOTS} onOpen={() => {}} />);
  const box = screen.getByTestId('in-store-tv');
  fireEvent.mouseEnter(box);
  tick();
  expect(title()).toBe('Win Wednesdays');
  fireEvent.mouseLeave(box);
  tick();
  expect(title()).toBe('Leprecher max ARS');
  act(() => tv().getByRole('button', { name: 'Next spot' }).focus());
  tick();
  expect(title()).toBe('Leprecher max ARS');
  act(() => tv().getByRole('button', { name: 'Next spot' }).blur());
  tick();
  expect(title()).toBe('5 scat? pants off');
});

test('a hidden tab or an open counter holds the reel', () => {
  const { rerender } = render(<InStoreTv spots={SPOTS} onOpen={() => {}} />);
  const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  tick();
  expect(title()).toBe('Win Wednesdays');
  hidden.mockReturnValue(false);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  rerender(<InStoreTv spots={SPOTS} onOpen={() => {}} held />);
  tick();
  expect(title()).toBe('Win Wednesdays');
  rerender(<InStoreTv spots={SPOTS} onOpen={() => {}} />);
  tick();
  expect(title()).toBe('Leprecher max ARS');
  hidden.mockRestore();
});

test('under reduced motion the reel only moves when asked', () => {
  const original = window.matchMedia;
  window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} });
  try {
    render(<InStoreTv spots={SPOTS} onOpen={() => {}} />);
    tick(2);
    expect(title()).toBe('Win Wednesdays');
    expect(tv().queryByRole('button', { name: 'Pause the reel' })).toBeNull();
    fireEvent.click(tv().getByRole('button', { name: 'Next spot' }));
    expect(title()).toBe('Leprecher max ARS');
  } finally {
    window.matchMedia = original;
  }
});

test('the reel speaks up only when it is not moving on its own', () => {
  render(<InStoreTv spots={SPOTS} onOpen={() => {}} />);
  expect(screen.getByTestId('spot').getAttribute('aria-live')).toBe('off');
  fireEvent.click(tv().getByRole('button', { name: 'Pause the reel' }));
  expect(screen.getByTestId('spot').getAttribute('aria-live')).toBe('polite');
});

test('Rent it opens the tape on the counter', () => {
  const onOpen = jest.fn();
  render(<InStoreTv spots={SPOTS} onOpen={onOpen} />);
  fireEvent.click(tv().getByRole('button', { name: 'Rent it: Win Wednesdays' }));
  expect(onOpen).toHaveBeenCalledWith('2889109731');
});

test('a clip spot credits the clipper, and you', () => {
  render(<InStoreTv spots={SPOTS} viewerName="GooferG" onOpen={() => {}} />);
  fireEvent.click(tv().getByRole('button', { name: 'Next spot' }));
  expect(tv().getByText('Picked by you · 1:00 · 45 views')).toBeTruthy();
});

test('while live, the stream leads with the LIVE light and a link to watch', () => {
  render(<InStoreTv spots={LIVE_SPOTS} onOpen={() => {}} />);
  expect(title()).toBe('Hunt night');
  expect(tv().getByText('Live')).toBeTruthy();
  expect(tv().getByText('Slots · 42 watching')).toBeTruthy();
  expect(tv().getByRole('link', { name: 'Watch now' }).getAttribute('href')).toBe('/');
  expect(tv().getByText('Spot 1 of 6')).toBeTruthy();
});

test('one spot needs no controls', () => {
  render(<InStoreTv spots={SPOTS.slice(0, 1)} onOpen={() => {}} />);
  expect(tv().queryByRole('button', { name: 'Next spot' })).toBeNull();
  expect(tv().queryByRole('button', { name: 'Pause the reel' })).toBeNull();
});

test('while loading the TV tunes in', () => {
  render(<InStoreTv loading spots={[]} onOpen={() => {}} />);
  expect(tv().getByText('Tuning in…')).toBeTruthy();
  expect(screen.queryByTestId('spot-title')).toBeNull();
});

test('no spots and not loading: no TV', () => {
  const { container } = render(<InStoreTv spots={[]} onOpen={() => {}} />);
  expect(container.innerHTML).toBe('');
});
