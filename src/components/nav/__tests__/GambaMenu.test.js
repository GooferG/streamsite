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
  act(() => jest.advanceTimersByTime(100));
  expect(caret().getAttribute('aria-expanded')).toBe('true');
  act(() => jest.advanceTimersByTime(30));
  expect(caret().getAttribute('aria-expanded')).toBe('false');
});

test('picking a channel closes the menu', () => {
  renderAt('/', undefined);
  fireEvent.click(caret());
  fireEvent.click(screen.getByRole('link', { name: /4-2 Hunts/ }));
  expect(caret().getAttribute('aria-expanded')).toBe('false');
});
