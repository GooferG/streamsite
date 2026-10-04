import { render, screen, fireEvent, act, within } from '@testing-library/react';
import RedeemTab from '../RedeemTab';
import { useControlRoom } from '../../../contexts/ControlRoomContext';
import { authedFetch } from '../../../utils/authedFetch';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../../../utils/authedFetch', () => ({ authedFetch: jest.fn() }));

const NOW = 1_700_000_000_000;
const at = (ms) => ({ toMillis: () => ms });
// The feed's order: newest first.
const FEED = [
  { id: 'r3', itemName: 'Roll a blunt', kind: 'stream', cost: 420, displayName: 'Cee', createdAt: at(NOW - 60_000) },
  {
    id: 'r2',
    itemName: 'Sunday · 1st place',
    kind: 'prediction',
    cost: 0,
    displayName: 'Bee',
    note: '$50 cash',
    createdAt: at(NOW - 5 * 60_000),
  },
  { id: 'r1', itemName: 'Pick a Slot', kind: 'stream', cost: 1500, displayName: 'Ay', createdAt: at(NOW - 2 * 3_600_000) },
];

let cr;
function show(overrides = {}) {
  const { prefs, ...rest } = overrides;
  cr = {
    redemptions: FEED,
    redeem: { pending: FEED.length, unseen: 0, capped: false },
    prefs: { stage: false, hideLiveBadge: false, redeemFilter: 'all', ...prefs },
    ducked: false,
    markRedeemSeen: jest.fn(),
    setRedeemFilter: jest.fn(),
    ...rest,
  };
  useControlRoom.mockReturnValue(cr);
  return render(<RedeemTab />);
}
const ok = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
const rowOf = (name) => screen.getByText(name).closest('li');
const sentBody = (i) => JSON.parse(authedFetch.mock.calls[i][1].body);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  authedFetch.mockImplementation(ok);
});
afterEach(() => jest.useRealTimers());

test('rows read oldest first, with who, age and price', () => {
  show();
  const names = screen.getAllByRole('listitem').map((li) => li.querySelector('.cr-red-item').textContent);
  expect(names).toEqual(['Pick a Slot', 'Sunday · 1st place', 'Roll a blunt']);
  expect(rowOf('Pick a Slot').textContent).toMatch('Ay · 2h ago · 1500t');
  expect(rowOf('Sunday · 1st place').textContent).toMatch('Bee · 5m ago');
  expect(rowOf('Sunday · 1st place').textContent).not.toMatch(/\b0t\b/);
  expect(rowOf('Sunday · 1st place').textContent).toMatch('$50 cash');
});

test('filter chips show their counts and switch the filter', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Stream 2' }));
  expect(cr.setRedeemFilter).toHaveBeenCalledWith('stream');
});

test('the payouts filter shows only prize rows', () => {
  show({ prefs: { redeemFilter: 'payouts' } });
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('Sunday · 1st place')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Payouts 1' }).getAttribute('aria-pressed')).toBe('true');
});

test('Fulfill sends the note typed in the expanded row', async () => {
  show();
  fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: /pick a slot/i }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Note for Pick a Slot' }), { target: { value: 'played it' } });
  await act(async () => {
    fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfill' }));
  });
  expect(authedFetch).toHaveBeenCalledWith('/api/admin/redemptions', expect.objectContaining({ method: 'POST' }));
  expect(sentBody(0)).toEqual({ id: 'r1', action: 'fulfill', note: 'played it' });
});

test('Refund needs a second press within 4s', async () => {
  show();
  const row = rowOf('Pick a Slot');
  fireEvent.click(within(row).getByRole('button', { name: 'Refund' }));
  expect(authedFetch).not.toHaveBeenCalled();
  act(() => {
    jest.advanceTimersByTime(500);
  });
  await act(async () => {
    fireEvent.click(within(row).getByRole('button', { name: /Confirm refund/ }));
  });
  expect(sentBody(0)).toEqual({ id: 'r1', action: 'cancel', note: null });
});

test('a double click on Refund does not confirm it', () => {
  show();
  const row = rowOf('Pick a Slot');
  fireEvent.click(within(row).getByRole('button', { name: 'Refund' }));
  fireEvent.click(within(row).getByRole('button', { name: /Confirm refund/ }), { detail: 2 });
  expect(authedFetch).not.toHaveBeenCalled();
});

test('a confirm press within 400ms of arming sends nothing and stays armed', () => {
  show();
  const row = rowOf('Pick a Slot');
  fireEvent.click(within(row).getByRole('button', { name: 'Refund' }));
  act(() => {
    jest.advanceTimersByTime(300);
  });
  fireEvent.click(within(row).getByRole('button', { name: /Confirm refund/ }));
  expect(authedFetch).not.toHaveBeenCalled();
  expect(within(row).getByRole('button', { name: /Confirm refund/ })).toBeTruthy();
});

