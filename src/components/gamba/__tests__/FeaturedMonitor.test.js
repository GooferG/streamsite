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

test('pre-hunt: an untitled round reads as a prediction round', () => {
  show({ featured: 'hunts', feature: huntFeature({ hunts: HUNTS(), round: { ...ROUND('open'), title: '' } }) });
  expect(screen.getByText('Prediction round · Predictions open')).toBeTruthy();
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

test('a takeover after ready is announced politely; the first ready render says nothing', () => {
  const hunts = HUNTS({ live: LIVE_HUNT });
  const feature = huntFeature({ hunts, round: ROUND('open') });
  const view = (featured, ready) => (
    <MemoryRouter>
      <FeaturedMonitor featured={featured} feature={featured === 'hunts' ? feature : null} leaderboard={BOARD} resets={null} now={NOW} ready={ready} />
    </MemoryRouter>
  );
  const { rerender } = render(view('leaderboard', false));
  const status = screen.getByRole('status');
  expect(status.className).toContain('sr-only');
  rerender(view('leaderboard', true));
  expect(screen.getByRole('status').textContent).toBe('');
  rerender(view('hunts', true));
  // The same live region node, now carrying the announcement.
  expect(screen.getByRole('status')).toBe(status);
  expect(status.textContent).toBe('Now showing: Hunts');
  rerender(view('leaderboard', true));
  expect(screen.getByRole('status').textContent).toBe('Now showing: Leaderboard');
});

test('first load straight onto Hunts announces nothing', () => {
  const hunts = HUNTS({ live: LIVE_HUNT });
  show({ featured: 'hunts', feature: huntFeature({ hunts, round: ROUND('open') }) });
  expect(screen.getByRole('status').textContent).toBe('');
});

test('the leaderboard ticker is labelled as the standings ticker', () => {
  show({ featured: 'leaderboard', feature: null });
  expect(screen.getByRole('marquee', { name: 'Standings ticker' })).toBeTruthy();
});

test('notches: unopened ones read in ink-6 and stay visible on phones', () => {
  const hunts = HUNTS({ live: LIVE_HUNT });
  show({ featured: 'hunts', feature: huntFeature({ hunts, round: null }) });
  const notches = screen.getByTestId('hunt-notches');
  expect(notches.className).toContain('gap-px');
  expect(notches.className).toContain('sm:gap-1');
  expect(notches.innerHTML).not.toContain('bg-onair-ink-7');
  expect(notches.children[1].className).toContain('bg-onair-ink-6');
});

test('past 60 bonuses the bar track reads in ink-6', () => {
  const many = Array.from({ length: 61 }, (_, i) => ({ slot: `S${i}`, bet: 1, win: i < 10 ? 5 : null, multiplier: i < 10 ? 5 : null }));
  const hunts = HUNTS({ live: { ...LIVE_HUNT, bonusCount: 61, bonuses: many } });
  show({ featured: 'hunts', feature: huntFeature({ hunts, round: null }) });
  const bar = screen.getByTestId('hunt-progress-bar');
  expect(bar.className).toContain('bg-onair-ink-6');
  expect(bar.className).not.toContain('bg-onair-ink-7');
});
