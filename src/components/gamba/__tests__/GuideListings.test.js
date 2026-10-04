import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuideListings from '../GuideListings';

const ROWS = [
  { id: 'leaderboard', channel: 'CH 01', label: 'Leaderboard', path: '/gamba/leaderboard', now: 'ab***z leads · $41,203', next: 'Resets in 27d 04h', lit: false, live: false, tone: null },
  { id: 'hunts', channel: 'CH 02', label: 'Hunts', path: '/gamba/hunts', now: 'Community hunt · 2/4 opened', next: 'Predictions open · 6 in', lit: true, live: true, tone: null },
  { id: 'bonus-battle', channel: 'CH 03', label: 'Bonus Battle', path: '/gamba/bonus-battle', now: 'Last hunt −$60.00', next: 'Any time', lit: false, live: false, tone: 'loss' },
];

const renderRows = () =>
  render(
    <MemoryRouter>
      <GuideListings rows={ROWS} />
    </MemoryRouter>
  );

test('each row is one link to its tool', () => {
  renderRows();
  expect(screen.getByRole('link', { name: /CH 01\s*Leaderboard/ }).getAttribute('href')).toBe('/gamba/leaderboard');
  expect(screen.getByRole('link', { name: /CH 02\s*Hunts/ }).getAttribute('href')).toBe('/gamba/hunts');
});

test('the lit row carries the signal wash and the LIVE light; others rest', () => {
  renderRows();
  const hunts = screen.getByRole('link', { name: /CH 02\s*Hunts/ });
  expect(hunts.getAttribute('data-lit')).toBe('signal');
  expect(hunts.textContent).toContain('Live');
  const board = screen.getByRole('link', { name: /CH 01\s*Leaderboard/ });
  expect(board.getAttribute('data-lit')).toBeNull();
  expect(board.textContent).not.toContain('Live');
});

test('rows go five-column only from lg, with shrinkable tracks', () => {
  renderRows();
  const row = screen.getByRole('link', { name: /CH 02\s*Hunts/ });
  expect(row.className).toContain('lg:grid-cols-[5.5rem_minmax(0,12rem)_minmax(0,1fr)_minmax(0,15rem)_1.5rem]');
  expect(row.className).not.toMatch(/\bsm:/);
  row.querySelectorAll('span').forEach((cell) => expect(cell.className).not.toMatch(/\bsm:/));
});

test('a loss reads in the loss ink', () => {
  renderRows();
  expect(screen.getByText('Last hunt −$60.00').className).toContain('text-onair-loss');
});
