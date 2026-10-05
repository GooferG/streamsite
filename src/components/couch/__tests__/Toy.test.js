import { act, fireEvent, render, screen } from '@testing-library/react';
import RoomToys from '../RoomToys';
import Toy, { TOY_MS } from '../Toy';
import { roomToys } from '../themes';
import { LAYOUT } from '../couchLayout';

const LAMP = { id: 'lamp', effect: 'toggle', rect: [5, 10, 10, 30], art: { idle: '/lamp-on.webp', active: '/lamp-off.webp' } };
const PUMPKIN = { id: 'pumpkin', effect: 'light', rect: [60, 50, 6, 8], art: { idle: '/p.webp', active: '/p-lit.webp' } };
const CAN = { id: 'can', effect: 'fizz', rect: [70, 80, 3, 6], art: { idle: '/can.webp' } };
const CANDY = { id: 'candy', effect: 'scatter', rect: [33, 58, 5, 8], art: { idle: '/candy.webp' } };
const PAD = { id: 'controller', effect: 'wiggle', rect: [61, 79, 7, 5], art: { idle: '/pad.webp' } };
const NEON = { id: 'neon', effect: 'neon', rect: [40, 2, 20, 12], art: { idle: '/neon.webp', active: '/neon-off.webp' } };
const toyEl = (c, id) => c.querySelector(`[data-toy="${id}"]`);
const pic = (el) => el.querySelector('img').getAttribute('src');
const calmDown = () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  delete window.matchMedia;
});

test('a toy is decorative: hidden from screen readers and out of the tab order', () => {
  const { container } = render(<Toy toy={LAMP} />);
  const el = toyEl(container, 'lamp');
  expect(el.getAttribute('aria-hidden')).toBe('true');
  expect(el.getAttribute('tabindex')).toBeNull();
  expect(container.querySelector('button, a')).toBeNull();
});

test('a toy answers a click, never a bare press, so a scroll that starts on it pokes nothing', () => {
  const toy = { ...NEON, rect: [10, 10, 40, 40], hit: [20, 20, 20, 10] };
  const { container } = render(
    <>
      <Toy toy={LAMP} />
      <Toy toy={toy} />
    </>
  );
  fireEvent.pointerDown(toyEl(container, 'lamp'));
  fireEvent.pointerDown(screen.getByTestId('toy-hit-neon'));
  expect(toyEl(container, 'lamp').getAttribute('data-on')).toBe('false');
  expect(toyEl(container, 'neon').getAttribute('data-on')).toBe('false');
  fireEvent.click(toyEl(container, 'lamp'));
  expect(toyEl(container, 'lamp').getAttribute('data-on')).toBe('true');
});

test('the lamp toggles between its two pictures', () => {
  const { container } = render(<Toy toy={LAMP} />);
  const el = toyEl(container, 'lamp');
  fireEvent.click(el);
  expect(pic(el)).toBe('/lamp-off.webp');
  fireEvent.click(el);
  expect(pic(el)).toBe('/lamp-on.webp');
});

test('the pumpkin lights up, then dies down', () => {
  const { container } = render(<Toy toy={PUMPKIN} />);
  const el = toyEl(container, 'pumpkin');
  fireEvent.click(el);
  expect(el.getAttribute('data-on')).toBe('true');
  expect(pic(el)).toBe('/p-lit.webp');
  act(() => jest.advanceTimersByTime(TOY_MS.light));
  expect(el.getAttribute('data-on')).toBe('false');
  expect(pic(el)).toBe('/p.webp');
});

test('under reduced motion a toy still switches its art, holds for its time, then resets', () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  const { container } = render(
    <>
      <Toy toy={PUMPKIN} />
      <Toy toy={CAN} />
    </>
  );
  fireEvent.click(toyEl(container, 'pumpkin'));
  fireEvent.click(toyEl(container, 'can'));
  act(() => jest.advanceTimersByTime(TOY_MS.fizz - 1));
  expect(toyEl(container, 'pumpkin').getAttribute('data-on')).toBe('true');
  expect(toyEl(container, 'can').getAttribute('data-on')).toBe('true');
  act(() => jest.advanceTimersByTime(1));
  expect(toyEl(container, 'can').getAttribute('data-on')).toBe('false');
  expect(toyEl(container, 'pumpkin').getAttribute('data-on')).toBe('true');
});

test('unmounting a toy mid-effect clears its timer', () => {
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { container, unmount } = render(<Toy toy={PUMPKIN} />);
  fireEvent.click(toyEl(container, 'pumpkin'));
  expect(jest.getTimerCount()).toBe(1);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  act(() => jest.advanceTimersByTime(TOY_MS.light));
  expect(err).not.toHaveBeenCalled();
  err.mockRestore();
});

