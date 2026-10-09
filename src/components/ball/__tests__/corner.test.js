import { act, render, renderHook, screen } from '@testing-library/react';
import { EMPTY_TOASTS, TOAST_MS, enqueueToast, shiftToast, useToasts } from '../toastQueue';
import CornerBox from '../CornerBox';
import RackBoard from '../RackBoard';

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

const t = (n) => ({ id: `t${n}`, name: `V${n}`, slotName: `Slot ${n}`, kind: 'new' });

test('the toast queue folds overflow into one "+N more"', () => {
  let s = EMPTY_TOASTS;
  for (let i = 1; i <= 6; i += 1) s = enqueueToast(s, t(i));
  expect(s.items.map((x) => x.id)).toEqual(['t1', 't2', 't3', 't4']);
  expect(s.extra).toBe(2);
  s = shiftToast(s);
  expect(s.items.map((x) => x.id || x.more)).toEqual(['t2', 't3', 't4', 'more-1']);
  expect(s.items[3].more).toBe(2);
  expect(s.extra).toBe(0);
});

test('useToasts shows one at a time for TOAST_MS', () => {
  jest.useFakeTimers();
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
  jest.useRealTimers();
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
  expect(screen.getByText('Leader @CoolGuy · 412x')).toBeTruthy();
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.getByText('Type !slot <slot name> to call one in')).toBeTruthy();
  rerender(<RackBoard round={{ ...ROUND, status: 'closed' }} rows={rows} stale />);
  expect(screen.getByText('Drum closed · top multi wins 200 tickets + $5 · stale')).toBeTruthy();
});
