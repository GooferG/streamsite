import { render, act } from '@testing-library/react';
import { onSnapshot } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import { ControlRoomProvider, useControlRoom } from '../ControlRoomContext';
import { useAuth } from '../AuthContext';
import { useDriverLock } from '../../hooks/useDriverLock';
import { postAction } from '../../components/admin/giveaways/api';

jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({ useLocation: jest.fn() }));
jest.mock('../../hooks/useDriverLock', () => ({ useDriverLock: jest.fn() }));
jest.mock('../../config/firebase', () => ({ db: {} }));
const mockData = {};
jest.mock('firebase/firestore', () => ({
  collection: (_db, ...parts) => parts.join('/'),
  where: () => null,
  orderBy: () => null,
  limit: () => null,
  query: (ref) => ref,
  onSnapshot: jest.fn(),
}));
jest.mock('../../components/admin/giveaways/api', () => ({
  postAction: jest.fn(),
  QUIET_ANNOUNCE: ['disabled', 'empty', 'already'],
}));

const at = (ms) => ({ toMillis: () => ms });
let latest;
function Probe() {
  latest = useControlRoom();
  return null;
}
const mount = () => render(<ControlRoomProvider><Probe /></ControlRoomProvider>);

beforeEach(() => {
  latest = undefined;
  localStorage.clear();
  onSnapshot.mockImplementation((path, next) => {
    next({ docs: (mockData[path] || []).map((row) => ({ id: row.id, data: () => row })) });
    return () => {};
  });
  postAction.mockImplementation(() => Promise.resolve({ ok: true, status: 200, data: {} }));
  Object.keys(mockData).forEach((k) => delete mockData[k]);
  useLocation.mockReturnValue({ pathname: '/' });
  useAuth.mockReturnValue({ isStaff: true });
  useDriverLock.mockReturnValue({ isDriver: true, supported: true });
});

test('useControlRoom is null outside a provider', () => {
  render(<Probe />);
  expect(latest).toBeNull();
});

test('viewers get a disabled control room with no subscriptions', () => {
  useAuth.mockReturnValue({ isStaff: false });
  mount();
  expect(latest.enabled).toBe(false);
  expect(onSnapshot).not.toHaveBeenCalled();
  // Final review T8: viewers never get a localStorage key either.
  expect(localStorage.getItem('goofer:control-room')).toBeNull();
});

test('OBS overlay routes never run it', () => {
  useLocation.mockReturnValue({ pathname: '/giveaway-overlay' });
  mount();
  expect(latest.enabled).toBe(false);
  expect(onSnapshot).not.toHaveBeenCalled();
});

test('staff subscribe to live giveaways, recent rounds and pending redemptions', () => {
  mockData.giveaways = [
    { id: 'g2', status: 'open' },
    { id: 'g1', status: 'rolling', winnerTwitchId: 'tw', rolledAt: at(1) },
  ];
  mockData.hunts = [{ id: 'r1', status: 'locked', acceptPredictions: true }];
  mount();
  expect(onSnapshot.mock.calls.map(([path]) => path).sort()).toEqual(['giveaways', 'hunts', 'redemptions']);
  expect(latest.enabled).toBe(true);
  expect(latest.giveaway.id).toBe('g1');
  expect(latest.activeRound.id).toBe('r1');
  expect(latest.latestRound.id).toBe('r1');
});

test('panel state and prefs persist per browser', () => {
  const view = mount();
  act(() => latest.panelActions.open());
  act(() => latest.setStage(true));
  expect(latest.panel.mode).toBe('float');
  expect(JSON.parse(localStorage.getItem('goofer:control-room')).stage).toBe(true);
  view.unmount();
  mount();
  expect(latest.panel.mode).toBe('float');
  expect(latest.prefs.stage).toBe(true);
});

test('minimize and close remember where to reopen', () => {
  mount();
  act(() => latest.panelActions.dock());
  act(() => latest.panelActions.minimize());
  expect(latest.panel.mode).toBe('pill');
  act(() => latest.panelActions.open());
  expect(latest.panel.mode).toBe('dock');
  act(() => latest.panelActions.close());
  act(() => latest.panelActions.toggle());
  expect(latest.panel.mode).toBe('dock');
  act(() => latest.panelActions.toggle());
  expect(latest.panel.mode).toBe('pill');
});

