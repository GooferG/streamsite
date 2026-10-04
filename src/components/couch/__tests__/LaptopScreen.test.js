import { render, screen } from '@testing-library/react';
import LaptopScreen from '../LaptopScreen';

test('a live hunt shows opened of total and money back', () => {
  render(<LaptopScreen laptop={{ mode: 'hunt', opened: 14, total: 23, back: 412, currency: null }} />);
  expect(screen.getByText('Hunt live')).toBeTruthy();
  expect(screen.getByTestId('laptop-screen').textContent).toContain('14/23');
  expect(screen.getByText('$412 back')).toBeTruthy();
});

test('a round shows its state and guesses', () => {
  render(<LaptopScreen laptop={{ mode: 'locked', guesses: 37 }} />);
  expect(screen.getByText('Predictions locked')).toBeTruthy();
  expect(screen.getByText('37 guesses')).toBeTruthy();
});

test('idle is the screensaver with the board reset', () => {
  render(<LaptopScreen laptop={{ mode: 'idle', resetsIn: 3 * 86400000 + 4 * 3600000, last: null }} />);
  expect(screen.getByText('GG')).toBeTruthy();
  expect(screen.getByText('Board resets in 3d 4h')).toBeTruthy();
  expect(screen.getByTestId('laptop-screen').getAttribute('aria-hidden')).toBe('true');
});

test('idle without a reset shows only the bug', () => {
  render(<LaptopScreen laptop={{ mode: 'idle', resetsIn: null, last: null }} />);
  expect(screen.queryByText(/Board resets/)).toBeNull();
});
