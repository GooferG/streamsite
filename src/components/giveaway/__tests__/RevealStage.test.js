import { render, screen } from '@testing-library/react';
import RevealStage from '../RevealStage';

const at = (ms) => ({ toMillis: () => ms });
const pick = (rolledAgoMs) => ({
  id: 'g1',
  status: 'rolling',
  prize: '$50 bonus buy',
  targetWinners: 1,
  winners: [],
  winnerTwitchId: 'tw1',
  rolledAt: at(Date.now() - rolledAgoMs),
  winner: { twitchId: 'tw1', twitchName: 'slotgoblin', displayName: 'SlotGoblin', weight: 3 },
});

test('renders a landed pick without a sound hook', () => {
  render(<RevealStage giveaway={pick(20_000)} entries={[]} firstMessage={null} />);
  expect(screen.getAllByText('SlotGoblin').length).toBeGreaterThan(0);
  expect(screen.getByText('3 tickets in the hat')).toBeTruthy();
  expect(screen.getByText(/waiting on slotgoblin/i)).toBeTruthy();
});

test('renders mid-reveal without a sound hook', () => {
  render(<RevealStage giveaway={pick(500)} entries={[]} firstMessage={null} />);
  expect(screen.getByText(/tuning in/i)).toBeTruthy();
});
