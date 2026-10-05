import { act, fireEvent, render, screen } from '@testing-library/react';
import RoomToys from '../RoomToys';
import Toy, { TOY_MS } from '../Toy';
import { roomToys } from '../themes';

const LAMP = { id: 'lamp', effect: 'toggle', rect: [5, 10, 10, 30], art: { idle: '/lamp-on.webp', active: '/lamp-off.webp' } };
const PUMPKIN = { id: 'pumpkin', effect: 'light', rect: [60, 50, 6, 8], art: { idle: '/p.webp', active: '/p-lit.webp' } };
const CAN = { id: 'can', effect: 'pop', rect: [70, 80, 3, 6], art: { idle: '/can.webp' } };
const NEON = { id: 'neon', effect: 'neon', rect: [40, 2, 20, 12], art: { idle: '/neon.webp', active: '/neon-off.webp' } };
const toyEl = (c, id) => c.querySelector(`[data-toy="${id}"]`);
const pic = (el) => el.querySelector('img').getAttribute('src');

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

test('the lamp toggles between its two pictures', () => {
  const { container } = render(<Toy toy={LAMP} />);
  const el = toyEl(container, 'lamp');
  fireEvent.pointerDown(el);
  expect(pic(el)).toBe('/lamp-off.webp');
  fireEvent.pointerDown(el);
  expect(pic(el)).toBe('/lamp-on.webp');
});

test('the pumpkin lights up, then dies down', () => {
  const { container } = render(<Toy toy={PUMPKIN} />);
  const el = toyEl(container, 'pumpkin');
  fireEvent.pointerDown(el);
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
  fireEvent.pointerDown(toyEl(container, 'pumpkin'));
  fireEvent.pointerDown(toyEl(container, 'can'));
  act(() => jest.advanceTimersByTime(TOY_MS.pop - 1));
  expect(toyEl(container, 'pumpkin').getAttribute('data-on')).toBe('true');
  expect(toyEl(container, 'can').getAttribute('data-on')).toBe('true');
  act(() => jest.advanceTimersByTime(1));
  expect(toyEl(container, 'can').getAttribute('data-on')).toBe('false');
  expect(toyEl(container, 'pumpkin').getAttribute('data-on')).toBe('true');
});

test('unmounting a toy mid-effect clears its timer', () => {
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { container, unmount } = render(<Toy toy={PUMPKIN} />);
  fireEvent.pointerDown(toyEl(container, 'pumpkin'));
  expect(jest.getTimerCount()).toBe(1);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  act(() => jest.advanceTimersByTime(TOY_MS.light));
  expect(err).not.toHaveBeenCalled();
  err.mockRestore();
});

test('a can with no extra picture fizzes', () => {
  const { container } = render(<Toy toy={CAN} />);
  fireEvent.pointerDown(toyEl(container, 'can'));
  expect(screen.getByTestId('toy-bubbles')).toBeTruthy();
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
    fireEvent.pointerDown(el);
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
    fireEvent.pointerDown(el);
    expect(lit(el).className).toContain('animate-couch-neon-off');
    act(() => jest.advanceTimersByTime(TOY_MS.neon));
    expect(lit(el).className).toContain('animate-couch-neon-on');
    act(() => jest.advanceTimersByTime(700));
    expect(lit(el).className).toContain('animate-couch-neon-on');
  });

  test('unmounting clears every timer', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { container, unmount } = render(<Toy toy={NEON} />);
    fireEvent.pointerDown(toyEl(container, 'neon'));
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
    fireEvent.pointerDown(el);
    expect(layers(el)).toEqual(['/neon-off.webp']);
    expect(container.innerHTML).not.toContain('animate-couch-neon');
    act(() => jest.advanceTimersByTime(TOY_MS.neon));
    expect(layers(el)).toEqual(['/neon.webp']);
  });
});