describe('the can', () => {
  test('shakes, then foam geysers out of the top and droplets fly off, all gone after TOY_MS.fizz', () => {
    const { container } = render(<Toy toy={CAN} />);
    const el = toyEl(container, 'can');
    expect(screen.queryByTestId('toy-fizz')).toBeNull();
    fireEvent.click(el);
    expect(el.firstChild.className).toContain('animate-couch-shake');
    const foam = screen.getAllByTestId('fizz-foam');
    expect(foam.length).toBeGreaterThanOrEqual(6);
    expect(foam.length).toBeLessThanOrEqual(10);
    const drops = screen.getAllByTestId('fizz-drop');
    expect(drops.length).toBeGreaterThanOrEqual(3);
    expect(drops.length).toBeLessThanOrEqual(4);
    expect(foam[0].className).toContain('animate-couch-foam');
    expect(screen.getByTestId('fizz-cap').className).toContain('animate-couch-foam-cap');
    act(() => jest.advanceTimersByTime(TOY_MS.fizz - 1));
    expect(screen.getByTestId('toy-fizz')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByTestId('toy-fizz')).toBeNull();
    expect(el.firstChild.className).not.toContain('animate-couch-shake');
  });

  test('a poke mid-fizz starts it over', () => {
    const { container } = render(<Toy toy={CAN} />);
    const el = toyEl(container, 'can');
    fireEvent.click(el);
    act(() => jest.advanceTimersByTime(1000));
    const first = screen.getByTestId('toy-fizz');
    fireEvent.click(el);
    expect(screen.getByTestId('toy-fizz')).not.toBe(first);
    act(() => jest.advanceTimersByTime(TOY_MS.fizz - 1));
    expect(screen.getByTestId('toy-fizz')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByTestId('toy-fizz')).toBeNull();
  });

  test('under reduced motion a still foam cap sits on the can for TOY_MS.fizz, then goes', () => {
    calmDown();
    const { container } = render(<Toy toy={CAN} />);
    fireEvent.click(toyEl(container, 'can'));
    expect(screen.getByTestId('fizz-cap')).toBeTruthy();
    expect(screen.queryAllByTestId('fizz-foam')).toHaveLength(0);
    expect(screen.queryAllByTestId('fizz-drop')).toHaveLength(0);
    expect(container.innerHTML).not.toContain('animate-');
    act(() => jest.advanceTimersByTime(TOY_MS.fizz - 1));
    expect(screen.getByTestId('fizz-cap')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByTestId('toy-fizz')).toBeNull();
  });
});

describe('the candy bowl', () => {
  const side = (c) => Math.sign(parseFloat(c.style.getPropertyValue('--dx')));

  test('wrapped sweets and drops hop out to both sides and back, all gone after TOY_MS.scatter', () => {
    const { container } = render(<Toy toy={CANDY} />);
    expect(screen.queryAllByTestId('toy-candy')).toHaveLength(0);
    fireEvent.click(toyEl(container, 'candy'));
    const candies = screen.getAllByTestId('toy-candy');
    expect(candies.length).toBeGreaterThanOrEqual(4);
    expect(candies.length).toBeLessThanOrEqual(6);
    expect(new Set(candies.map((c) => c.getAttribute('data-kind')))).toEqual(new Set(['wrapped', 'drop']));
    expect(new Set(candies.map(side))).toEqual(new Set([-1, 1]));
    candies.forEach((c) => expect(c.className).toContain('animate-couch-hop-x'));
    act(() => jest.advanceTimersByTime(TOY_MS.scatter - 1));
    expect(screen.getAllByTestId('toy-candy')).toHaveLength(candies.length);
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryAllByTestId('toy-candy')).toHaveLength(0);
  });

  test('a poke mid-hop starts it over', () => {
    const { container } = render(<Toy toy={CANDY} />);
    const el = toyEl(container, 'candy');
    fireEvent.click(el);
    act(() => jest.advanceTimersByTime(1200));
    const first = screen.getAllByTestId('toy-candy')[0];
    fireEvent.click(el);
    expect(screen.getAllByTestId('toy-candy')[0]).not.toBe(first);
    act(() => jest.advanceTimersByTime(TOY_MS.scatter - 1));
    expect(screen.getAllByTestId('toy-candy').length).toBeGreaterThan(0);
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryAllByTestId('toy-candy')).toHaveLength(0);
  });

  test('under reduced motion the candies rest beside the bowl for TOY_MS.scatter, then go', () => {
    calmDown();
    const { container } = render(<Toy toy={CANDY} />);
    fireEvent.click(toyEl(container, 'candy'));
    const candies = screen.getAllByTestId('toy-candy');
    expect(candies.length).toBeGreaterThanOrEqual(4);
    candies.forEach((c) => expect(c.style.transform).toMatch(/^translateX\(-?\d/));
    expect(container.innerHTML).not.toContain('animate-');
    act(() => jest.advanceTimersByTime(TOY_MS.scatter));
    expect(screen.queryAllByTestId('toy-candy')).toHaveLength(0);
  });
});

