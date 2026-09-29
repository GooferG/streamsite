import { render, screen, waitFor } from '@testing-library/react';
import AdminGiveawaysPage from '../AdminGiveawaysPage';
import { useControlRoom } from '../../contexts/ControlRoomContext';
import { postAction } from '../../components/admin/giveaways/api';

jest.mock('../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../config/firebase', () => ({ db: {} }));
const mockRows = {};
jest.mock('firebase/firestore', () => ({
  collection: (_db, ...parts) => parts.join('/'),
  query: (ref) => ref,
  orderBy: () => null,
  limit: () => null,
  where: () => null,
  onSnapshot: (path, next) => {
    const rows = mockRows[path] || [];
    next({ empty: rows.length === 0, docs: rows.map((row) => ({ id: row.id, data: () => row })) });
    return () => {};
  },
}));
jest.mock('../../components/admin/giveaways/api', () => ({
  postAction: jest.fn(),
  QUIET_ANNOUNCE: ['disabled', 'empty', 'already'],
}));
jest.mock('../../components/admin/giveaways/EventSubStatus', () => ({
  __esModule: true,
  default: () => null,
  useEventSubStatus: () => ({ status: 'enabled', subs: [], busy: false, error: null, subscribe: jest.fn(), remove: jest.fn() }),
  chatLabel: () => 'Connected to Twitch chat',
}));

const at = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const EXPIRED = {
  id: 'g1',
  status: 'open',
  prize: 'Steam key',
  title: 'Friday',
  keyword: 'goof',
  closesAt: at(Date.now() - 1000),
  autoRoll: true,
  entryCount: 3,
  createdAt: at(1),
};
const IDLE_ANNOUNCE = { enabled: false, posted: false, posting: false, error: null, dueAt: null, retry: jest.fn() };

beforeEach(() => {
  postAction.mockReset();
  postAction.mockResolvedValue({ ok: true, status: 200, data: {} });
  mockRows.giveaways = [EXPIRED];
});

test('shows control room warnings at the top and leaves the clock to the provider', async () => {
  useControlRoom.mockReturnValue({
    enabled: true,
    warnings: [{ id: 1, message: 'Auto-roll failed: NO_ENTRIES', sticky: true }],
    dismissWarning: jest.fn(),
    pushWarning: jest.fn(),
    announce: IDLE_ANNOUNCE,
  });
  render(<AdminGiveawaysPage />);
  expect(screen.getByText('Auto-roll failed: NO_ENTRIES')).toBeTruthy();
  await new Promise((r) => setTimeout(r, 30));
  expect(postAction).not.toHaveBeenCalled();
});

test('without a provider the page still runs its own clock', async () => {
  useControlRoom.mockReturnValue(null);
  render(<AdminGiveawaysPage />);
  await waitFor(() => expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' }));
});
