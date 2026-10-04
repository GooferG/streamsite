import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FeaturedMonitor from '../FeaturedMonitor';
import { huntFeature } from '../guide';

const NOW = new Date(2026, 9, 1, 21, 58).getTime();
const LIVE_HUNT = {
  id: 'h9', status: 'live', huntType: 'community', currency: null, pot: 2421.82, bonusCount: 2, totalWon: null,
  bonuses: [{ slot: 'Wanted', bet: 1, win: 212, multiplier: 212 }, { slot: 'Dog', bet: 1, win: null, multiplier: null }],
};
const ROUND = (status) => ({
  id: 'r1', title: 'Thursday comm hunt', status, acceptPredictions: true, entryCount: 6, source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h9', totalCost: 2421.82, currency: null, bonusCount: 2 },
});
const HUNTS = (over = {}) => ({ live: null, recent: [], loading: false, error: null, ...over });
const BOARD = {
  players: [{ maskedUsername: 'ab***z', wagered: 41203, prize: 2000 }, { maskedUsername: 'kr***9', wagered: 34333, prize: 1000 }],
  prizePool: 5000, periodLabel: 'OCTOBER 2026', endsAt: 1, isLoading: false, error: null,
};

function show(props) {
  return render(
    <MemoryRouter>
      <FeaturedMonitor leaderboard={BOARD} resets="Resets in 27d 04h" now={NOW} ready {...props} />
    </MemoryRouter>
  );
}

test('live hunt with predictions open: LIVE light, won so far, chip and the guess call to action', () => {
  const hunts = HUNTS({ live: LIVE_HUNT });
  show({ featured: 'hunts', feature: huntFeature({ hunts, round: ROUND('open') }) });
  expect(screen.getByRole('region', { name: 'Featured channel' })).toBeTruthy();
  expect(screen.getByText('Live')).toBeTruthy();
  expect(screen.getByText(/Community hunt · Opening bonuses/)).toBeTruthy();
  expect(screen.getByText('Won so far · 1/2 opened')).toBeTruthy();
  // The chip ("Predictions open · 6 in"); the chyron also says "Predictions open".
  expect(screen.getByText(/Predictions open ·/)).toBeTruthy();
  const cta = screen.getByRole('link', { name: 'Get your guess in' });
  expect(cta.getAttribute('href')).toBe('/gamba/hunts');
  expect(cta.className).toContain('from-onair-viewer');
});

test('live hunt after its round settled: no chip, watch call to action', () => {
  const hunts = HUNTS({ live: LIVE_HUNT });
  show({ featured: 'hunts', feature: huntFeature({ hunts, round: ROUND('settled') }) });
  expect(screen.queryByText(/Predictions open ·/)).toBeNull();
  expect(screen.getByRole('link', { name: 'Watch the opening' }).getAttribute('href')).toBe('/gamba/hunts');
});

test('a huge ARS amount sets the code small beside the figure', () => {
  const hunts = HUNTS({ live: { ...LIVE_HUNT, currency: 'ARS', bonuses: [{ slot: 'X', bet: 1, win: 1539232.7, multiplier: 9 }] } });
  show({ featured: 'hunts', feature: huntFeature({ hunts, round: null }) });
  expect(screen.getByText('ARS').className).toContain('text-[0.45em]');
});

test('pre-hunt: the question, no LIVE light, guess call to action', () => {
  show({ featured: 'hunts', feature: huntFeature({ hunts: HUNTS(), round: ROUND('open') }) });
  expect(screen.getByRole('heading', { name: 'What does the hunt pay?' })).toBeTruthy();
  expect(screen.queryByText('Live')).toBeNull();
  expect(screen.getByRole('link', { name: 'Get your guess in' })).toBeTruthy();
});

test('leaderboard: pool, leader, resets clock, standings chyron and the standings link', () => {
  show({ featured: 'leaderboard', feature: null });
  expect(screen.getByText(/CH 01 · Leaderboard/)).toBeTruthy();
  expect(screen.getByText('5,000')).toBeTruthy();
  expect(screen.getByText('ab***z · $41,203')).toBeTruthy();
  expect(screen.getAllByText(/1 ab\*\*\*z \$41,203/).length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: 'View standings' }).getAttribute('href')).toBe('/gamba/leaderboard');
});

test('leaderboard: the channel line is just the channel; the period is the hero label', () => {
  show({ featured: 'leaderboard', feature: null });
  expect(screen.getByText('CH 01 · Leaderboard')).toBeTruthy();
  expect(screen.queryByText(/Leaderboard · OCTOBER/)).toBeNull();
  expect(screen.getByText('OCTOBER 2026')).toBeTruthy();
});

test('leaderboard: a new month shows a dash for the pool', () => {
  show({ featured: 'leaderboard', feature: null, leaderboard: { ...BOARD, players: [], prizePool: 0 } });
  expect(screen.getByText('—')).toBeTruthy();
});

test('leaderboard: a failed read shows No signal', () => {
  show({ featured: 'leaderboard', feature: null, leaderboard: { ...BOARD, players: [], error: 'HTTP 502' } });
  expect(screen.getByRole('heading', { name: 'No signal' })).toBeTruthy();
});

test('the static plays when the takeover starts, never on first load', () => {
  const hunts = HUNTS({ live: LIVE_HUNT });
  const feature = huntFeature({ hunts, round: ROUND('open') });
  const view = (featured, ready) => (
    <MemoryRouter>
      <FeaturedMonitor featured={featured} feature={featured === 'hunts' ? feature : null} leaderboard={BOARD} resets={null} now={NOW} ready={ready} />
    </MemoryRouter>
  );
  const { rerender } = render(view('leaderboard', false));
  rerender(view('leaderboard', true));
  expect(screen.queryByTestId('onair-static')).toBeNull();
  rerender(view('hunts', true));
  expect(screen.getByTestId('onair-static')).toBeTruthy();
});