test('pressing Fulfill disarms an armed Refund', () => {
  authedFetch.mockImplementation(() => new Promise(() => {}));
  show();
  const row = rowOf('Pick a Slot');
  fireEvent.click(within(row).getByRole('button', { name: 'Refund' }));
  fireEvent.click(within(row).getByRole('button', { name: 'Fulfill' }));
  const refund = within(row).getByRole('button', { name: 'Refund' });
  expect(refund.disabled).toBe(true);
});

test('a note typed on a collapsed row is not sent with its next action', async () => {
  show();
  fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: /pick a slot/i }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Note for Pick a Slot' }), { target: { value: 'hidden' } });
  fireEvent.click(within(rowOf('Roll a blunt')).getByRole('button', { name: /roll a blunt/i }));
  await act(async () => {
    fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfill' }));
  });
  expect(sentBody(0)).toEqual({ id: 'r1', action: 'fulfill', note: null });
});

test('an armed Refund counts down and disarms after 4s', () => {
  show();
  const row = rowOf('Pick a Slot');
  fireEvent.click(within(row).getByRole('button', { name: 'Refund' }));
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(within(row).getByRole('button', { name: 'Confirm refund · 3s' })).toBeTruthy();
  act(() => {
    jest.advanceTimersByTime(3000);
  });
  fireEvent.click(within(row).getByRole('button', { name: 'Refund' }));
  expect(authedFetch).not.toHaveBeenCalled();
});

// Review Focus 1: a double click during a busy stream sends one request.
test('a row is busy while its request runs, and a double click sends once', async () => {
  let resolve;
  authedFetch.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  show();
  fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfill' }));
  fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfilling…' }));
  expect(authedFetch).toHaveBeenCalledTimes(1);
  expect(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfilling…' }).disabled).toBe(true);
  expect(within(rowOf('Roll a blunt')).getByRole('button', { name: 'Fulfill' }).disabled).toBe(false);
  await act(async () => {
    resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

test('errors show under their row in plain words', async () => {
  authedFetch.mockImplementation(() =>
    Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'NOT_PENDING' }) })
  );
  show();
  await act(async () => {
    fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfill' }));
  });
  expect(within(rowOf('Pick a Slot')).getByRole('alert').textContent).toBe('Already handled by someone else.');
  expect(within(rowOf('Roll a blunt')).queryByRole('alert')).toBeNull();
});

test('a network failure says try again', async () => {
  authedFetch.mockImplementation(() => Promise.reject(new Error('offline')));
  show();
  await act(async () => {
    fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfill' }));
  });
  expect(within(rowOf('Pick a Slot')).getByRole('alert').textContent).toBe("Didn't go through. Try again.");
});

// Review Focus 4: another mod handles the row mid-request.
test('a row handled elsewhere leaves cleanly, even mid-request', async () => {
  let resolve;
  authedFetch.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const view = show();
  fireEvent.click(within(rowOf('Pick a Slot')).getByRole('button', { name: 'Fulfill' }));
  cr = { ...cr, redemptions: FEED.slice(0, 2), redeem: { pending: 2, unseen: 0, capped: false } };
  useControlRoom.mockReturnValue(cr);
  view.rerender(<RedeemTab />);
  expect(screen.queryByText('Pick a Slot')).toBeNull();
  await act(async () => {
    resolve({ ok: false, json: () => Promise.resolve({ error: 'NOT_PENDING' }) });
  });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});

test('empty and filtered-empty copy', () => {
  const view = show({ redemptions: [], redeem: { pending: 0, unseen: 0, capped: false } });
  expect(screen.getByText('Nothing waiting.')).toBeTruthy();
  view.unmount();
  show({ redemptions: [FEED[1]], prefs: { redeemFilter: 'stream' } });
  expect(screen.getByText('Nothing in stream.')).toBeTruthy();
});

test('a full feed says the rest are in admin', () => {
  show({ redeem: { pending: 50, unseen: 0, capped: true } });
  expect(screen.getByText('Showing newest 50 · rest in admin')).toBeTruthy();
});

test('on screen means seen, unless a stage moment has the panel ducked', () => {
  const view = show();
  expect(cr.markRedeemSeen).toHaveBeenCalledWith(NOW - 60_000);
  view.unmount();
  show({ ducked: true });
  expect(cr.markRedeemSeen).not.toHaveBeenCalled();
});

// Review Focus 5: an old doc with no kind, name, avatar or price.
test('an old doc still renders with fallbacks', () => {
  show({ redemptions: [{ id: 'x', itemName: 'Mystery', userId: 'u123', createdAt: at(NOW) }] });
  const row = rowOf('Mystery');
  expect(row.textContent).toMatch('ITEM');
  expect(row.textContent).toMatch('u123 · just now');
  expect(row.textContent).not.toMatch(/\dt\b/);
});
