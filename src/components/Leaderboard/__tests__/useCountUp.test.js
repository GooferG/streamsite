import { renderHook, act } from '@testing-library/react';
import useCountUp from '../useCountUp';

// jsdom has no rAF timing or matchMedia by default; stub both.
beforeEach(() => {
  let t = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    t += 16;
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
});
