import { render, screen } from '@testing-library/react';
import RollingNumber from '../RollingNumber';

function setReducedMotion(on) {
  window.matchMedia = jest.fn((query) => ({
    matches: on && query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => {
  delete window.matchMedia;
});

test('reads as the formatted number', () => {
  render(<RollingNumber value={1080} />);
  expect(screen.getByText('1,080')).toBeTruthy();
});

test('each digit gets a column moved to its digit; separators stay static', () => {
  const { container } = render(<RollingNumber value={1080} />);
  const cols = [...container.querySelectorAll('[data-digit]')];
  expect(cols.map((c) => c.getAttribute('data-digit'))).toEqual(['1', '0', '8', '0']);
  expect(cols[2].style.transform).toBe('translateY(-8em)');
});

test('reduced motion renders the plain number', () => {
  setReducedMotion(true);
  const { container } = render(<RollingNumber value={660} />);
  expect(screen.getByText('660')).toBeTruthy();
  expect(container.querySelector('[data-digit]')).toBeNull();
});

test('no value renders a dash', () => {
  render(<RollingNumber value={null} />);
  expect(screen.getByText('—')).toBeTruthy();
});
