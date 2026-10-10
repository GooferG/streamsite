import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { fixtureBalls, fixtureRack, fixtureRound } from '../ballFixtures';
import BallFront from '../BallFront';
import { frontFixture } from '../ballFixtures';
import useSlotCatalog from '../../../hooks/useSlotCatalog';

jest.mock('../../../hooks/useSlotCatalog', () => jest.fn());

const NOW = Date.UTC(2026, 9, 9, 3);
const CATALOG = [
  { id: 'fx-slot-0', name: 'Gates of Olympus', thumbnail: null, bonusBuy: true },
  { id: 'gates-1000', name: 'Gates of Olympus 1000', thumbnail: null, bonusBuy: true },
  { id: 'book', name: 'Book of Dead', thumbnail: null, bonusBuy: false },
];
const show = (key, extra = {}) => render(<BallFront {...frontFixture(key, NOW)} onLoadMore={jest.fn()} {...extra} />);

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  useSlotCatalog.mockReturnValue({ slots: CATALOG, loading: false, error: null });
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
});

test('loading', () => {
  show('loading');
  expect(screen.getByText('Tuning to Channel 42…')).toBeTruthy();
});

test('open: the strip, call one in, your ball and the drum', async () => {
  show('open');
  expect(screen.getByText(/Drum open/)).toBeTruthy();
  expect(screen.getByText('Top multi wins 200 tickets + $5')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search slots'), { target: { value: 'gates' } });
  expect(screen.getByText('Taken by @CoolGuy')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /^Copy !slot/ }));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('!slot Gates of Olympus 1000'));
  expect(await screen.findByRole('button', { name: /^Copied/ })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search slots'), { target: { value: 'book' } });
  expect(screen.queryByText('Book of Dead')).toBeNull();
  const mine = within(screen.getByRole('region', { name: 'Your ball' }));
  expect(mine.getByText('Big Bass Bonanza')).toBeTruthy();
  expect(mine.getByText('In the drum')).toBeTruthy();
  const drum = within(screen.getByRole('region', { name: 'In the drum' }));
  fireEvent.change(drum.getByLabelText('Find a ball'), { target: { value: 'reel' } });
  expect(drum.getByText('Zeus vs Hades')).toBeTruthy();
  expect(drum.queryByText('Le Bandit')).toBeNull();
});

test('rack: live multipliers with the leader marked', () => {
  show('rack');
  const rack = within(screen.getByRole('region', { name: "Tonight's rack" }));
  expect(rack.getByText('412x')).toBeTruthy();
  expect(rack.getByText('Live from the hunt · 60s')).toBeTruthy();
  expect(rack.getByText('Leader').closest('li').textContent).toContain('412x');
  expect(rack.getByText('—')).toBeTruthy();
});

test('off air: the last winner, no finder, past draws expand', () => {
  show('offair');
  expect(screen.getByText('Last winning ball: Gates of Olympus · 412x · @CoolGuy')).toBeTruthy();
  expect(screen.getByText("Drum's closed. Next draw whenever the drum opens on stream.")).toBeTruthy();
  expect(screen.queryByLabelText('Search slots')).toBeNull();
  const past = within(screen.getByRole('region', { name: 'Past draws' }));
  expect(past.getAllByRole('button', { name: /^Show rack/ })).toHaveLength(3);
  fireEvent.click(past.getAllByRole('button', { name: /^Show rack/ })[0]);
  expect(past.getByText('01 Gates of Olympus 412x')).toBeTruthy();
});

test('empty and load more', () => {
  const { unmount } = show('empty');
  expect(screen.getByText('No draws yet.')).toBeTruthy();
  unmount();
  const onLoadMore = jest.fn();
  render(<BallFront {...frontFixture('offair', NOW)} hasMore onLoadMore={onLoadMore} />);
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  expect(onLoadMore).toHaveBeenCalled();
});

test('load more is hidden without more pages, disabled while loading', () => {
  const { rerender } = render(<BallFront {...frontFixture('offair', NOW)} hasMore={false} onLoadMore={jest.fn()} />);
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  rerender(<BallFront {...frontFixture('offair', NOW)} hasMore pastLoading onLoadMore={jest.fn()} />);
  const btn = screen.getByRole('button', { name: 'Loading\u2026' });
  expect(btn.disabled).toBe(true);
  rerender(<BallFront {...frontFixture('offair', NOW)} hasMore pastError onLoadMore={jest.fn()} />);
  expect(screen.getByText('Could not load more draws.')).toBeTruthy();
});

test('closed: lineup closed, no finder', () => {
  show('closed');
  expect(screen.getByText(/Lineup closed/)).toBeTruthy();
  expect(screen.queryByLabelText('Search slots')).toBeNull();
  expect(screen.getByRole('region', { name: "Tonight's rack" })).toBeTruthy();
});

