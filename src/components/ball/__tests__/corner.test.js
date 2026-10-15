import { act, render, renderHook, screen } from '@testing-library/react';
import { EMPTY_TOASTS, TOAST_MS, enqueueToast, shiftToast, useToasts } from '../toastQueue';
import CornerBox from '../CornerBox';
import RackBoard from '../RackBoard';

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const t = (n) => ({ id: `t${n}`, name: `V${n}`, slotName: `Slot ${n}`, kind: 'new' });

test('the toast queue keeps the head plus four waiting, then folds the rest', () => {
  let s = EMPTY_TOASTS;
  for (let i = 1; i <= 6; i += 1) s = enqueueToast(s, t(i));
  expect(s.items.map((x) => x.id)).toEqual(['t1', 't2', 't3', 't4', 't5']);
  expect(s.extra).toBe(1);
  s = shiftToast(s);
  expect(s.items.map((x) => x.id)).toEqual(['t2', 't3', 't4', 't5', 'more-1']);
  expect(s.items[4].more).toBe(1);
  expect(s.extra).toBe(0);
  expect(s.shifts).toBe(1);
});

test('a sustained rush grows ONE "+N more" toast', () => {
  let s = EMPTY_TOASTS;
  for (let i = 1; i <= 6; i += 1) s = enqueueToast(s, t(i));
  s = shiftToast(s);
  for (let i = 7; i <= 12; i += 1) s = enqueueToast(s, t(i));
  expect(s.items.filter((x) => x.more)).toHaveLength(1);
  expect(s.items[4].more).toBe(7);
  expect(s.extra).toBe(0);
});

describe('useToasts', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('shows one at a time for TOAST_MS', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push(t(1));
      result.current.push(t(2));
    });
    expect(result.current.toast.id).toBe('t1');
    act(() => jest.advanceTimersByTime(TOAST_MS));
    expect(result.current.toast.id).toBe('t2');
    act(() => jest.advanceTimersByTime(TOAST_MS));
    expect(result.current.toast).toBeNull();
  });

  test('the same toast pushed twice does not freeze the queue', () => {
    const { result } = renderHook(() => useToasts());
    const A = t(1);
    const B = t(2);
    act(() => {
      result.current.push(A);
      result.current.push(A);
      result.current.push(B);
    });
    for (let i = 0; i < 3; i += 1) act(() => jest.advanceTimersByTime(TOAST_MS));
    expect(result.current.toast).toBeNull();
  });
});

const ROUND = {
  id: 'r1',
  status: 'open',
  prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } },
  rack: [{ drawNo: 1, slotName: 'Gates of Olympus', displayName: 'CoolGuy', scratched: false }],
};
const BALLS = [
  { id: 'a', status: 'drum' },
  { id: 'b', status: 'drum' },
  { id: 'c', status: 'drawn' },
];

test('corner box: count, command, prize, rack and the toast', () => {
  render(<CornerBox round={ROUND} balls={BALLS} toast={{ id: 'x', name: 'SugarFan', slotName: 'Sugar Rush 1000', kind: 'new' }} />);
  expect(screen.getByText('2 balls')).toBeTruthy();
  expect(screen.getByText('!slot <slot name>')).toBeTruthy();
  expect(screen.getByText('CH 42 · Top multi wins 200 tickets + $5')).toBeTruthy();
  expect(screen.getByText('01')).toBeTruthy();
  expect(screen.getByText('@SugarFan called')).toBeTruthy();
  expect(screen.getByText('Sugar Rush 1000')).toBeTruthy();
});

test('corner box: the toast sits above at the bottom, below at the top', () => {
  const toast = { id: 'x', name: 'A', slotName: 'B', kind: 'new' };
  const { rerender } = render(<CornerBox round={ROUND} balls={BALLS} toast={toast} />);
  expect(screen.getByText('@A called').parentElement.className).toContain('bottom-full');
  rerender(<CornerBox round={ROUND} balls={BALLS} toast={toast} position="left-8 top-8" />);
  expect(screen.getByText('@A called').parentElement.className).toContain('top-full');
});

test('corner box shows a dash until the data is ready', () => {
  render(<CornerBox round={ROUND} balls={[]} ready={false} />);
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.queryByText('0 balls')).toBeNull();
});

test('corner box when closed, and a "+N more" toast', () => {
  render(<CornerBox round={{ ...ROUND, status: 'closed' }} balls={[]} toast={{ id: 'm', more: 3 }} />);
  expect(screen.getByText('Drum closed · results after the hunt')).toBeTruthy();
  expect(screen.getByText('+3 more called in')).toBeTruthy();
});

