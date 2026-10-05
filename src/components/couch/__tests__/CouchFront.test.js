import { fireEvent, render, screen, within as inside } from '@testing-library/react';
import CouchFront from '../CouchFront';
import { buildCouch } from '../couchModel';
import { COUCH_FIXTURES as F } from '../couchFixtures';
import useCouchStage from '../useCouchStage';
import { ART_ASPECT, LAYOUT } from '../couchLayout';

jest.mock('../../../routes/loaders', () => ({ prefetchRoute: () => Promise.resolve() }));
beforeEach(() => {
  HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
});

function Room({ fixture = 'offair', onDoor = () => {} }) {
  const stage = useCouchStage(ART_ASPECT, LAYOUT.art.focal);
  const couch = buildCouch(F[fixture].input);
  return <CouchFront couch={couch} items={[]} mode="stills" onDoor={onDoor} stage={stage} roomLayout />;
}
const doorList = () => screen.getByRole('list', { name: 'Things in the room' });

test('the room is an ordered list of real links, in door order', () => {
  render(<Room />);
  const links = inside(doorList()).getAllByRole('link');
  expect(links.map((a) => a.getAttribute('href'))).toEqual(['/vods', '/gamba', '/vods', '/schedule', '/gaming', '/store', '/about']);
  expect(links[0].getAttribute('aria-label')).toBe('TV: Off the air. Back tomorrow at 11:00 AM for Bonus Hunt Time! Opens Vods.');
});

test('a plain click hands the door to onDoor; a ctrl-click stays native', () => {
  const onDoor = jest.fn();
  render(<Room onDoor={onDoor} />);
  const guide = screen.getByRole('link', { name: /^TV guide:/ });
  fireEvent.click(guide, { button: 0, ctrlKey: true });
  expect(onDoor).not.toHaveBeenCalled();
  fireEvent.click(guide, { button: 0 });
  expect(onDoor.mock.calls[0][0].id).toBe('guide');
  expect(onDoor.mock.calls[0][1]).toBe(guide);
});

test('labels show the teaser; the plate and screens render', () => {
  render(<Room />);
  expect(screen.getByText('Back tomorrow 11:00 AM')).toBeTruthy();
  // The room draws the empty plate under the cut-outs (the outside's skyline comes first).
  expect(screen.getByTestId('couch-stage').querySelector('img[srcset]').getAttribute('src')).toBe('/couch/90s/empty-1920.webp');
  expect(screen.getByTestId('couch-tv')).toBeTruthy();
  expect(screen.getByTestId('laptop-screen')).toBeTruthy();
});

test('live: the TV light is on and the TV door goes to the stream', () => {
  render(<Room fixture="live" />);
  expect(screen.getByTestId('couch-glow')).toBeTruthy();
  expect(screen.getByRole('link', { name: /^TV:/ }).getAttribute('href')).toBe('https://twitch.tv/GooferG');
});

test('off air the room casts no light', () => {
  render(<Room />);
  expect(screen.queryByTestId('couch-glow')).toBeNull();
});

test('an open giveaway puts the handwritten note on the TV', () => {
  render(<Room fixture="giveaway" />);
  const note = screen.getByRole('link', { name: /^Note:/ });
  expect(note.textContent).toContain('!goof');
  expect(note.getAttribute('href')).toBe('/giveaway');
});

test('a new tape wears a sticker', () => {
  render(<Room />);
  expect(inside(screen.getByRole('link', { name: /^Tapes:/ })).getByText('New')).toBeTruthy();
});

test('the doors layer lets pokes through to toys and the window; each door still takes its own', () => {
  render(<Room />);
  expect(doorList().className).toContain('pointer-events-none');
  for (const li of doorList().children) expect(li.className).toContain('pointer-events-auto');
});

test('layers: the night is behind the plate, the window hit areas are behind the doors', () => {
  render(<Room />);
  const kids = Array.from(screen.getByTestId('couch-stage').children);
  const at = (el) => kids.findIndex((k) => k === el || k.contains(el));
  const plate = kids.findIndex((k) => k.tagName === 'IMG');
  const outside = at(screen.getByTestId('window-outside'));
  const sky = at(screen.getByTestId('couch-stage').querySelector('[data-toy="sky"]'));
  const doors = at(doorList());
  expect(outside).toBeGreaterThanOrEqual(0);
  expect(outside).toBeLessThan(plate);
  expect(sky).toBeGreaterThan(plate);
  expect(sky).toBeLessThan(doors);
});

