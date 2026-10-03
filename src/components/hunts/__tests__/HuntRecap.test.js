import { fireEvent, render, screen, within } from '@testing-library/react';
import HuntRecap from '../HuntRecap';
import { huntStats } from '../huntStats';

const SLOTS = ['Wanted Dead or a Wild', 'Gates of Olympus', 'Sweet Bonanza', 'Mental', 'Sugar Rush', 'Chaos Crew', 'The Dog House', 'Fruit Party', 'Starlight Princess', 'Big Bass Bonanza', 'Pug Life', 'Le Viking'];
const MULTIS = [812, 41.5, 12.2, 268, 3.1, 74, 0, 28.4, 156, 9.6, 13, null];
const BONUSES = SLOTS.map((slot, i) => ({
  slot,
  bet: 0.6,
  win: MULTIS[i] == null ? null : Math.round(0.6 * MULTIS[i] * 100) / 100,
  multiplier: MULTIS[i],
  thumb: i === 0 ? 'https://img/wanted.png' : null,
}));
const ROUND = { status: 'open', source: 'manual', manualTotalCost: 2421.82 };

function rows() {
  return within(screen.getByRole('table', { name: 'Bonuses' })).getAllByRole('row').slice(1);
}

test('docket: start cost, total bet, bonuses, required avg; all dashes and UP FIRST', () => {
  const unopened = BONUSES.map((b) => ({ ...b, win: null, multiplier: null }));
  render(<HuntRecap kind="docket" title="On the docket" stats={huntStats({ bonuses: unopened }, ROUND)} currency={null} />);
  expect(screen.getByRole('heading', { name: 'On the docket' })).toBeTruthy();
  expect(screen.getByText('12 bonuses')).toBeTruthy();
  expect(screen.getByText('Required avg')).toBeTruthy();
  expect(screen.getByText('336.4x')).toBeTruthy();
  expect(within(rows()[0]).getByText('Up first')).toBeTruthy();
  expect(within(rows()[1]).getAllByText('—')).toHaveLength(2);
});

test('final: best hit tagged, 0x in the loss colour, show all expands', () => {
  render(<HuntRecap kind="final" title="Hunt recap" stats={huntStats({ bonuses: BONUSES }, null)} currency={null} />);
  expect(within(rows()[0]).getByText('Best hit')).toBeTruthy();
  expect(within(rows()[6]).getByText('0.0x').className).toContain('text-onair-loss');
  expect(rows()).toHaveLength(10);
  // The footer is not a table row, so it lives outside role="table".
  expect(within(screen.getByRole('table', { name: 'Bonuses' })).queryByText(/Showing 10 of 12/)).toBeNull();
  expect(screen.getByText(/Showing 10 of 12/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
  expect(rows()).toHaveLength(12);
  // A final recap never tags "Up next", even if the data has an unopened bonus.
  expect(within(rows()[11]).queryByText('Up next')).toBeNull();
});

// Review: during the opening the next bonus sat past row 10, hidden behind Show all.
test('opening: the visible window follows the next bonus so Up next stays on screen', () => {
  const many = Array.from({ length: 37 }, (_, i) => ({
    slot: `Slot ${i + 1}`,
    bet: 0.6,
    win: i < 12 ? 6 : null,
    multiplier: i < 12 ? 10 : null,
  }));
  render(<HuntRecap kind="opening" title="Opening now" stats={huntStats({ bonuses: many }, ROUND)} currency={null} />);
  expect(rows()).toHaveLength(10);
  expect(within(rows()[2]).getByText('Up next')).toBeTruthy();
  expect(within(rows()[0]).getByText('11')).toBeTruthy();
  expect(screen.getByText(/Showing 11–20 of 37/)).toBeTruthy();
});

test('opening: won so far, opened count, still-need avg', () => {
  render(<HuntRecap kind="opening" title="Opening now" stats={huntStats({ bonuses: BONUSES }, ROUND)} currency={null} />);
  expect(screen.getByText('Won so far')).toBeTruthy();
  expect(screen.getByText('11/12')).toBeTruthy();
  expect(screen.getByText('Still need avg')).toBeTruthy();
});

test('hide bonuses collapses the table; a broken thumb falls back to initials', () => {
  const { container } = render(<HuntRecap kind="final" title="Hunt recap" stats={huntStats({ bonuses: BONUSES }, null)} currency={null} />);
  fireEvent.error(container.querySelector('img'));
  expect(screen.getByText('WD')).toBeTruthy();
  const toggle = screen.getByRole('button', { name: /Hide bonuses/ });
  fireEvent.click(toggle);
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.getByRole('button', { name: /Show bonuses/ }).getAttribute('aria-expanded')).toBe('false');
});

// Review Focus 4: a potless hunt without bonuses renders dashes, not NaN.
test('a potless hunt renders without NaN and offers back when browsing an episode', () => {
  const onBack = jest.fn();
  const { container } = render(
    <HuntRecap kind="final" title="Solo hunt · SEP 24" stats={huntStats({ pot: 0, totalWon: 50 }, null)} currency="CAD" onBack={onBack} />
  );
  expect(container.textContent).not.toMatch(/NaN|Infinity/);
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  fireEvent.click(screen.getByRole('button', { name: 'Back to tonight' }));
  expect(onBack).toHaveBeenCalled();
});

// Review Focus 1: long currency codes shrink beside the figure instead of clipping.
test('recap money splits a long currency code from the figure', () => {
  render(<HuntRecap kind="final" title="Hunt recap" stats={huntStats({ pot: 150000, totalWon: 1850000 }, null)} currency="ARS" />);
  const won = screen.getByText((_, el) => el.tagName === 'DD' && el.textContent.endsWith('1,850,000.00'));
  expect(within(won).getByText('ARS').tagName).toBe('SPAN');
});

test('loading and error lines while a hunt detail is fetched', () => {
  const { rerender } = render(<HuntRecap kind="final" title="Hunt recap" stats={huntStats(null, null)} currency={null} loading />);
  expect(screen.getByText('Loading bonuses…')).toBeTruthy();
  rerender(<HuntRecap kind="final" title="Hunt recap" stats={huntStats(null, null)} currency={null} error="Could not load this hunt’s bonuses." />);
  expect(screen.getByText('Could not load this hunt’s bonuses.')).toBeTruthy();
});
