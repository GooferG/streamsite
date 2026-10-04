import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GambaMenu from '../GambaMenu';

function renderAt(path, current) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GambaMenu current={current} />
    </MemoryRouter>
  );
}

const caret = () => screen.getByRole('button', { name: 'Gamba channels' });

afterEach(() => jest.useRealTimers());

test('the Gamba label goes straight to the hub; the caret discloses the channels', () => {
  renderAt('/schedule', undefined);
  expect(screen.getByRole('link', { name: /Gamba/ }).getAttribute('href')).toBe('/gamba');
  expect(screen.queryByRole('link', { name: /Hub/ })).toBeNull();
  fireEvent.click(caret());
  expect(caret().getAttribute('aria-expanded')).toBe('true');
  const rows = ['4-0 Hub', '4-1 Leaderboard', '4-2 Hunts', '4-3 Bonus Battle', '4-4 Slot Picker'];
  rows.forEach((name) => expect(screen.getByRole('link', { name: new RegExp(name) })).toBeTruthy());
  expect(screen.getByRole('link', { name: /4-4 Slot Picker/ }).getAttribute('href')).toBe('/gamba/wheel');
});

test('the current channel is marked Now', () => {
  renderAt('/gamba/hunts', 'true');
  expect(screen.getByRole('link', { name: /^04\s*Gamba$/ }).getAttribute('aria-current')).toBe('true');
  fireEvent.click(caret());
  const hunts = screen.getByRole('link', { name: /4-2 Hunts/ });
  expect(hunts.getAttribute('aria-current')).toBe('page');
  expect(hunts.textContent).toContain('Now');
  expect(screen.getByRole('link', { name: /4-1 Leaderboard/ }).getAttribute('aria-current')).toBeNull();
});

test('Escape closes the menu and returns focus to the caret', () => {
  renderAt('/', undefined);
  fireEvent.click(caret());
  screen.getByRole('link', { name: /4-0 Hub/ }).focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(caret().getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(caret());
});

test('hover opens it; leaving closes it after the grace delay', () => {
  jest.useFakeTimers();
  renderAt('/', undefined);
  const wrap = caret().parentElement;
  fireEvent.mouseEnter(wrap);
  expect(caret().getAttribute('aria-expanded')).toBe('true');
  fireEvent.mouseLeave(wrap);
  act(() => jest.advanceTimersByTime(230));
  expect(caret().getAttribute('aria-expanded')).toBe('true');
  act(() => jest.advanceTimersByTime(30));
  expect(caret().getAttribute('aria-expanded')).toBe('false');
});

test('a caret click on a menu hover opened keeps it open', () => {
  renderAt('/', undefined);
  fireEvent.mouseEnter(caret().parentElement);
  fireEvent.click(caret());
  expect(caret().getAttribute('aria-expanded')).toBe('true');
});

test('a tap (mouseenter, then click) leaves the menu open', () => {
  renderAt('/', undefined);
  fireEvent.mouseEnter(caret().parentElement);
  fireEvent.mouseDown(caret());
  fireEvent.mouseUp(caret());
  fireEvent.click(caret());
  expect(caret().getAttribute('aria-expanded')).toBe('true');
});

test('a pinned menu stays open when the mouse leaves', () => {
  jest.useFakeTimers();
  renderAt('/', undefined);
  const wrap = caret().parentElement;
  fireEvent.mouseEnter(wrap);
  fireEvent.click(caret());
  fireEvent.mouseLeave(wrap);
  act(() => jest.advanceTimersByTime(300));
  expect(caret().getAttribute('aria-expanded')).toBe('true');
});

test('a second caret click closes a pinned menu', () => {
  renderAt('/', undefined);
  fireEvent.mouseEnter(caret().parentElement);
  fireEvent.click(caret());
  fireEvent.click(caret());
  expect(caret().getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(caret());
  expect(caret().getAttribute('aria-expanded')).toBe('true');
});

test('row codes track at 0.15em', () => {
  renderAt('/', undefined);
  fireEvent.click(caret());
  expect(screen.getByText('4-2').className).toContain('tracking-[0.15em]');
});

test('the caret is at least a 24px target', () => {
  renderAt('/', undefined);
  expect(caret().className).toContain('h-8 w-8');
  expect(caret().className).not.toContain('p-1');
});

test('picking a channel closes the menu', () => {
  renderAt('/', undefined);
  fireEvent.click(caret());
  fireEvent.click(screen.getByRole('link', { name: /4-2 Hunts/ }));
  expect(caret().getAttribute('aria-expanded')).toBe('false');
});

test('the Now row closes the menu even though the path does not change', () => {
  renderAt('/gamba/hunts', 'true');
  fireEvent.click(caret());
  fireEvent.click(screen.getByRole('link', { name: /4-2 Hunts/ }));
  expect(caret().getAttribute('aria-expanded')).toBe('false');
});
