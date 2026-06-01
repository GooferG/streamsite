import { renderHook, act } from '@testing-library/react';
import useCountUp from '../useCountUp';

// jsdom has no rAF timing or matchMedia by default; stub both.
beforeEach(() => {
  let t = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    t += 16; // ~60fps frame (ms)
    return setTimeout(() => cb(t), 0);
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => clearTimeout(id));
});

afterEach(() => {
  jest.restoreAllMocks();
});

function mockReducedMotion(reduce) {
  window.matchMedia = jest.fn().mockImplementation((q) => ({
    matches: reduce,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
}

describe('useCountUp', () => {
  it('returns the target immediately under prefers-reduced-motion', () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => useCountUp(1000, { durationMs: 1500, delayMs: 0 }));
    expect(result.current).toBe(1000);
  });

  it('starts below target and settles at exactly the target when motion is allowed', async () => {
    mockReducedMotion(false);
    jest.useFakeTimers();
    const { result } = renderHook(() => useCountUp(1000, { durationMs: 200, delayMs: 0 }));
    // Initial value before the ramp completes is below the target.
    expect(result.current).toBeLessThan(1000);
    // Advance well past duration + delay so the ramp settles.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1000);
    jest.useRealTimers();
  });

  it('guards undefined/null target to 0 (no NaN)', () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => useCountUp(undefined));
    expect(result.current).toBe(0);
  });

  it('ramps from the previous value (not 0) when target changes', async () => {
    mockReducedMotion(false);
    jest.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ t }) => useCountUp(t, { durationMs: 200, delayMs: 0 }),
      { initialProps: { t: 1000 } },
    );
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1000); // settled at A

    rerender({ t: 2000 }); // target changes to B
    // immediately after the change, value must be at/above the previous settled
    // value (ramping A->B), never reset toward 0
    expect(result.current).toBeGreaterThanOrEqual(1000);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(2000); // settled at B
    jest.useRealTimers();
  });

  it('continues from the on-screen value when target changes mid-ramp', async () => {
    mockReducedMotion(false);
    jest.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ t }) => useCountUp(t, { durationMs: 200, delayMs: 0 }),
      { initialProps: { t: 1000 } },
    );
    // Advance partway so ramp A is still IN FLIGHT (the 45s live-poll case): the
    // displayed value is between 0 and the target, and has NOT settled yet.
    await act(async () => {
      jest.advanceTimersByTime(80);
    });
    const midFlight = result.current;
    expect(midFlight).toBeGreaterThan(0);
    expect(midFlight).toBeLessThan(1000);

    rerender({ t: 2000 }); // target changes to B before A settled
    // Advance one frame so the new ramp's first tick runs (React flushes the
    // effect, then the rAF mock fires). With the buggy hook this drops to 0
    // because it starts from the last *settled* value (0); the fix continues
    // from the on-screen value, so it must never go backward below midFlight.
    await act(async () => {
      jest.advanceTimersByTime(16);
    });
    expect(result.current).toBeGreaterThanOrEqual(midFlight);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(2000); // settled at B
    jest.useRealTimers();
  });
});
