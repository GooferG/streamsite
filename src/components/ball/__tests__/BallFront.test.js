import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  fireEvent.click(screen.getByRole('button', { name: 'Copy !slot' }));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('!slot Gates of Olympus 1000'));
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
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
  expect(rack.getByText('Leader')).toBeTruthy();
  expect(rack.getByText('—')).toBeTruthy();
});

test('off air: the last winner, no finder, past draws expand', () => {
  show('offair');
  expect(screen.getByText('Last winning ball: Gates of Olympus · 412x · @CoolGuy')).toBeTruthy();
  expect(screen.getByText("Drum's closed. Next draw whenever the drum opens on stream.")).toBeTruthy();
  expect(screen.queryByLabelText('Search slots')).toBeNull();
  const past = within(screen.getByRole('region', { name: 'Past draws' }));
  expect(past.getAllByRole('button', { name: /Show the rack/ })).toHaveLength(3);
  fireEvent.click(past.getAllByRole('button', { name: /Show the rack/ })[0]);
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