test('rack board: leader highlighted, pending dashes, footer by status', () => {
  const rows = [
    { drawNo: 1, slotName: 'Gates of Olympus', displayName: 'CoolGuy', multiplier: 412, thumb: null },
    { drawNo: 2, slotName: 'Sugar Rush 1000', displayName: 'SugarFan', multiplier: null, thumb: null },
  ];
  const { rerender } = render(<RackBoard round={ROUND} rows={rows} />);
  expect(document.body.textContent).toContain('Leader @CoolGuy · 412x');
  expect(screen.getByText('Gates of Olympus').closest('li').className).toContain('bg-onair-winner-pale');
  expect(screen.getByText('Sugar Rush 1000').closest('li').className).not.toContain('bg-onair-winner-pale');
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.getByText('Type !slot <slot name> to call one in')).toBeTruthy();
  rerender(<RackBoard round={{ ...ROUND, status: 'closed' }} rows={rows} stale />);
  expect(screen.getByText('Drum closed · top multi wins 200 tickets + $5 · stale')).toBeTruthy();
  rerender(<RackBoard round={ROUND} rows={rows} stale />);
  expect(screen.getByText('Type !slot <slot name> to call one in · stale')).toBeTruthy();
});

const many = (n) =>
  Array.from({ length: n }, (_, i) => ({ drawNo: i + 1, slotName: `Slot ${i + 1}`, displayName: `V${i + 1}`, multiplier: i === 1 ? 900 : i + 1, thumb: null }));

test('rack board caps rows, pins a leader who fell off, and counts the rest', () => {
  render(<RackBoard round={ROUND} rows={many(12)} />);
  const items = screen.getAllByRole('listitem');
  expect(items).toHaveLength(9);
  expect(items[0].textContent).toContain('Slot 2');
  expect(items[0].className).toContain('bg-onair-winner-pale');
  expect(items.slice(1, 8).map((li) => li.textContent.slice(0, 2))).toEqual(['06', '07', '08', '09', '10', '11', '12']);
  expect(items[8].textContent).toBe('+4 earlier');
});

test('rack board with few rows has no "earlier" row', () => {
  render(<RackBoard round={ROUND} rows={many(5)} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(5);
  expect(screen.queryByText(/earlier/)).toBeNull();
});

test('corner box shows a scratched draw struck through, muted', () => {
  const round = { ...ROUND, rack: [...ROUND.rack, { drawNo: 2, slotName: 'Le Bandit', displayName: 'Pupper', scratched: true }] };
  render(<CornerBox round={round} balls={BALLS} />);
  const chip = screen.getByText('02');
  expect(chip.className).toContain('line-through');
  expect(chip.className).toContain('opacity-50');
  expect(screen.getByText('01').className).not.toContain('line-through');
});

test('rack board lists a scratched draw struck through with the word Scratched', () => {
  const round = { ...ROUND, rack: [...ROUND.rack, { drawNo: 2, slotName: 'Le Bandit', displayName: 'Pupper', scratched: true }] };
  const rows = [{ drawNo: 1, slotName: 'Gates of Olympus', displayName: 'CoolGuy', multiplier: 412, thumb: null }];
  render(<RackBoard round={round} rows={rows} />);
  const items = screen.getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[1].textContent).toContain('Scratched');
  expect(screen.getByText('Le Bandit').className).toContain('line-through');
});

test('rack board counts scratched rows toward the eight-row cap', () => {
  const rack = Array.from({ length: 10 }, (_, i) => ({ drawNo: i + 1, slotName: `Slot ${i + 1}`, displayName: `V${i + 1}`, scratched: i === 9 }));
  render(<RackBoard round={{ ...ROUND, rack }} rows={many(9)} />);
  const items = screen.getAllByRole('listitem');
  expect(items).toHaveLength(9);
  expect(items[7].textContent).toContain('Scratched');
  expect(items[8].textContent).toBe('+2 earlier');
});

test('dimming never touches a row or chip container: the card stays opaque over the stream', () => {
  const rack = Array.from({ length: 10 }, (_, i) => ({ drawNo: i + 1, slotName: `Slot ${i + 1}`, displayName: `V${i + 1}`, scratched: i === 9 }));
  const { unmount } = render(<RackBoard round={{ ...ROUND, rack }} rows={many(9)} />);
  screen.getAllByRole('listitem').forEach((li) => expect(li.className).not.toMatch(/opacity-/));
  unmount();
  render(<CornerBox round={{ ...ROUND, rack: [{ drawNo: 2, slotName: 'X', displayName: 'Y', scratched: true }] }} balls={BALLS} />);
  expect(screen.getByText('02').closest('li').className).not.toMatch(/opacity-/);
});
