import { render, screen } from '@testing-library/react';
import TvCrop from '../TvCrop';
import CouchFront from '../CouchFront';
import Dressing from '../Dressing';
import LaptopScreen from '../LaptopScreen';
import { buildCouch } from '../couchModel';
import { COUCH_FIXTURES as F } from '../couchFixtures';
import { ART_ASPECT, LAYOUT } from '../couchLayout';
import { THEMES, themeArt, themeFor } from '../themes';
import useCouchStage from '../useCouchStage';
import { toCouchInput } from '../useCouchData';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));
jest.mock('../../../config/firebase', () => ({ db: {}, auth: {} }));

jest.mock('../rooms/90s.json', () => ({ ...jest.requireActual('../rooms/90s.json'), themes: {} }));

const at = (iso) => Date.parse(iso);

test('Halloween runs through October on the Arizona calendar', () => {
  expect(themeFor(at('2026-10-15T12:00:00Z'))).toBe('halloween');
  expect(themeFor(at('2026-11-01T06:00:00Z'))).toBe('halloween'); // Oct 31, 11 PM in Arizona
  expect(themeFor(at('2026-11-01T08:00:00Z'))).toBeNull(); // Nov 1, 1 AM in Arizona
  expect(themeFor(at('2026-09-30T12:00:00Z'))).toBeNull();
});

test('an override previews a theme or switches it off', () => {
  expect(themeFor(at('2026-03-01T12:00:00Z'), 'halloween')).toBe('halloween');
  expect(themeFor(at('2026-10-15T12:00:00Z'), 'none')).toBeNull();
  expect(themeFor(at('2026-10-15T12:00:00Z'), 'nope')).toBe('halloween');
});

test('themeArt reads a theme from a room layout', () => {
  const layout = { themes: { halloween: { dressing: [] } } };
  expect(themeArt(layout, 'halloween')).toEqual({ dressing: [] });
  expect(themeArt(layout, null)).toBeNull();
  expect(themeArt({}, 'halloween')).toBeNull();
});

test('a theme leads the TV reel with its card and travels on the couch', () => {
  const c = buildCouch(F.halloween.input);
  expect(c.theme).toBe('halloween');
  expect(c.tv.cards[0]).toEqual(THEMES.halloween.cards[0]);
  expect(c.tv.cards).toHaveLength(4);
  expect(buildCouch(F.offair.input).theme).toBeNull();
});

test('toCouchInput carries the theme', () => {
  const base = { schedule: { schedule: [], loading: false }, round: { round: null }, leaderboard: {}, hunts: {} };
  expect(toCouchInput({ ...base, theme: 'halloween' }).theme).toBe('halloween');
  expect(toCouchInput(base).theme).toBeNull();
});

test('dressing layers are decorative and placed in percent, inside a frame when given', () => {
  const { container } = render(<Dressing layers={[{ id: 'cobweb', src: '/c.webp', rect: [10, 20, 30, 40] }]} frame={[0, 0, 50, 50]} />);
  const img = container.querySelector('img[data-dressing="cobweb"]');
  expect(img.getAttribute('aria-hidden')).toBe('true');
  expect(img.className).toMatch(/pointer-events-none/);
  expect(img.style.left).toBe('20%');
  expect(img.style.width).toBe('60%');
});

test('no layers, no dressing', () => {
  const { container } = render(<Dressing layers={null} />);
  expect(container.innerHTML).toBe('');
});

test('the laptop screensaver shows the theme bug', () => {
  render(<LaptopScreen laptop={{ mode: 'idle', resetsIn: null, last: null }} bug="/couch/90s/halloween/bug.webp" />);
  expect(screen.getByTestId('laptop-screen').querySelector('img').getAttribute('src')).toBe('/couch/90s/halloween/bug.webp');
  expect(screen.queryByText('GG')).toBeNull();
});

test('the laptop keeps its GG mark without a bug', () => {
  render(<LaptopScreen laptop={{ mode: 'idle', resetsIn: null, last: null }} bug={undefined} />);
  expect(screen.getByText('GG')).toBeTruthy();
});

function Room({ phone = false }) {
  const stage = useCouchStage(ART_ASPECT, LAYOUT.art.focal);
  const couch = buildCouch(F.halloween.input);
  return <CouchFront couch={couch} items={[]} mode="stills" onDoor={() => {}} stage={stage} roomLayout={!phone} />;
}

test('a theme on with no art in the layout renders no dressing and does not crash', () => {
  const room = render(<Room />);
  expect(room.container.querySelector('[data-dressing]')).toBeNull();
  expect(screen.getByTestId('laptop-screen').querySelector('img')).toBeNull();
  room.unmount();
  const phone = render(<Room phone />);
  expect(phone.container.querySelector('[data-dressing]')).toBeNull();
});

test('inherited object keys are not themes', () => {
  expect(themeFor(at('2026-10-15T12:00:00Z'), 'constructor')).toBe('halloween');
  expect(themeFor(at('2026-03-01T12:00:00Z'), '__proto__')).toBeNull();
  expect(() => buildCouch({ ...F.offair.input, theme: '__proto__' })).not.toThrow();
  expect(buildCouch({ ...F.offair.input, theme: '__proto__' }).theme).toBeNull();
  expect(themeArt(LAYOUT, 'constructor')).toBeNull();
  expect(themeArt({ themes: { halloween: {} } }, 'toString')).toBeNull();
  expect(themeArt({ themes: {} }, 'halloween')).toBeNull();
});

test('the phone crop renders only dressing that falls inside it', () => {
  const [x, y, w, h] = LAYOUT.phoneCrop;
  const inside = { id: 'in', src: '/in.webp', rect: [x + w / 4, y + h / 4, w / 4, h / 4] };
  const outside = { id: 'out', src: '/out.webp', rect: [x + w + 1, y + h + 1, 5, 5] };
  LAYOUT.themes = { halloween: { dressing: [inside, outside] } };
  try {
    const couch = buildCouch(F.halloween.input);
    const tv = couch.doors.find((d) => d.id === 'tv');
    const { container } = render(<TvCrop door={tv} tv={couch.tv} items={[]} mode="stills" onDoor={() => {}} theme="halloween" />);
    expect(container.querySelector('[data-dressing="in"]')).toBeTruthy();
    expect(container.querySelector('[data-dressing="out"]')).toBeNull();
  } finally {
    LAYOUT.themes = {};
  }
});
