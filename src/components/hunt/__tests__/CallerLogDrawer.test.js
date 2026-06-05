import { render, screen } from '@testing-library/react';
import CallerLogDrawer from '../CallerLogDrawer';

const NAME = 'Ana';
const BONUSES = [
  { id: 'b1', slot: 'Big Bass', stake: 10, win: 1000, caller: 'Ana' }, // 100x, this hunt
  { id: 'b2', slot: 'Gates', stake: 10, win: 0, caller: 'Ana' },       // opening… this hunt
];
const HISTORY = [
  { bonuses: [
    { slot: 'Wanted', stake: 10, win: 300, caller: 'Ana' },   // 30x played
    { slot: 'Skip Me', stake: 10, win: 5, caller: 'Ana' },    // 0.5x played
    { slot: 'Other', stake: 10, win: 100, caller: 'Bo' },     // not Ana — ignored
  ] },
];

test('renders prior-hunt rollup: counts caller slots, played, and avg X', () => {
  render(<CallerLogDrawer name={NAME} bonuses={BONUSES} history={HISTORY} skippedCalls={[]} onClose={() => {}} />);
  // Ana prior: 2 slots in, 2 played, avg (30 + 0.5)/2 = 15.25x
  expect(screen.getByText(/2 slots in · 2 played · avg 15\.25x/)).toBeTruthy();
});

test('this-hunt section lists the caller\'s slots with multiplier or opening state', () => {
  render(<CallerLogDrawer name={NAME} bonuses={BONUSES} history={[]} skippedCalls={[]} onClose={() => {}} />);
  expect(screen.getByText('Big Bass')).toBeTruthy();
  expect(screen.getByText('Gates')).toBeTruthy();
  expect(screen.getByText('opening…')).toBeTruthy(); // Gates has win 0
});

test('handles history with missing bonuses array without crashing', () => {
  const messyHistory = [{}, { bonuses: null }, { bonuses: [{ slot: 'X', stake: 0, win: 0, caller: 'Ana' }] }];
  render(<CallerLogDrawer name={NAME} bonuses={[]} history={messyHistory} skippedCalls={[]} onClose={() => {}} />);
  // 1 slot in (the stake:0 one counts as gotIn but not played), 0 played, no avg
  expect(screen.getByText(/1 slots in · 0 played/)).toBeTruthy();
});
