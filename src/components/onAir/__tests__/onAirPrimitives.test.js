import { fireEvent, render, screen } from '@testing-library/react';
import Panel from '../Panel';
import Chip from '../Chip';
import OnAirButton from '../OnAirButton';
import Ticket from '../Ticket';
import { fitFigure } from '../fit';

test('Panel renders as the requested element and marks lit panels', () => {
  render(
    <ul>
      <Panel as="li" radius="row" lit="winner">first</Panel>
      <Panel as="li" radius="row">second</Panel>
    </ul>
  );
  const [first, second] = screen.getAllByRole('listitem');
  expect(first.getAttribute('data-lit')).toBe('winner');
  expect(first.className).toContain('shadow-onair-lit-winner');
  expect(second.getAttribute('data-lit')).toBeNull();
  expect(second.className).toContain('shadow-onair-row');
});

test('Chip renders its content', () => {
  render(<Chip tone="signal">6 guesses in</Chip>);
  expect(screen.getByText('6 guesses in').className).toContain('text-onair-signal-light');
});

test('OnAirButton defaults to type=button and respects disabled', () => {
  const onClick = jest.fn();
  render(<OnAirButton onClick={onClick} disabled>Lock it in</OnAirButton>);
  const btn = screen.getByRole('button', { name: 'Lock it in' });
  expect(btn.getAttribute('type')).toBe('button');
  fireEvent.click(btn);
  expect(onClick).not.toHaveBeenCalled();
});

test('Ticket labels itself and renders header and body', () => {
  render(<Ticket header={<p>Call the payout</p>}><p>body</p></Ticket>);
  const slip = screen.getByRole('region', { name: 'Prediction slip' });
  expect(slip.textContent).toContain('Call the payout');
  expect(slip.textContent).toContain('body');
});

test('fitFigure sizes text to a share of the container width', () => {
  const size = fitFigure('CA$2,046.12', { min: 3.25, max: 6 });
  expect(size).toMatch(/^clamp\(3\.25rem, calc\([\d.]+cqi \* var\(--hero-share, 1\)\), 6rem\)$/);
  expect(fitFigure('Xilentdrifter', { min: 2.25, max: 3.75, share: '0.9' })).toContain('* 0.9)');
});

test('Ticket takes a label and renders a stub overlay outside the masked halves', () => {
  render(
    <Ticket label="Your wallet" header={<p>head</p>} stubOverlay={<span data-testid="ghost">−420</span>}>
      <p>body</p>
    </Ticket>
  );
  const slip = screen.getByRole('region', { name: 'Your wallet' });
  expect(screen.getByTestId('ghost').parentElement).toBe(slip);
  expect(slip.className).toContain('relative');
});

test('Chip has a small size and a loss tone', () => {
  render(<Chip size="sm" tone="loss">Refunded</Chip>);
  const chip = screen.getByText('Refunded');
  expect(chip.className).toContain('text-xs');
  expect(chip.className).toContain('text-onair-loss');
  expect(chip.className).not.toContain('px-4');
});
