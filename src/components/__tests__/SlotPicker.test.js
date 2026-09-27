import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SlotPicker from '../SlotPicker';
import { __resetSlotCatalogForTests } from '../../hooks/useSlotCatalog';

const ROWS = [
  { name: 'Gates of Olympus', provider: 'pragmatic-play', rainbetSlug: 'pp-gates', thumb: 'https://cdn.rainbet.com/slots/gates.png', bonusBuy: true, rtp: 96.5, volatility: 'very-high', maxWin: 5000 },
  { name: 'Bonanza Megaways', provider: 'big-time-gaming', rainbetSlug: 'btg-bonanza', thumb: 'https://cdn.rainbet.com/slots/Bonanza%20Megaways.png', bonusBuy: false, rtp: 96, volatility: 'high', maxWin: 12000 },
  { name: 'Sugar Mix', provider: 'bgaming', rainbetSlug: 'bg-sugar', thumb: null, bonusBuy: null, rtp: null, volatility: 'low', maxWin: null },
  { name: 'Book of Dead', provider: 'playn-go', rainbetSlug: 'png-book', thumb: 'https://cdn.rainbet.com/slots/book.png', bonusBuy: false, rtp: 96.21, volatility: 'medium-high', maxWin: 5000 },
];

function mockCatalog(ok = true) {
  global.fetch = jest.fn(() =>
    Promise.resolve(
      ok
        ? { ok: true, status: 200, json: () => Promise.resolve({ slots: ROWS }) }
        : { ok: false, status: 502, json: () => Promise.resolve({ error: 'UPSTREAM_UNAVAILABLE' }) }
    )
  );
}

async function openCatalog() {
  render(<SlotPicker />);
  fireEvent.click(screen.getByRole('button', { name: /catalog/i }));
}

beforeEach(() => {
  __resetSlotCatalogForTests();
});

test('catalog shows fetched slots with display providers and a max win badge', async () => {
  mockCatalog();
  await openCatalog();
  expect(await screen.findByText('Gates of Olympus')).toBeTruthy();
  expect(screen.getByText('Pragmatic Play')).toBeTruthy();
  expect(screen.getByText("Play'n GO")).toBeTruthy();
  expect(screen.getByText('12,000x')).toBeTruthy();
});

test('volatility high shows only high-bucket slots', async () => {
  mockCatalog();
  await openCatalog();
  await screen.findByText('Gates of Olympus');
  fireEvent.click(screen.getByRole('button', { name: 'high' }));
  expect(screen.getByText('Gates of Olympus')).toBeTruthy();
  expect(screen.getByText('Bonanza Megaways')).toBeTruthy();
  expect(screen.queryByText('Sugar Mix')).toBeNull();
  expect(screen.queryByText('Book of Dead')).toBeNull();
});

test('megaways filter uses name detection and the progressive filter is gone', async () => {
  mockCatalog();
  await openCatalog();
  await screen.findByText('Gates of Olympus');
  expect(screen.queryByRole('button', { name: /progressive/i })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /megaways/i }));
  expect(screen.getByText('Bonanza Megaways')).toBeTruthy();
  expect(screen.queryByText('Gates of Olympus')).toBeNull();
});

// Review Focus 3: offline catalogue shows the offline line, filters still render.
test('catalog shows the offline line when the slot list fails', async () => {
  mockCatalog(false);
  await openCatalog();
  expect(await screen.findByText(/slot list is offline, try again in a bit/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /megaways/i })).toBeTruthy();
});

test('spinner candidates come from the catalogue', async () => {
  mockCatalog();
  render(<SlotPicker />);
  await waitFor(() => expect(screen.getAllByText('Gates of Olympus').length).toBeGreaterThan(0));
  expect(screen.getByText('004')).toBeTruthy();
});
