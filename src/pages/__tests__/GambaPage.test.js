import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import GambaPage from '../GambaPage';
import { resetTunerMemory } from '../../components/gamba/GambaTuner';

jest.mock('../HuntsPage', () => () => <p>hunts tool</p>);
jest.mock('../../components/Leaderboard', () => () => <p>leaderboard tool</p>);
jest.mock('../../components/BonusBattle', () => () => <p>battle tool</p>);
jest.mock('../../components/SlotPicker', () => () => <p>picker tool</p>);
jest.mock('../../components/gamba/GambaGuide', () => () => <p>gamba hub</p>);

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GambaPage />
    </MemoryRouter>
  );
}

const current = () =>
  screen
    .getByRole('navigation', { name: 'Gamba channels' })
    .querySelector('[aria-current="page"]').textContent;

// App.js keys the routes on the pathname, so a channel change unmounts the
// old page and mounts the new one in the same commit.
function KeyedGambaPage() {
  const { pathname } = useLocation();
  return <GambaPage key={pathname} />;
}

const pageHeading = () => screen.getByRole('heading', { level: 1 });

beforeEach(() => resetTunerMemory());
afterEach(() => jest.restoreAllMocks());

test('/gamba shows the tuner on CH 00 above the hub', () => {
  renderAt('/gamba');
  expect(current()).toMatch(/CH 00\s*Hub/);
  expect(screen.getByText('gamba hub')).toBeTruthy();
});

test('/gamba/hunts shows the tuner on CH 02 above the Hunts tool', () => {
  renderAt('/gamba/hunts');
  expect(current()).toMatch(/CH 02\s*Hunts/);
  expect(screen.getByText('hunts tool')).toBeTruthy();
});

test('lazy tools load behind the On Air loading line', async () => {
  renderAt('/gamba/wheel');
  expect(await screen.findByText('picker tool')).toBeTruthy();
});

test('an unknown tool id redirects to the hub', () => {
  renderAt('/gamba/nope');
  expect(screen.getByText('gamba hub')).toBeTruthy();
  expect(current()).toMatch(/CH 00\s*Hub/);
});

test('a visually hidden page heading names the channel', () => {
  renderAt('/gamba/hunts');
  expect(pageHeading().textContent).toBe('Gamba · Hunts');
  expect(pageHeading().className).toContain('sr-only');
  expect(pageHeading().getAttribute('tabindex')).toBe('-1');
});

test('the hub heading reads Gamba · Hub', () => {
  renderAt('/gamba');
  expect(pageHeading().textContent).toBe('Gamba · Hub');
});

test('a fresh visit leaves focus alone', () => {
  renderAt('/gamba/hunts');
  expect(document.activeElement).not.toBe(pageHeading());
});

test('after a recent tune the new channel heading takes focus', () => {
  renderAt('/gamba/leaderboard').unmount();
  renderAt('/gamba/hunts');
  expect(document.activeElement).toBe(pageHeading());
});

test('a stale tune (another page, minutes later) leaves focus alone', () => {
  let now = 10000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  renderAt('/gamba/leaderboard').unmount();
  now += 60000;
  renderAt('/gamba/hunts');
  expect(document.activeElement).not.toBe(pageHeading());
});

test('changing channels from the tuner: focus lands on the new channel and the needle slides from the old one', () => {
  render(
    <MemoryRouter initialEntries={['/gamba/leaderboard']}>
      <KeyedGambaPage />
    </MemoryRouter>
  );
  expect(document.activeElement).not.toBe(pageHeading());
  fireEvent.click(screen.getByRole('link', { name: 'Next channel: Hunts' }));
  expect(screen.getByText('hunts tool')).toBeTruthy();
  expect(pageHeading().textContent).toBe('Gamba · Hunts');
  expect(document.activeElement).toBe(pageHeading());
  // Leaderboard is the second of five channels: 30%.
  expect(screen.getByTestId('tuner-needle').style.left).toBe('30%');
});
