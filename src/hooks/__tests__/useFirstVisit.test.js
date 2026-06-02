import { renderHook, act } from '@testing-library/react';
import { useFirstVisit } from '../useFirstVisit';

describe('useFirstVisit', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns seen=false on first visit, then true after markSeen', () => {
    const { result } = renderHook(() => useFirstVisit('testKey'));
    expect(result.current[0]).toBe(false);
    act(() => {
      result.current[1](); // markSeen
    });
    expect(result.current[0]).toBe(true);
  });

  it('returns seen=true when the flag is already stored', () => {
    window.localStorage.setItem('testKey', '1');
    const { result } = renderHook(() => useFirstVisit('testKey'));
    expect(result.current[0]).toBe(true);
  });

  it('treats a throwing localStorage as seen (never traps the user)', () => {
    const spy = jest
      .spyOn(window.localStorage.__proto__, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });
    const { result } = renderHook(() => useFirstVisit('testKey'));
    expect(result.current[0]).toBe(true);
    spy.mockRestore();
  });
});
