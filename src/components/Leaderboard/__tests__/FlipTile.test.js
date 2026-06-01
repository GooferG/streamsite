import { render, screen } from '@testing-library/react';
import FlipTile from '../FlipTile';

describe('FlipTile', () => {
  it('renders the current value', () => {
    render(<FlipTile value="07" />);
    expect(screen.getByText('07')).toBeTruthy();
  });

  it('shows the new value after a value change (and does not throw)', () => {
    const { rerender, container } = render(<FlipTile value="07" />);
    rerender(<FlipTile value="08" />);
    // Static layer always carries the current value.
    expect(container.textContent).toContain('08');
    // While animating, the old value rides the folding top leaf.
    expect(container.querySelector('.ftile-top')).toBeTruthy();
    expect(container.querySelector('.ftile-bottom')).toBeTruthy();
  });

  it('is undefined-safe (renders without crashing when value is missing)', () => {
    expect(() => render(<FlipTile value={undefined} />)).not.toThrow();
  });

  it('accepts numeric values', () => {
    render(<FlipTile value={42} />);
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('under prefers-reduced-motion, swaps instantly with no folding leaves', () => {
    const original = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation((q) => ({
      matches: true,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }));
    try {
      const { rerender, container } = render(<FlipTile value="07" />);
      rerender(<FlipTile value="08" />);
      // New value shows immediately (no 450ms stale-then-jump)...
      expect(container.textContent).toContain('08');
      expect(container.textContent).not.toContain('07');
      // ...and the folding leaves never mount.
      expect(container.querySelector('.ftile-top')).toBeNull();
      expect(container.querySelector('.ftile-bottom')).toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });
});
