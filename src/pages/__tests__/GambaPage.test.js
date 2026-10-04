import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GambaPage from '../GambaPage';
import { resetTunerMemory } from '../../components/gamba/GambaTuner';

jest.mock('../HuntsPage', () => () => <p>hunts tool</p>);
jest.mock('../../components/Leaderboard', () => () => <p>leaderboard tool</p>);
jest.mock('../../components/BonusBattle', () => () => <p>battle tool</p>);
jest.mock('../../components/SlotPicker', () => () => <p>picker tool</p>);
jest.mock('../../components/GambaHub', () => () => <p>gamba hub</p>);

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

beforeEach(() => resetTunerMemory());

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
