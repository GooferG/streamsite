import { renderHook, act } from '@testing-library/react';
import { useWarnings } from '../useWarnings';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

test('a sticky warning survives four later non-sticky warnings', () => {
  const { result } = renderHook(() => useWarnings());
  act(() => {
    result.current.pushWarning('Auto-roll failed: timeout', { sticky: true });
  });
  act(() => {
    result.current.pushWarning('warn 1');
    result.current.pushWarning('warn 2');
    result.current.pushWarning('warn 3');
    result.current.pushWarning('warn 4');
  });
  const sticky = result.current.warnings.find((w) => w.message === 'Auto-roll failed: timeout');
  expect(sticky).toBeTruthy();
  expect(sticky.sticky).toBe(true);
});

test('only the newest 3 non-sticky warnings remain', () => {
  const { result } = renderHook(() => useWarnings());
  act(() => {
    result.current.pushWarning('warn 1');
    result.current.pushWarning('warn 2');
    result.current.pushWarning('warn 3');
    result.current.pushWarning('warn 4');
  });
  expect(result.current.warnings.map((w) => w.message)).toEqual(['warn 2', 'warn 3', 'warn 4']);
});

test('a non-sticky warning auto-dismisses after 8000ms while a sticky one does not', () => {
  const { result } = renderHook(() => useWarnings());
  act(() => {
    result.current.pushWarning('sticky one', { sticky: true });
    result.current.pushWarning('temp one');
  });
  expect(result.current.warnings.map((w) => w.message)).toEqual(['sticky one', 'temp one']);
  act(() => {
    jest.advanceTimersByTime(8000);
  });
  expect(result.current.warnings.map((w) => w.message)).toEqual(['sticky one']);
});

test('pushing the same message twice leaves one entry', () => {
  const { result } = renderHook(() => useWarnings());
  act(() => {
    result.current.pushWarning('duplicate');
    result.current.pushWarning('duplicate');
  });
  expect(result.current.warnings.map((w) => w.message)).toEqual(['duplicate']);
});
