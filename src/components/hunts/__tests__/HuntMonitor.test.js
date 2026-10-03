import { fireEvent, render, screen } from '@testing-library/react';
import HuntMonitor from '../HuntMonitor';
import { huntStats } from '../huntStats';

const ROUND = {
  id: 'r1',
  title: 'Thursday Comm Hunt',
  status: 'open',
  acceptPredictions: true,
  source: 'communityhunts',
  bonusHuntSnapshot: { huntId: 'h1', totalCost: 2421.82, currency: null, bonusCount: 3 },
};
const BONUSES = [
  { slot: 'Wanted Dead or a Wild', bet: 0.6, win: 487.2, multiplier: 812 },
  { slot: 'Gates of Olympus', bet: 0.8, win: 33.2, multiplier: 41.5 },
  { slot: 'Sugar Rush', bet: 0.6, win: null, multiplier: null },
];
const BASE = {
  currency: null,
  guessCount: 6,
  prize: '+500 tickets',
  winner: null,
  chatMedian: null,
  offair: { isLive: false, hasHunt: true, title: 'Community hunt' },
  clock: { long: 'THU OCT 1 · 9:58 PM', short: '9:58 PM' },
  ticker: ['Predictions open'],
  meter: null,
};

function renderMonitor(props) {
  return render(<HuntMonitor {...BASE} {...props} />);
}

test('open: required avg hero, side stats, chips and the open readout', () => {
  const stats = huntStats({ bonuses: BONUSES.map((b) => ({ ...b, win: null, multiplier: null })) }, ROUND);
  renderMonitor({ mode: 'open', round: ROUND, stats });
  expect(screen.getByText(/Thursday Comm Hunt · Predictions open/i)).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'What does the hunt pay?' })).toBeTruthy();
  expect(screen.getByText('1,211')).toBeTruthy();
  expect(screen.getByText('Required avg to break even')).toBeTruthy();
  expect(screen.getByText('Total bet')).toBeTruthy();
  expect(screen.getByText((_, el) => el.tagName === 'SPAN' && el.textContent === '6 guesses in')).toBeTruthy();
  expect(screen.getByText('Closest takes +500 tickets')).toBeTruthy();
  expect(screen.getByText('CH 02 · Entries open')).toBeTruthy();
  expect(screen.getByText('Live')).toBeTruthy();
});

test('open without bets falls back to the start cost as break-even', () => {
  const stats = huntStats(null, { ...ROUND, source: 'manual', manualTotalCost: 2421.82 });
  renderMonitor({ mode: 'open', round: ROUND, stats });
  expect(screen.getByText('$2,421.82')).toBeTruthy();
  expect(screen.getByText('Break-even')).toBeTruthy();
});

test('locked: won so far with progress, still-need avg and chat median', () => {
  const round = { ...ROUND, status: 'locked' };
  const stats = huntStats({ bonuses: BONUSES }, round);
  renderMonitor({ mode: 'locked', round, stats, chatMedian: 2938.5 });
  expect(screen.getByText(/Entries closed · Opening bonuses/i)).toBeTruthy();
  expect(screen.getByText('$520.40')).toBeTruthy();
  expect(screen.getByText('Won so far · 2/3 opened')).toBeTruthy();
  expect(screen.getByText('Chat median')).toBeTruthy();
  expect(screen.getByText('$2,938.50')).toBeTruthy();
  expect(screen.getAllByText('CH 02 · Entries closed').length).toBeGreaterThan(0);
});

test('settled: the winner reveal with guessed, actual and prize chips', () => {
  const round = { ...ROUND, status: 'settled', actual: { payout: 2046.12 } };
  const winner = { place: 1, twitchId: 'x', displayName: 'Xilentdrifter', payoutGuess: 2122, profileImageUrl: 'https://img/x.png', prize: { tickets: 500 } };
  const { container } = renderMonitor({ mode: 'settled', round, stats: huntStats({ bonuses: BONUSES }, round), winner });
  expect(screen.getByText(/And the closest guess is/i)).toBeTruthy();
  expect(screen.getByText('Xilentdrifter')).toBeTruthy();
  expect(screen.getByText('$2,122')).toBeTruthy();
  expect(screen.getByText('$2,046.12')).toBeTruthy();
  expect(screen.getByText('+500 tickets')).toBeTruthy();
  expect(screen.getByText('Replay')).toBeTruthy();
  fireEvent.error(container.querySelector('img'));
  expect(screen.getByText('X')).toBeTruthy();
});

test('settled without winners shows the payout and no eligible guesses', () => {
  const round = { ...ROUND, status: 'settled', actual: { payout: 2046.12 } };
  renderMonitor({ mode: 'settled', round, stats: huntStats(null, round), winner: null });
  expect(screen.getByText('No eligible guesses')).toBeTruthy();
  expect(screen.getByText('$2,046.12')).toBeTruthy();
});

test('off air: last hunt result, or nothing on when there is no hunt', () => {
  const stats = huntStats({ pot: 3103.62, totalWon: 1318.8, averageMultiple: 30.44 }, null);
  const { unmount } = renderMonitor({ mode: 'offair', round: null, stats });
  expect(screen.getByText(/Last hunt · Community hunt/i)).toBeTruthy();
  expect(screen.getByText('−$1,784.82')).toBeTruthy();
  expect(screen.getByText('CH 02 · No round')).toBeTruthy();
  unmount();
  renderMonitor({ mode: 'offair', round: null, stats: huntStats(null, null), offair: { isLive: false, hasHunt: false, title: null } });
  expect(screen.getByRole('heading', { name: 'Nothing on right now' })).toBeTruthy();
});

test('tuning shows the phrase and no status light', () => {
  renderMonitor({ mode: 'tuning', round: null, stats: huntStats(null, null), phrase: 'Tuning signal…', ticker: [] });
  expect(screen.getByText('Tuning signal…')).toBeTruthy();
  expect(screen.queryByText('Live')).toBeNull();
  expect(screen.queryByText('Replay')).toBeNull();
});

// Review Focus 1: a nine-figure ARS hero renders in one piece. (jsdom drops
// clamp()/cqi font sizes, so the sizing itself is pinned by the fitFigure
// unit test in Task 2.)
test('a huge ARS hero renders without NaN', () => {
  const round = { ...ROUND, status: 'settled', actual: { payout: 185000000.5 } };
  const { container } = renderMonitor({ mode: 'settled', round, currency: 'ARS', stats: huntStats(null, round), winner: null });
  expect(screen.getByText(/185,000,000\.50/).className).toContain('whitespace-nowrap');
  expect(container.textContent).not.toMatch(/NaN/);
});

test('the meter summarises itself for screen readers', () => {
  const meter = {
    lo: 1000,
    hi: 3000,
    markers: [{ key: 'break-even', label: 'Break-even', value: 2000, tone: 'signal', pct: 50, labelAt: 'top' }],
    dots: [{ id: 'me', value: 2450, tone: 'me', name: 'You', pct: 72.5 }],
    count: 9,
    sealed: true,
  };
  renderMonitor({ mode: 'open', round: ROUND, stats: huntStats(null, ROUND), meter });
  expect(screen.getByRole('img', { name: /Break-even \$2,000\.00\. 9 guesses, sealed until entries close/ })).toBeTruthy();
});
