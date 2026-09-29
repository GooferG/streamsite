import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WinnerModal from '../WinnerModal';
import { postAction } from '../api';

jest.mock('../../../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => 'c',
  query: (ref) => ref,
  orderBy: () => null,
  limit: () => null,
  onSnapshot: (_q, next) => {
    next({ docs: [] });
    return () => {};
  },
}));
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  postAction: jest.fn(),
}));

const at = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const ROLLING = {
  id: 'g1',
  status: 'rolling',
  kind: 'item',
  title: 'Friday',
  prize: 'Steam key',
  targetWinners: 1,
  winners: [],
  winnerTwitchId: 'tw1',
  rolledAt: at(Date.now() - 60_000),
  winner: {
    twitchId: 'tw1',
    twitchName: 'slotgoblin',
    displayName: 'SlotGoblin',
    weight: 2,
    source: 'chat',
    registered: true,
  },
};
const ANNOUNCE = { enabled: true, posted: true, posting: false, error: null, dueAt: null, retry: () => {} };

beforeEach(() => {
  postAction.mockReset();
  postAction.mockResolvedValue({ ok: true, status: 200, data: {} });
});

test('shows the pick and confirms it', async () => {
  render(<WinnerModal giveaway={ROLLING} announce={ANNOUNCE} />);
  expect(screen.getByText('SlotGoblin')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /confirm winner/i }));
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('confirm', { id: 'g1', prizeNote: null }));
});

test('R rerolls from the keyboard', async () => {
  render(<WinnerModal giveaway={ROLLING} announce={ANNOUNCE} />);
  fireEvent.keyDown(window, { key: 'r' });
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('reroll', { id: 'g1' }));
});

test('inline: a signed-out operator reads a plain sign-out message', async () => {
  postAction.mockResolvedValue({ ok: false, status: 401, data: { error: 'Invalid token' } });
  render(<WinnerModal giveaway={ROLLING} announce={ANNOUNCE} inline />);
  fireEvent.click(screen.getByRole('button', { name: /reroll/i }));
  expect(await screen.findByText('Signed out. Sign in again at /admin.')).toBeTruthy();
});

test('not inline: the same failure keeps the raw error text', async () => {
  postAction.mockResolvedValue({ ok: false, status: 401, data: { error: 'Invalid token' } });
  render(<WinnerModal giveaway={ROLLING} announce={ANNOUNCE} />);
  fireEvent.click(screen.getByRole('button', { name: /reroll/i }));
  expect(await screen.findByText('Action failed: Invalid token')).toBeTruthy();
});
