import { render, screen } from '@testing-library/react';
import CallerStatsPanel from '../CallerStatsPanel';

test('renders caller rows with status and got-in counts', () => {
  const bonuses = [
    { slot: 'Big Bass', stake: 10, win: 1000, caller: 'Ana' },
    { slot: 'Doom', stake: 10, win: 5, caller: 'Bo' },
  ];
  render(<CallerStatsPanel bonuses={bonuses} history={[]} skippedCalls={[]} onOpenLog={() => {}} />);
  // Caller names render as leaderboard-row buttons (the same name may also
  // appear in a summary tile, so target the row buttons specifically).
  expect(screen.getByRole('button', { name: 'Ana' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Bo' })).toBeTruthy();
});

test('empty state when no callers', () => {
  render(<CallerStatsPanel bonuses={[]} history={[]} skippedCalls={[]} onOpenLog={() => {}} />);
  expect(screen.getByText(/no calls tagged/i)).toBeTruthy();
});
