import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GambaTuner, { resetTunerMemory, tunedRecently } from '../GambaTuner';
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

// Pins Date.now so a test can age the remembered unmount.
function clockAt(ms) {
  let t = ms;
  jest.spyOn(Date, 'now').mockImplementation(() => t);
  return (later) => {
    t = later;
  };
}

beforeEach(() => resetTunerMemory());
afterEach(() => {
  delete window.matchMedia;
  jest.restoreAllMocks();
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
  const readout = screen.getByTestId('tuner-readout');
  expect(readout.textContent).toMatch(/CH 02\s*Hunts\s*· 3 of 5/);
  expect(within(readout).getByText('Hunts').className).toContain('text-[0.9375rem]');
  const position = within(readout).getByText(/3 of 5/);
  expect(position.className).toContain('text-xs');
  expect(position.className).not.toContain('text-[0.625rem]');
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

test('a channel change inside Gamba: the needle starts on the old channel and slides after two frames', async () => {
  const first = renderTuner('hunts');
  first.unmount();
  renderTuner('wheel');
  expect(needle().style.left).toBe('50%');
  await frame();
  // One frame paints the start position; the target is set on the next.
  expect(needle().style.left).toBe('50%');
  await frame();
  expect(needle().style.left).toBe('90%');
});

test('a return visit long after the tuner went away starts in place', async () => {
  const setNow = clockAt(10000);
  const first = renderTuner('hunts');
  first.unmount();
  setNow(10000 + 1501);
  renderTuner('wheel');
  expect(needle().style.left).toBe('90%');
  await frame();
  await frame();
  expect(needle().style.left).toBe('90%');
});

test('tunedRecently: only within 1500ms of the last unmount', () => {
  const setNow = clockAt(10000);
  expect(tunedRecently()).toBe(false);
  const first = renderTuner('hunts');
  expect(tunedRecently()).toBe(false);
  first.unmount();
  setNow(10000 + 1499);
  expect(tunedRecently()).toBe(true);
  setNow(10000 + 1500);
  expect(tunedRecently()).toBe(false);
  resetTunerMemory();
  setNow(10000);
  expect(tunedRecently()).toBe(false);
});

test('reduced motion: the needle jumps straight to the new channel', () => {
  setReducedMotion(true);
  const first = renderTuner('hunts');
  first.unmount();
  renderTuner('wheel');
  expect(needle().style.left).toBe('90%');
});
