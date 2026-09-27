import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { profitLoss, huntTypeLabel, formatMultiplier } from '../../../utils/huntFormat';
import CurrentHuntCard from '../CurrentHuntCard';
import BonusReel from '../BonusReel';
import RecentHunts from '../RecentHunts';
import CommunityHuntsPromo from '../CommunityHuntsPromo';
import useCommunityHunts from '../../../hooks/useCommunityHunts';

const ARCHIVED = {
  id: 'h1', status: 'archived', huntType: 'community', currency: 'CAD',
  startedAt: '2026-09-24T21:02:45.765Z', endedAt: '2026-09-24T23:06:49.441Z',
  bonusCount: 18, pot: 3103.62, totalWon: 1318.8, averageMultiple: 30.44,
};
const LIVE = {
  ...ARCHIVED, id: 'live1', status: 'live', endedAt: null,
  bonuses: [
    { slot: 'Pug Life', bet: 0.4, win: 5.2, multiplier: 13, thumb: null },
    { slot: 'Le Viking', bet: 0.4, win: null, multiplier: null, thumb: null },
  ],
};

test('huntFormat helpers', () => {
  expect(profitLoss(ARCHIVED)).toBe(-1784.82);
  expect(profitLoss({ pot: 0, totalWon: 50 })).toBeNull();
  expect(profitLoss({ pot: null, totalWon: 50 })).toBeNull();
  expect(huntTypeLabel('toplb')).toBe('Top LB');
  expect(huntTypeLabel('mystery')).toBe('Mystery');
  expect(formatMultiplier(null)).toBe('—');
  expect(formatMultiplier(30.44)).toBe('30.4x');
});

test('CurrentHuntCard shows a live hunt with its bonus reel', () => {
  render(<CurrentHuntCard hunt={LIVE} isLive />);
  expect(screen.getByText(/live hunt/i)).toBeTruthy();
  expect(screen.getByText('CA$3,103.62')).toBeTruthy();
  expect(screen.getByText('Pug Life')).toBeTruthy();
});

test('CurrentHuntCard shows the latest hunt without a reel', () => {
  render(<CurrentHuntCard hunt={ARCHIVED} isLive={false} />);
  expect(screen.getByText(/latest hunt/i)).toBeTruthy();
  expect(screen.getByText('-CA$1,784.82')).toBeTruthy();
});

// Review Focus 1: potless hunt.
test('CurrentHuntCard renders a potless hunt without NaN', () => {
  const { container } = render(
    <CurrentHuntCard hunt={{ ...ARCHIVED, pot: 0 }} isLive={false} />
  );
  expect(container.textContent).not.toMatch(/NaN/);
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
});

// Review Focus 2: unopened bonus in a live hunt.
test('BonusReel renders an unopened bonus as em dashes', () => {
  const { container } = render(<BonusReel bonuses={LIVE.bonuses} currency="CAD" />);
  expect(container.textContent).not.toMatch(/NaN/);
  expect(screen.getByText('Le Viking')).toBeTruthy();
});

test('RecentHunts expands a row and loads its bonuses', async () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ hunt: { ...ARCHIVED, bonuses: LIVE.bonuses } }) })
  );
  render(<RecentHunts hunts={[ARCHIVED]} />);
  fireEvent.click(screen.getByRole('button', { name: /community/i }));
  await waitFor(() => expect(screen.getByText('Pug Life')).toBeTruthy());
  expect(global.fetch).toHaveBeenCalledWith('/api/communityhunts?view=hunt&id=h1');
});

test('CommunityHuntsPromo links to the Bean hub and add-community', () => {
  render(<CommunityHuntsPromo />);
  const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
  expect(hrefs).toContain('https://communityhunts.gg/bean');
  expect(hrefs).toContain('https://communityhunts.gg/add-community');
});

function HookProbe({ onState }) {
  onState(useCommunityHunts());
  return null;
}

test('useCommunityHunts loads the overview and keeps data after a failed poll', async () => {
  jest.useFakeTimers();
  try {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ live: null, recent: [ARCHIVED] }) })
      .mockResolvedValueOnce({ ok: false, status: 502, json: () => Promise.resolve({ error: 'UPSTREAM_UNAVAILABLE' }) });
    let state;
    render(<HookProbe onState={(s) => { state = s; }} />);
    await waitFor(() => expect(state.loading).toBe(false));
    expect(state.recent).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith('/api/communityhunts?view=overview');

    await act(async () => {
      jest.advanceTimersByTime(60 * 1000);
    });
    await waitFor(() => expect(state.error).toBeTruthy());
    expect(state.recent).toHaveLength(1);
  } finally {
    jest.useRealTimers();
  }
});
