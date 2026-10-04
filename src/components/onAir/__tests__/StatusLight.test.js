import { render, screen } from '@testing-library/react';
import StatusLight from '../StatusLight';

test('live is the glowing red tally with a pulsing dot', () => {
  render(<StatusLight status="live" />);
  const light = screen.getByText('Live');
  expect(light.className).toContain('bg-onair-live');
  expect(light.className).toContain('shadow-onair-live');
  expect(light.querySelector('[aria-hidden="true"]').className).toContain('motion-safe:animate-onair-pulse');
});

test('children replace the label', () => {
  render(<StatusLight status="live">Live · 1.2K</StatusLight>);
  expect(screen.getByText('Live · 1.2K')).toBeTruthy();
});

test('replay is raised grey and nothing renders without a status', () => {
  const { container, rerender } = render(<StatusLight status="replay" />);
  expect(screen.getByText('Replay').className).toContain('bg-onair-surface-raised');
  rerender(<StatusLight status={null} />);
  expect(container.innerHTML).toBe('');
});
