import { renderHook } from '@testing-library/react';
import useMomentAnchors from '../useMomentAnchors';

const entry = (drawNo) => ({ drawNo, slotId: `s${drawNo}`, scratched: false });

describe('useMomentAnchors', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });
  afterEach(() => Date.now.mockRestore());

  test('the first snapshot for a round anchors nothing', () => {
    const { result } = renderHook(({ round }) => useMomentAnchors(round), {
      initialProps: { round: { id: 'r1', status: 'open', rack: [entry(1)] } },
    });
    expect(result.current.draws.size).toBe(0);
    expect(result.current.settle).toBeNull();
  });

  test('a new drawNo is anchored to its arrival time, once', () => {
    const { result, rerender } = renderHook(({ round }) => useMomentAnchors(round), {
      initialProps: { round: { id: 'r1', status: 'open', rack: [entry(1)] } },
    });
    Date.now.mockReturnValue(5000);
    rerender({ round: { id: 'r1', status: 'open', rack: [entry(1), entry(2)] } });
    expect(result.current.draws.get(2)).toBe(5000);
    expect(result.current.draws.has(1)).toBe(false);
    Date.now.mockReturnValue(9000);
    rerender({ round: { id: 'r1', status: 'open', rack: [entry(1), entry(2)] } });
    expect(result.current.draws.get(2)).toBe(5000);
  });

  test('settling anchors the winner moment; a reload of a settled round does not', () => {
    const { result, rerender } = renderHook(({ round }) => useMomentAnchors(round), {
      initialProps: { round: { id: 'r1', status: 'closed', rack: [entry(1)] } },
    });
    Date.now.mockReturnValue(7000);
    rerender({ round: { id: 'r1', status: 'settled', rack: [entry(1)] } });
    expect(result.current.settle).toBe(7000);
    const reload = renderHook(() => useMomentAnchors({ id: 'r2', status: 'settled', rack: [entry(1)] }));
    expect(reload.result.current.settle).toBeNull();
  });

  test('a different round id resets everything', () => {
    const { result, rerender } = renderHook(({ round }) => useMomentAnchors(round), {
      initialProps: { round: { id: 'r1', status: 'open', rack: [] } },
    });
    rerender({ round: { id: 'r1', status: 'open', rack: [entry(1)] } });
    expect(result.current.draws.size).toBe(1);
    rerender({ round: { id: 'r2', status: 'open', rack: [entry(1)] } });
    expect(result.current.draws.size).toBe(0);
    rerender({ round: null });
    expect(result.current.draws.size).toBe(0);
  });
});