test('a passenger tab never runs the giveaway clock', async () => {
  useDriverLock.mockReturnValue({ isDriver: false, supported: true });
  mockData.giveaways = [{ id: 'g1', status: 'open', closesAt: at(Date.now() - 1000), autoRoll: true, entryCount: 2 }];
  mount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(postAction).not.toHaveBeenCalled();
});

test('the driving tab runs it', async () => {
  mockData.giveaways = [{ id: 'g1', status: 'open', closesAt: at(Date.now() - 1000), autoRoll: true, entryCount: 2 }];
  mount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' });
});

test('pushWarning adds a warning, dismissWarning removes it', () => {
  mount();
  act(() => latest.pushWarning('Auto-roll failed: X', { sticky: true }));
  expect(latest.warnings.map((w) => w.message)).toEqual(['Auto-roll failed: X']);
  act(() => latest.dismissWarning(latest.warnings[0].id));
  expect(latest.warnings).toEqual([]);
});

const STORE_KEY = 'goofer:control-room';
const stored = () => JSON.parse(localStorage.getItem(STORE_KEY));

test('a first run counts the redemption backlog as seen', () => {
  mockData.redemptions = [
    { id: 'r2', createdAt: at(2000) },
    { id: 'r1', createdAt: at(1000) },
  ];
  mount();
  expect(latest.redemptions.map((r) => r.id)).toEqual(['r2', 'r1']);
  expect(latest.redeem).toEqual({ pending: 2, unseen: 0, capped: false });
  expect(stored().redeemSeenAt).toBe(2000);
});

test('a newer redemption is unseen until the tab marks it seen', () => {
  let push;
  mockData.redemptions = [{ id: 'r1', createdAt: at(1000) }];
  const base = onSnapshot.getMockImplementation();
  onSnapshot.mockImplementation((path, next, error) => {
    if (path === 'redemptions') push = next;
    return base(path, next, error);
  });
  mount();
  act(() =>
    push({
      docs: [
        { id: 'r2', data: () => ({ createdAt: at(3000) }) },
        { id: 'r1', data: () => ({ createdAt: at(1000) }) },
      ],
    })
  );
  expect(latest.redeem).toEqual({ pending: 2, unseen: 1, capped: false });
  act(() => latest.markRedeemSeen(3000));
  expect(latest.redeem.unseen).toBe(0);
  act(() => latest.markRedeemSeen(500));
  expect(stored().redeemSeenAt).toBe(3000);
});

test('a browser that already tracks redemptions keeps its mark', () => {
  localStorage.setItem(STORE_KEY, JSON.stringify({ redeemSeenAt: 1500 }));
  mockData.redemptions = [
    { id: 'r2', createdAt: at(2000) },
    { id: 'r1', createdAt: at(1000) },
  ];
  mount();
  expect(latest.redeem.unseen).toBe(1);
});

test('an empty queue baselines to now', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(5000);
  try {
    mount();
    expect(stored().redeemSeenAt).toBe(5000);
  } finally {
    now.mockRestore();
  }
});

test('a full feed is flagged as capped', () => {
  mockData.redemptions = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, createdAt: at(1000 + i) }));
  mount();
  expect(latest.redeem.capped).toBe(true);
});

test('a redemptions feed error counts as lost data', () => {
  const base = onSnapshot.getMockImplementation();
  onSnapshot.mockImplementation((path, next, error) => {
    if (path === 'redemptions') {
      error(new Error('denied'));
      return () => {};
    }
    return base(path, next, error);
  });
  mount();
  expect(latest.dataLost).toBe(true);
});

test('the redeem filter persists and ignores unknown values', () => {
  mount();
  act(() => latest.setRedeemFilter('payouts'));
  expect(latest.prefs.redeemFilter).toBe('payouts');
  act(() => latest.setRedeemFilter('nope'));
  expect(latest.prefs.redeemFilter).toBe('payouts');
  expect(stored().redeemFilter).toBe('payouts');
});

test('resize actions store the size, and reset clears it', () => {
  mount();
  act(() => latest.panelActions.resizeTo({ x: 10, y: 80 }, { w: 500, h: null }));
  act(() => latest.panelActions.setDockW(600));
  expect(latest.panel).toMatchObject({ rect: { x: 10, y: 80 }, size: { w: 500, h: null }, dockW: 600 });
  act(() => latest.panelActions.resetPosition());
  expect(latest.panel).toMatchObject({ mode: 'float', rect: null, size: null, dockW: null });
});
