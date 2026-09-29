import { renderHook, act } from '@testing-library/react';
import useGiveawayClock from '../useGiveawayClock';
import { postAction } from '../api';

jest.mock('../api', () => ({
  postAction: jest.fn(),
  QUIET_ANNOUNCE: ['disabled', 'empty', 'already'],
}));

const NOW = 1_700_000_000_000;
const at = (ms) => ({ toMillis: () => ms });
const ok = (data = {}) => Promise.resolve({ ok: true, status: 200, data });
const fail = (error) => Promise.resolve({ ok: false, status: 400, data: { error } });

function giveaway(overrides = {}) {
  return {
    id: 'g1',
    status: 'open',
    closesAt: at(NOW + 60_000),
    announceLastCall: true,
    lastCallAt: null,
    autoRoll: true,
    entryCount: 3,
    ...overrides,
  };
}

async function flush() {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

async function advance(ms) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await flush();
  });
}

function run(list, options) {
  const onWarn = jest.fn();
  const view = renderHook(({ l, o }) => useGiveawayClock(l, onWarn, o), {
    initialProps: { l: list, o: options },
  });
  return { onWarn, ...view };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  postAction.mockReset();
  postAction.mockImplementation(() => ok());
});

afterEach(() => jest.useRealTimers());

const calls = (action) => postAction.mock.calls.filter(([a]) => a === action);

test('posts last call once, inside the T-30s window', async () => {
  run([giveaway()]);
  await advance(29_000); // 31s left: too early
  expect(calls('lastCall')).toHaveLength(0);
  await advance(2_000); // 29s left
  expect(postAction).toHaveBeenCalledWith('lastCall', { id: 'g1' });
  await advance(5_000);
  expect(calls('lastCall')).toHaveLength(1);
});

test('skips last call when it is off or already posted', async () => {
  run([
    giveaway({ id: 'a', announceLastCall: false }),
    giveaway({ id: 'b', lastCallAt: at(NOW) }),
  ]);
  await advance(35_000);
  expect(calls('lastCall')).toHaveLength(0);
});

test('warns when last call did not post in chat', async () => {
  postAction.mockImplementation((action) =>
    action === 'lastCall' ? ok({ announce: { posted: false, reason: 'chat down' } }) : ok()
  );
  const { onWarn } = run([giveaway({ closesAt: at(NOW + 20_000) })]);
  await act(async () => {
    await flush();
  });
  expect(onWarn).toHaveBeenCalledWith("Last call didn't post in chat: chat down");
});

test('closes at zero and auto-rolls when there are entries', async () => {
  run([giveaway({ closesAt: at(NOW + 2_000) })]);
  await advance(2_000);
  expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' });
  expect(postAction).toHaveBeenCalledWith('roll', { id: 'g1' });
});

test('does not roll with zero entries, and says so', async () => {
  const { onWarn } = run([giveaway({ closesAt: at(NOW + 1_000), entryCount: 0 })]);
  await advance(1_000);
  expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' });
  expect(calls('roll')).toHaveLength(0);
  expect(onWarn).toHaveBeenCalledWith('Time ran out with no entries, so nothing was rolled.');
});

test('warns when the auto-roll fails', async () => {
  postAction.mockImplementation((action) => (action === 'roll' ? fail('NO_ENTRIES') : ok()));
  const { onWarn } = run([giveaway({ closesAt: at(NOW + 1_000) })]);
  await advance(1_000);
  expect(onWarn).toHaveBeenCalledWith('Auto-roll failed: NO_ENTRIES');
});

test('does not roll when its own close failed (someone else closed it)', async () => {
  postAction.mockImplementation((action) => (action === 'close' ? fail('NOT_OPEN') : ok()));
  run([giveaway({ closesAt: at(NOW + 1_000) })]);
  await advance(1_000);
  expect(calls('roll')).toHaveLength(0);
});

// Final review I2: the auto-roll the giveaway asked for did not happen, so
// the operator hears about it instead of finding it silently skipped.
test('closes, but never rolls, a timer that ran out long ago', async () => {
  const { onWarn } = run([giveaway({ closesAt: at(NOW - 60_000) })]);
  await act(async () => {
    await flush();
  });
  expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' });
  expect(calls('roll')).toHaveLength(0);
  expect(onWarn).toHaveBeenCalledWith('The timer closed late, so nothing was rolled. Roll by hand.');
});

test('a late close without auto-roll stays quiet', async () => {
  const { onWarn } = run([giveaway({ closesAt: at(NOW - 60_000), autoRoll: false })]);
  await act(async () => {
    await flush();
  });
  expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' });
  expect(onWarn).not.toHaveBeenCalled();
});

test('ignores giveaways without a timer or not open', async () => {
  run([
    giveaway({ closesAt: null }),
    giveaway({ id: 'g2', status: 'closed', closesAt: at(NOW - 1) }),
  ]);
  await advance(5_000);
  expect(postAction).not.toHaveBeenCalled();
});

test('does nothing while not armed', async () => {
  run([giveaway({ closesAt: at(NOW + 1_000) })], { armed: false });
  await advance(5_000);
  expect(postAction).not.toHaveBeenCalled();
});

test('starts driving when armed flips on', async () => {
  const { rerender } = run([giveaway({ closesAt: at(NOW + 1_000) })], { armed: false });
  await advance(2_000);
  expect(postAction).not.toHaveBeenCalled();
  rerender({ l: [giveaway({ closesAt: at(NOW + 1_000) })], o: { armed: true } });
  await act(async () => {
    await flush();
  });
  expect(postAction).toHaveBeenCalledWith('close', { id: 'g1' });
});

test('a lost roll race is not a warning', async () => {
  postAction.mockImplementation((action) =>
    action === 'roll' ? Promise.resolve({ ok: false, status: 409, data: { error: 'ROLL_RACE' } }) : ok()
  );
  const { onWarn } = run([giveaway({ closesAt: at(NOW + 1_000) })]);
  await advance(1_000);
  expect(onWarn).not.toHaveBeenCalled();
});
