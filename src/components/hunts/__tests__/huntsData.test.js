import { render, screen, waitFor, act } from '@testing-library/react';
import { profitLoss, huntTypeLabel, formatMultiplier } from '../../../utils/huntFormat';
import CommunityHuntsPromo from '../CommunityHuntsPromo';
import useCommunityHunts from '../../../hooks/useCommunityHunts';

// The Hunts tab's data helpers and the communityhunts promo. The old card,
// reel and archive tests moved with their replacements: HuntRecap.test.js
// (potless hunt, unopened bonuses), huntHooks.test.js (detail fetch) and
// HuntsTab.test.js (past episode swap).

const ARCHIVED = {
  id: 'h1', status: 'archived', huntType: 'community', currency: 'CAD',
  startedAt: '2026-09-24T21:02:45.765Z', endedAt: '2026-09-24T23:06:49.441Z',
  bonusCount: 18, pot: 3103.62, totalWon: 1318.8, averageMultiple: 30.44,
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
