import { act, fireEvent, render, screen } from '@testing-library/react';
import RoomToys from '../RoomToys';
import Toy, { TOY_MS } from '../Toy';
import { roomToys } from '../themes';

jest.mock('../../../config/firebase', () => ({ auth: {}, db: {} }));

const LAMP = { id: 'lamp', effect: 'toggle', rect: [5, 10, 10, 30], art: { idle: '/lamp-on.webp', active: '/lamp-off.webp' } };
const PUMPKIN = { id: 'pumpkin', effect: 'light', rect: [60, 50, 6, 8], art: { idle: '/p.webp', active: '/p-lit.webp' } };
const CAN = { id: 'can', effect: 'pop', rect: [70, 80, 3, 6], art: { idle: '/can.webp' } };
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

test('under reduced motion the pumpkin still lights; a one-shot just resets', () => {
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
  const { container } = render(
    <>
      <Toy toy={PUMPKIN} />
      <Toy toy={CAN} />
    </>
  );
  fireEvent.pointerDown(toyEl(container, 'pumpkin'));
  fireEvent.pointerDown(toyEl(container, 'can'));
  act(() => jest.advanceTimersByTime(0));
  expect(toyEl(container, 'pumpkin').getAttribute('data-on')).toBe('true');
  expect(toyEl(container, 'can').getAttribute('data-on')).toBe('false');
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
