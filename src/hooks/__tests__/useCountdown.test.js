import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '../useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns days/hours/minutes/seconds remaining until endsAt', () => {
    const endsAt = new Date('2026-05-03T01:02:03Z').getTime();
    const { result } = renderHook(() => useCountdown(endsAt));
    expect(result.current).toEqual({ days: 2, hours: 1, minutes: 2, seconds: 3 });
  });

  it('returns zeros when endsAt is in the past', () => {
    const endsAt = new Date('2026-04-30T00:00:00Z').getTime();
    const { result } = renderHook(() => useCountdown(endsAt));
    expect(result.current).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('ticks down every second', () => {
    const endsAt = new Date('2026-05-01T00:00:10Z').getTime();
    const { result } = renderHook(() => useCountdown(endsAt));
    expect(result.current.seconds).toBe(10);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.seconds).toBe(9);
  });
});
