import { act, render, waitFor } from '@testing-library/react';
import { doc, onSnapshot } from 'firebase/firestore';
import useRoundEntries from '../useRoundEntries';
import useMyEntry from '../useMyEntry';
import usePredictionRound from '../usePredictionRound';
import useHunt, { __resetHuntCacheForTests } from '../useHunt';

jest.mock('../../../config/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: jest.fn(() => ({})),
  query: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: jest.fn(),
}));
let mockIsStaff = false;
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ isStaff: mockIsStaff }),
}));

function Probe({ hook, onValue }) {
  onValue(hook());
  return null;
}

const ROUND = { id: 'r1', status: 'open', acceptPredictions: true, entryCount: 37, source: 'manual' };

beforeEach(() => {
  mockIsStaff = false;
  onSnapshot.mockReset();
  onSnapshot.mockImplementation(() => () => {});
  doc.mockClear();
  __resetHuntCacheForTests();
});

describe('useRoundEntries (sealing guarantees)', () => {
  test('viewers never query entries while the round is open', () => {
    let value;
    render(<Probe hook={() => useRoundEntries(ROUND)} onValue={(v) => { value = v; }} />);
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(value).toEqual({ entries: [], sealed: true });
  });

  test('staff subscribe while open', () => {
    mockIsStaff = true;
    render(<Probe hook={() => useRoundEntries(ROUND)} onValue={() => {}} />);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  test('the listener starts once the round locks and delivers entries', () => {
    onSnapshot.mockImplementation((q, next) => {
      next({ docs: [{ id: 'a', data: () => ({ payoutGuess: 10 }) }] });
      return () => {};
    });
    let value;
    render(<Probe hook={() => useRoundEntries({ ...ROUND, status: 'locked' })} onValue={(v) => { value = v; }} />);
    expect(value).toEqual({ entries: [{ id: 'a', payoutGuess: 10 }], sealed: false });
  });

  // Review Focus 2: an admin re-opens a locked round.
  test('re-opening a locked round unsubscribes and reseals', () => {
    const unsub = jest.fn();
    onSnapshot.mockImplementation(() => unsub);
    let value;
    const { rerender } = render(<Probe hook={() => useRoundEntries({ ...ROUND, status: 'locked' })} onValue={(v) => { value = v; }} />);
    rerender(<Probe hook={() => useRoundEntries(ROUND)} onValue={(v) => { value = v; }} />);
    expect(unsub).toHaveBeenCalledTimes(1);
    expect(value.sealed).toBe(true);
  });

  test('a permission error counts as sealed', () => {
    onSnapshot.mockImplementation((q, next, error) => {
      error(new Error('permission-denied'));
      return () => {};
    });
    let value;
    render(<Probe hook={() => useRoundEntries({ ...ROUND, status: 'locked' })} onValue={(v) => { value = v; }} />);
    expect(value.sealed).toBe(true);
  });
});

test('useMyEntry listens to hunts/{id}/entries/{twitchId}', () => {
  onSnapshot.mockImplementation((ref, next) => {
    next({ exists: () => true, id: 'viewer1', data: () => ({ payoutGuess: 2450 }) });
    return () => {};
  });
  let value;
  render(<Probe hook={() => useMyEntry('r1', 'viewer1')} onValue={(v) => { value = v; }} />);
  expect(doc).toHaveBeenCalledWith({}, 'hunts', 'r1', 'entries', 'viewer1');
  expect(value).toEqual({ id: 'viewer1', payoutGuess: 2450 });
});

test('usePredictionRound is undefined until the first snapshot, then the round or null', () => {
  let push;
  onSnapshot.mockImplementation((q, next) => {
    push = next;
    return () => {};
  });
  const seen = [];
  render(<Probe hook={usePredictionRound} onValue={(v) => seen.push(v)} />);
  expect(seen[0]).toBeUndefined();
  act(() => push({ empty: true, docs: [] }));
  expect(seen[seen.length - 1]).toBeNull();
});

describe('useHunt', () => {
  test('a summary that already carries bonuses is used as is', () => {
    global.fetch = jest.fn();
    let value;
    const live = { id: 'h1', bonuses: [] };
    render(<Probe hook={() => useHunt('h1', live)} onValue={(v) => { value = v; }} />);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(value).toEqual({ hunt: live, loading: false, error: null });
  });

  test('otherwise the detail is fetched once and cached', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ hunt: { id: 'h2', bonuses: [{ slot: 'Pug Life' }] } }) })
    );
    let value;
    const { unmount } = render(<Probe hook={() => useHunt('h2', { id: 'h2' })} onValue={(v) => { value = v; }} />);
    expect(value).toEqual({ hunt: { id: 'h2' }, loading: true, error: null });
    await waitFor(() => expect(value.hunt.bonuses).toHaveLength(1));
    expect(global.fetch).toHaveBeenCalledWith('/api/communityhunts?view=hunt&id=h2');
    unmount();
    render(<Probe hook={() => useHunt('h2', { id: 'h2' })} onValue={(v) => { value = v; }} />);
    expect(value.hunt.bonuses).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('a failed fetch reports an error and keeps the summary', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
    let value;
    render(<Probe hook={() => useHunt('h3', { id: 'h3' })} onValue={(v) => { value = v; }} />);
    await waitFor(() => expect(value.error).toBe('Could not load this hunt’s bonuses.'));
    expect(value.hunt).toEqual({ id: 'h3' });
    expect(value.loading).toBe(false);
  });

  test('no hunt id returns the summary without fetching', () => {
    global.fetch = jest.fn();
    let value;
    render(<Probe hook={() => useHunt(null, null)} onValue={(v) => { value = v; }} />);
    expect(value).toEqual({ hunt: null, loading: false, error: null });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