test('unmounting the can or the bowl mid-effect clears their timers', () => {
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { container, unmount } = render(
    <>
      <Toy toy={CAN} />
      <Toy toy={CANDY} />
    </>
  );
  fireEvent.click(toyEl(container, 'can'));
  fireEvent.click(toyEl(container, 'candy'));
  expect(jest.getTimerCount()).toBe(2);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  act(() => jest.advanceTimersByTime(TOY_MS.scatter));
  expect(err).not.toHaveBeenCalled();
  err.mockRestore();
});

describe('the controller', () => {
  test('rumble marks flash on both sides while it wiggles', () => {
    const { container } = render(<Toy toy={PAD} />);
    const el = toyEl(container, 'controller');
    expect(screen.queryAllByTestId('toy-rumble')).toHaveLength(0);
    fireEvent.click(el);
    expect(el.firstChild.className).toContain('animate-couch-wiggle');
    const marks = screen.getAllByTestId('toy-rumble');
    expect(marks.map((m) => m.getAttribute('data-side')).sort()).toEqual(['left', 'right']);
    marks.forEach((m) => expect(m.className).toContain('animate-couch-rumble'));
    act(() => jest.advanceTimersByTime(TOY_MS.wiggle));
    expect(screen.queryAllByTestId('toy-rumble')).toHaveLength(0);
  });

  test('under reduced motion it draws no rumble marks', () => {
    calmDown();
    const { container } = render(<Toy toy={PAD} />);
    const el = toyEl(container, 'controller');
    fireEvent.click(el);
    expect(el.getAttribute('data-on')).toBe('true');
    expect(screen.queryAllByTestId('toy-rumble')).toHaveLength(0);
    expect(container.innerHTML).not.toContain('animate-');
  });
});

test('the room fizzes its can and scatters its candy, and every toy effect is one Toy knows', () => {
  const all = [...LAYOUT.toys, ...Object.values(LAYOUT.themes).flatMap((t) => t.toys || [])];
  const effect = Object.fromEntries(all.map((t) => [t.id, t.effect]));
  expect(effect.can).toBe('fizz');
  expect(effect.candy).toBe('scatter');
  all.forEach((t) => expect(t.effect === 'toggle' || TOY_MS[t.effect] > 0).toBe(true));
});

test('roomToys adds the theme toys to the room toys', () => {
  const layout = { toys: [LAMP], themes: { halloween: { toys: [PUMPKIN] } } };
  expect(roomToys(layout, 'halloween').map((t) => t.id)).toEqual(['lamp', 'pumpkin']);
  expect(roomToys(layout, null).map((t) => t.id)).toEqual(['lamp']);
  expect(roomToys({}, null)).toEqual([]);
});

test('RoomToys renders nothing without toys', () => {
  const { container } = render(<RoomToys toys={[]} />);
  expect(container.innerHTML).toBe('');
});

const layers = (el) => [...el.querySelectorAll('img')].map((i) => i.getAttribute('src'));
const lit = (el) => el.querySelector('img[src="/neon.webp"]');