test('settled: shows the last winner and the archive', () => {
  show('settled');
  expect(screen.getByText('Last winning ball: Gates of Olympus \u00b7 412x \u00b7 @CoolGuy')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Past draws' })).toBeTruthy();
});

test('phone order: strip, call one in, your ball, rack, drum, past; folds start closed', () => {
  show('open');
  const before = (a, b) => expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const strip = document.getElementById('ball-title');
  const finder = screen.getByText('Call one in');
  const mine = screen.getByRole('region', { name: 'Your ball' });
  const rack = screen.getByRole('region', { name: "Tonight's rack" });
  const drum = screen.getByRole('region', { name: 'In the drum' });
  const past = screen.getByRole('region', { name: 'Past draws' });
  before(strip, finder);
  before(finder, mine);
  before(mine, rack);
  before(rack, drum);
  before(drum, past);
  expect(within(drum).getByRole('button', { name: 'Show In the drum' }).getAttribute('aria-expanded')).toBe('false');
  expect(within(past).getByRole('button', { name: 'Show Past draws' }).getAttribute('aria-expanded')).toBe('false');
});

test('off air: past draws starts open', () => {
  show('offair');
  const past = within(screen.getByRole('region', { name: 'Past draws' }));
  expect(past.getByRole('button', { name: 'Hide Past draws' }).getAttribute('aria-expanded')).toBe('true');
});

test('a draw inside the reveal delay stays off the rack until its chat line is due', () => {
  const rack = fixtureRack(NOW, 2, { lastAt: NOW - 2000 });
  const round = fixtureRound(NOW, { rack });
  const balls = fixtureBalls(NOW, { drawn: 2 });
  const props = { round, balls, me: 'fx1', past: [], ballsReady: true, still: true, onLoadMore: jest.fn() };
  const { rerender } = render(<BallFront {...props} now={NOW} />);
  const mine = within(screen.getByRole('region', { name: 'Your ball' }));
  expect(mine.getByText('In the drum')).toBeTruthy();
  expect(within(screen.getByRole('region', { name: "Tonight's rack" })).queryByText('Wanted Dead or a Wild')).toBeNull();
  rerender(<BallFront {...props} now={NOW + 12_000} />);
  expect(within(screen.getByRole('region', { name: 'Your ball' })).getByText(/On the rack/)).toBeTruthy();
  expect(within(screen.getByRole('region', { name: "Tonight's rack" })).getByText('Wanted Dead or a Wild')).toBeTruthy();
});

test('scratched draws show struck through with the word Scratched', () => {
  const rack = fixtureRack(NOW, 3).map((e, i) => (i === 1 ? { ...e, scratched: true } : e));
  const round = fixtureRound(NOW, { rack });
  render(<BallFront round={round} balls={fixtureBalls(NOW, { drawn: 3 })} past={[]} ballsReady onLoadMore={jest.fn()} now={NOW} still />);
  const r = within(screen.getByRole('region', { name: "Tonight's rack" }));
  expect(r.getByText('Scratched')).toBeTruthy();
  expect(r.getByText('Wanted Dead or a Wild').className).toContain('line-through');
});

test('until balls are ready the count is a dash and Your ball is hidden; a feed error says no signal', () => {
  const { rerender } = render(<BallFront {...frontFixture('open', NOW)} ballsReady={false} onLoadMore={jest.fn()} />);
  expect(screen.queryByRole('region', { name: 'Your ball' })).toBeNull();
  rerender(<BallFront {...frontFixture('offair', NOW)} roundError onLoadMore={jest.fn()} />);
  expect(screen.getByText('No signal from Channel 42.')).toBeTruthy();
});

test('a failed copy tells the viewer what to type; no match says so', async () => {
  navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
  show('open');
  fireEvent.change(screen.getByLabelText('Search slots'), { target: { value: 'gates' } });
  fireEvent.click(screen.getByRole('button', { name: /^Copy !slot/ }));
  expect(await screen.findByText('Copy failed. Type: !slot Gates of Olympus 1000')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search slots'), { target: { value: 'zzzz' } });
  expect(screen.getByText('No bonus-buy slot matches.')).toBeTruthy();
});

test('search ignores case, punctuation, a leading The and spaces', () => {
  useSlotCatalog.mockReturnValue({ slots: [{ id: 'dh', name: 'The Dog House', thumbnail: null, bonusBuy: true }], loading: false, error: null });
  show('open');
  fireEvent.change(screen.getByLabelText('Search slots'), { target: { value: 'doghouse' } });
  expect(screen.getByRole('button', { name: 'Copy !slot The Dog House' })).toBeTruthy();
});

test('an expanded past rack shows a scratched draw struck through', () => {
  const past = frontFixture('offair', NOW).past.map((r, i) => (i === 0 ? { ...r, rack: r.rack.map((e) => (e.drawNo === 2 ? { ...e, scratched: true } : e)) } : r));
  render(<BallFront {...frontFixture('offair', NOW)} round={past[0]} past={past} onLoadMore={jest.fn()} />);
  const region = within(screen.getByRole('region', { name: 'Past draws' }));
  fireEvent.click(region.getAllByRole('button', { name: /^Show rack/ })[0]);
  const chip = region.getByText('02 Wanted Dead or a Wild Scratched');
  expect(chip.className).toContain('line-through');
});

test('a scratched ball in the drum list is tagged Scratched', () => {
  const props = frontFixture('open', NOW);
  const balls = props.balls.map((b) => (b.id === 'fx6' ? { ...b, status: 'scratched' } : b));
  render(<BallFront {...props} balls={balls} onLoadMore={jest.fn()} />);
  const drum = within(screen.getByRole('region', { name: 'In the drum' }));
  expect(drum.getByText('Scratched')).toBeTruthy();
  expect(drum.getByText('Le Bandit').className).toContain('line-through');
});
