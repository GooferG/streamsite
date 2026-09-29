import { render, screen } from '@testing-library/react';
import LiveIndicator from '../LiveIndicator';

test('shows while live', () => {
  render(<LiveIndicator isLive streamData={null} />);
  expect(screen.getByText(/goofer live now/i)).toBeTruthy();
});

test('hidden on this screen when the operator hides it', () => {
  render(<LiveIndicator isLive streamData={null} hidden />);
  expect(screen.queryByText(/goofer live now/i)).toBeNull();
});