describe('the neon sign', () => {
  test('draws the off art underneath and the lit art on top, and flickers on at mount', () => {
    const { container } = render(<Toy toy={NEON} />);
    const el = toyEl(container, 'neon');
    expect(layers(el)).toEqual(['/neon-off.webp', '/neon.webp']);
    expect(lit(el).className).toContain('animate-couch-neon-on');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  test('settles into its hum once the flicker is done', () => {
    const { container } = render(<Toy toy={NEON} />);
    const el = toyEl(container, 'neon');
    act(() => jest.advanceTimersByTime(1200));
    expect(lit(el).className).toContain('animate-couch-neon-hum');
    expect(lit(el).className).not.toContain('animate-couch-neon-on');
  });

  test('a poke flicks it off, then it flickers back on after TOY_MS.neon', () => {
    const { container } = render(<Toy toy={NEON} />);
    const el = toyEl(container, 'neon');
    act(() => jest.advanceTimersByTime(1200));
    fireEvent.click(el);
    expect(el.getAttribute('data-on')).toBe('true');
    expect(lit(el).className).toContain('animate-couch-neon-off');
    act(() => jest.advanceTimersByTime(TOY_MS.neon - 1));
    expect(lit(el).className).toContain('animate-couch-neon-off');
    act(() => jest.advanceTimersByTime(1));
    expect(el.getAttribute('data-on')).toBe('false');
    expect(lit(el).className).toContain('animate-couch-neon-on');
    act(() => jest.advanceTimersByTime(1200));
    expect(lit(el).className).toContain('animate-couch-neon-hum');
  });

  test('a poke during the flicker restarts it', () => {
    const { container } = render(<Toy toy={NEON} />);
    const el = toyEl(container, 'neon');
    act(() => jest.advanceTimersByTime(500));
    fireEvent.click(el);
    expect(lit(el).className).toContain('animate-couch-neon-off');
    act(() => jest.advanceTimersByTime(TOY_MS.neon));
    expect(lit(el).className).toContain('animate-couch-neon-on');
    act(() => jest.advanceTimersByTime(700));
    expect(lit(el).className).toContain('animate-couch-neon-on');
  });

  test('the lit layer stays mounted through a poke; a poke during the flick off replays it in place', () => {
    const reflow = jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get');
    try {
      const { container } = render(<Toy toy={NEON} />);
      const el = toyEl(container, 'neon');
      const layer = lit(el);
      const under = el.querySelector('img[src="/neon-off.webp"]');
      act(() => jest.advanceTimersByTime(1200));
      fireEvent.click(el);
      expect(lit(el)).toBe(layer);
      expect(el.querySelector('img[src="/neon-off.webp"]')).toBe(under);
      expect(layer.className).toContain('animate-couch-neon-off');
      // A new phase swaps the class, which starts its animation: no reflow needed.
      expect(reflow).not.toHaveBeenCalled();
      act(() => jest.advanceTimersByTime(300));
      fireEvent.click(el);
      expect(lit(el)).toBe(layer);
      expect(layer.className).toContain('animate-couch-neon-off');
      expect(reflow).toHaveBeenCalledTimes(1);
      expect(layer.style.animationName).toBe('');
      act(() => jest.advanceTimersByTime(TOY_MS.neon));
      expect(lit(el)).toBe(layer);
      expect(layer.className).toContain('animate-couch-neon-on');
    } finally {
      reflow.mockRestore();
    }
  });

  test('the hum and the window stars step (about 12 frames a second) instead of drawing every frame', () => {
    const { animation } = require('../../../../tailwind.config.js').theme.extend;
    expect(animation['couch-neon-hum']).toBe('couch-neon-hum 5.2s steps(12) infinite');
    expect(animation['couch-twinkle']).toBe('couch-twinkle 3.2s steps(20) infinite');
  });

  test('unmounting clears every timer', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { container, unmount } = render(<Toy toy={NEON} />);
    fireEvent.click(toyEl(container, 'neon'));
    unmount();
    expect(jest.getTimerCount()).toBe(0);
    act(() => jest.advanceTimersByTime(5000));
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });

  test('under reduced motion it is simply lit, and a poke swaps the art without stutter', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    const { container } = render(<Toy toy={NEON} />);
    const el = toyEl(container, 'neon');
    expect(container.innerHTML).not.toContain('animate-couch-neon');
    expect(layers(el)).toEqual(['/neon.webp']);
    fireEvent.click(el);
    expect(layers(el)).toEqual(['/neon-off.webp']);
    expect(container.innerHTML).not.toContain('animate-couch-neon');
    act(() => jest.advanceTimersByTime(TOY_MS.neon));
    expect(layers(el)).toEqual(['/neon.webp']);
  });
});

test('a toy with a hit area pokes only from that area, and its art ignores the pointer', () => {
  const toy = { ...NEON, rect: [10, 10, 40, 40], hit: [20, 20, 20, 10] };
  const { container } = render(<Toy toy={toy} />);
  const el = toyEl(container, 'neon');
  fireEvent.click(el);
  expect(el.getAttribute('data-on')).toBe('false');
  expect(el.className).toContain('pointer-events-none');
  expect(el.querySelector('img').className).toContain('pointer-events-none');
  const hit = screen.getByTestId('toy-hit-neon');
  expect(hit.style.left).toBe('25%');
  expect(hit.style.top).toBe('25%');
  expect(hit.style.width).toBe('50%');
  expect(hit.style.height).toBe('25%');
  fireEvent.click(hit);
  expect(el.getAttribute('data-on')).toBe('true');
});