test('theme dressing paints over the toys and the window, under the doors', () => {
  LAYOUT.themes = { halloween: { dressing: [{ id: 'cobweb', src: '/c.webp', rect: [1, 1, 5, 5] }] } };
  try {
    const { container } = render(<Room fixture="halloween" />);
    const web = container.querySelector('[data-dressing="cobweb"]');
    const blinds = screen.getByTestId('window-blinds');
    const door = container.querySelector('[data-door]');
    const follows = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(blinds, web)).toBe(true);
    expect(follows(container.querySelector('[data-toy="moon"]'), web)).toBe(true);
    expect(follows(web, door)).toBe(true);
  } finally {
    LAYOUT.themes = {};
  }
});

describe('labels never stack', () => {
  const realRect = Element.prototype.getBoundingClientRect;
  afterEach(() => {
    Element.prototype.getBoundingClientRect = realRect;
  });
  // Two labels drawn on top of each other at rest; a nudge moves them like it would in a browser.
  const rest = { tapes: [300, 200], guide: [320, 205] };
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
  function mockRects() {
    Element.prototype.getBoundingClientRect = function mocked() {
      const id = this.getAttribute && this.getAttribute('data-label');
      if (id && rest[id]) {
        const [x, y] = rest[id];
        return rect(x + (parseFloat(this.style.marginLeft) || 0), y + (parseFloat(this.style.marginTop) || 0), 140, 30);
      }
      if (this.getAttribute && this.getAttribute('role') === 'list') return rect(0, 0, 1000, 600);
      if (this.getAttribute && this.getAttribute('data-door')) return rect(0, 0, 200, 100);
      return rect(0, 0, 0, 0);
    };
  }
  const placed = (id) => {
    const el = document.querySelector(`[data-label="${id}"]`);
    const [x, y] = rest[id];
    return { x: x + (parseFloat(el.style.marginLeft) || 0), y: y + (parseFloat(el.style.marginTop) || 0), w: 140, h: 30 };
  };

  test('overlapping resting labels are moved apart, with a gap', () => {
    mockRects();
    render(<Room />);
    const a = placed('tapes');
    const b = placed('guide');
    const apart = a.x + a.w + 4 <= b.x || b.x + b.w + 4 <= a.x || a.y + a.h + 4 <= b.y || b.y + b.h + 4 <= a.y;
    expect(apart).toBe(true);
    // Hit areas and names are untouched.
    expect(screen.getByRole('link', { name: /^TV guide:/ })).toBeTruthy();
    expect(document.querySelector('[data-label="guide"]').getAttribute('aria-hidden')).toBe('true');
  });

  test('labels that do not touch are not moved', () => {
    mockRects();
    rest.guide = [700, 400];
    render(<Room />);
    expect(placed('tapes')).toMatchObject({ x: 300, y: 200 });
    expect(placed('guide')).toMatchObject({ x: 700, y: 400 });
    rest.guide = [320, 205];
  });
});

test('the room runs full height when there is no bar above it (home)', () => {
  function Home() {
    const stage = useCouchStage(ART_ASPECT, LAYOUT.art.focal, 0);
    return <CouchFront couch={buildCouch(F.offair.input)} items={[]} mode="stills" onDoor={() => {}} stage={stage} roomLayout />;
  }
  render(<Home />);
  const section = screen.getByRole('region', { name: "Goofer's couch" });
  expect(section.style.marginTop).toBe('0px');
  expect(section.firstChild.style.height).toBe('calc(100svh - 0px)');
  expect(section.outerHTML).not.toContain('57px');
});

test('with a bar the room sits under it', () => {
  render(<Room />);
  const section = screen.getByRole('region', { name: "Goofer's couch" });
  expect(section.style.marginTop).toBe('57px');
  expect(section.firstChild.style.height).toBe('calc(100svh - 57px)');
});
