import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GiveawayTab from '../GiveawayTab';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { postAction } from '../../admin/giveaways/api';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: (_db, ...parts) => parts.join('/'),
  query: (ref) => ref,
  orderBy: () => null,
  limit: () => null,
  onSnapshot: (_q, next) => {
    next({ empty: true, docs: [] });
    return () => {};
  },
}));
jest.mock('../../admin/giveaways/api', () => ({
  ...jest.requireActual('../../admin/giveaways/api'),
  postAction: jest.fn(),
}));
jest.mock('../../admin/giveaways/EventSubStatus', () => ({
  __esModule: true,
  default: () => null,
  useEventSubStatus: () => ({ status: 'enabled', subs: [], busy: false, error: null, subscribe: jest.fn(), remove: jest.fn() }),
  chatLabel: () => 'Connected to Twitch chat',
}));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const at = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const ANNOUNCE = { enabled: true, posted: false, posting: false, error: null, dueAt: null, retry: jest.fn() };

function show(giveaway, extra = {}) {
  useControlRoom.mockReturnValue({ giveaway, announce: ANNOUNCE, ducked: false, pushWarning: jest.fn(), ...extra });
  return render(<GiveawayTab scopeRef={{ current: null }} />);
}

const OPEN = {
  id: 'g1',
  status: 'open',
  prize: 'Steam key',
  keyword: 'goof',
  startedAt: at(Date.now() - 30_000),
  closesAt: at(Date.now() + 42_000),
  entryCount: 12,
  announceLastCall: true,
  lastCallMessage: 'last call',
  lastCallAt: null,
};

beforeEach(() => {
  postAction.mockReset();
  postAction.mockResolvedValue({ ok: true, status: 200, data: {} });
});

test('idle: nothing running, and New giveaway opens the form in the panel', () => {
  show(null);
  expect(screen.getByText('Nothing running.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /new giveaway/i }));
  expect(screen.getByRole('button', { name: /start giveaway/i })).toBeTruthy();
});

test('open: countdown, entries, and Close posts close', async () => {
  show(OPEN);
  expect(screen.getByText(/type goof/i)).toBeTruthy();
  expect(screen.getByText('0012')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' }));
});

// Review Focus 4: a giveaway without a timer.
test('open without a timer: no countdown and no progress bar', () => {
  show({ ...OPEN, closesAt: null, announceLastCall: false });
  expect(screen.getByText(/no timer/i)).toBeTruthy();
  expect(screen.queryByTestId('cr-bar')).toBeNull();
  expect(screen.queryByRole('button', { name: /last call/i })).toBeNull();
});

test('Roll is disabled with nobody entered', () => {
  show({ ...OPEN, entryCount: 0 });
  expect(screen.getByRole('button', { name: /roll/i }).disabled).toBe(true);
});

test('closed: End asks before ending', async () => {
  show({ ...OPEN, status: 'closed' });
  fireEvent.click(screen.getByRole('button', { name: /end/i }));
  expect(postAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /end with no winner/i }));
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('end', { id: 'g1' }));
});

test('a lost roll race reads as plain text', async () => {
  postAction.mockResolvedValue({ ok: false, status: 409, data: { error: 'ROLL_RACE' } });
  show({ ...OPEN, status: 'closed' });
  fireEvent.click(screen.getByRole('button', { name: /^roll$/i }));
  expect(await screen.findByText('Someone else rolled first.')).toBeTruthy();
});

test('rolling: the winner shows inline; hotkeys only count in the panel or on stage', async () => {
  const rolling = {
    ...OPEN,
    status: 'rolling',
    kind: 'item',
    targetWinners: 1,
    winners: [],
    winnerTwitchId: 'tw1',
    rolledAt: at(Date.now() - 60_000),
    winner: { twitchId: 'tw1', twitchName: 'slotgoblin', displayName: 'SlotGoblin', weight: 1, source: 'chat', registered: true },
  };
  const view = show(rolling);
  expect(screen.getAllByText('SlotGoblin').length).toBeGreaterThan(0);
  fireEvent.keyDown(window, { key: 'r' });
  await Promise.resolve();
  expect(postAction).not.toHaveBeenCalled();
  useControlRoom.mockReturnValue({ giveaway: rolling, announce: ANNOUNCE, ducked: true, pushWarning: jest.fn() });
  view.rerender(<GiveawayTab scopeRef={{ current: null }} />);
  fireEvent.keyDown(window, { key: 'r' });
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('reroll', { id: 'g1' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(postAction).not.toHaveBeenCalledWith('back', expect.anything());
});
