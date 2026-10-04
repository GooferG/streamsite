import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GambaTuner, { resetTunerMemory } from '../GambaTuner';
import { GAMBA_CHANNELS } from '../../../data/gambaTools';

const at = (id) => GAMBA_CHANNELS.find((c) => c.id === id);

function renderTuner(id) {
  return render(
    <MemoryRouter initialEntries={[at(id).path]}>
      <GambaTuner current={at(id)} />
    </MemoryRouter>
  );
}

const nav = () => screen.getByRole('navigation', { name: 'Gamba channels' });
const needle = () => screen.getByTestId('tuner-needle');
const frame = () => act(() => new Promise((r) => requestAnimationFrame(() => r())));

function setReducedMotion(on) {
  window.matchMedia = jest.fn((query) => ({ matches: on && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
}

beforeEach(() => resetTunerMemory());
afterEach(() => {
  delete window.matchMedia;
});

test('five channel links with CH numbers; the current one is the page', () => {
  renderTuner('hunts');
  const links = within(nav()).getAllByRole('link').filter((a) => /^CH/.test(a.textContent));
  expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
    ['CH 00Hub', '/gamba'],
    ['CH 01Leaderboard', '/gamba/leaderboard'],
    ['CH 02Hunts', '/gamba/hunts'],
    ['CH 03Bonus Battle', '/gamba/bonus-battle'],
    ['CH 04Slot Picker', '/gamba/wheel'],
  ]);
  expect(links[2].getAttribute('aria-current')).toBe('page');
  expect(links[1].getAttribute('aria-current')).toBeNull();
});

test('steppers name their target and wrap at both ends', () => {
  const { unmount } = renderTuner('hub');
  expect(screen.getByRole('link', { name: 'Previous channel: Slot Picker' }).getAttribute('href')).toBe('/gamba/wheel');
  expect(screen.getByRole('link', { name: 'Next channel: Leaderboard' }).getAttribute('href')).toBe('/gamba/leaderboard');
  unmount();
  renderTuner('wheel');
  expect(screen.getByRole('link', { name: 'Next channel: Hub' }).getAttribute('href')).toBe('/gamba');
});

test('null current reads as the hub', () => {
  render(
    <MemoryRouter initialEntries={['/gamba']}>
      <GambaTuner current={null} />
    </MemoryRouter>
  );
  expect(within(nav()).getByRole('link', { name: /CH 00\s*Hub/ }).getAttribute('aria-current')).toBe('page');
});

test('the phone readout names the channel and its position', () => {
  renderTuner('hunts');
  expect(screen.getByTestId('tuner-readout').textContent).toMatch(/CH 02\s*Hunts\s*· 3 of 5/);
});

test('the band and needle are set dressing', () => {
  renderTuner('hunts');
  expect(screen.getByTestId('tuner-band').getAttribute('aria-hidden')).toBe('true');
  expect(needle().className).toContain('motion-safe:transition-[left]');
});

test('first visit: the needle starts on its channel', () => {
  renderTuner('hunts');
  expect(needle().style.left).toBe('50%');
});

test('after a remount the needle slides from the previous channel', async () => {
  const first = renderTuner('hunts');
  first.unmount();
  renderTuner('wheel');
  expect(needle().style.left).toBe('50%');
  await frame();
  expect(needle().style.left).toBe('90%');
});

test('reduced motion: the needle jumps straight to the new channel', () => {
  setReducedMotion(true);
  const first = renderTuner('hunts');
  first.unmount();
  renderTuner('wheel');
  expect(needle().style.left).toBe('90%');
});
