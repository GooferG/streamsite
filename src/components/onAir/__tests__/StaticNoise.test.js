import { render, screen } from '@testing-library/react';
import StaticNoise from '../StaticNoise';

test('static is decorative and takes a test id, class and style', () => {
  render(<StaticNoise testId="tv-static" className="absolute inset-0" style={{ top: 57 }} />);
  const el = screen.getByTestId('tv-static');
  expect(el.getAttribute('aria-hidden')).toBe('true');
  expect(el.className).toMatch(/absolute inset-0/);
  expect(el.style.top).toBe('57px');
});
