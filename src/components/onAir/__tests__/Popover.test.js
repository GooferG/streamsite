import { fireEvent, render, screen } from '@testing-library/react';
import { PopoverPanel, usePopover } from '../Popover';

function Harness() {
  const p = usePopover();
  return (
    <div>
      <div {...p.wrapProps} className="relative">
        <button type="button" {...p.triggerProps}>Open</button>
        <PopoverPanel id={p.panelId} open={p.open}>
          <a href="/inside">Inside</a>
        </PopoverPanel>
      </div>
      <button type="button">Outside</button>
    </div>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Open' });

test('the trigger toggles the panel and points at it', () => {
  render(<Harness />);
  expect(trigger().getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('link', { name: 'Inside' })).toBeNull();
  fireEvent.click(trigger());
  expect(trigger().getAttribute('aria-expanded')).toBe('true');
  const link = screen.getByRole('link', { name: 'Inside' });
  expect(document.getElementById(trigger().getAttribute('aria-controls')).contains(link)).toBe(true);
});

test('Escape closes and returns focus to the trigger', () => {
  render(<Harness />);
  fireEvent.click(trigger());
  screen.getByRole('link', { name: 'Inside' }).focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger().getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger());
});

test('Escape with focus outside closes it and leaves focus where it was', () => {
  render(<Harness />);
  fireEvent.click(trigger());
  const outside = screen.getByRole('button', { name: 'Outside' });
  outside.focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger().getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(outside);
});

test('an Escape something else already handled leaves it open', () => {
  render(<Harness />);
  fireEvent.click(trigger());
  const outside = screen.getByRole('button', { name: 'Outside' });
  outside.addEventListener('keydown', (e) => e.preventDefault());
  fireEvent.keyDown(outside, { key: 'Escape' });
  expect(trigger().getAttribute('aria-expanded')).toBe('true');
});

test('a press outside closes it', () => {
  render(<Harness />);
  fireEvent.click(trigger());
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }));
  expect(trigger().getAttribute('aria-expanded')).toBe('false');
});

test('focus leaving the wrapper closes it (Tab past the last row)', () => {
  render(<Harness />);
  fireEvent.click(trigger());
  fireEvent.focusOut(screen.getByRole('link', { name: 'Inside' }), {
    relatedTarget: screen.getByRole('button', { name: 'Outside' }),
  });
  expect(trigger().getAttribute('aria-expanded')).toBe('false');
});

test('focus moving inside the wrapper keeps it open', () => {
  render(<Harness />);
  fireEvent.click(trigger());
  fireEvent.focusOut(trigger(), { relatedTarget: screen.getByRole('link', { name: 'Inside' }) });
  expect(trigger().getAttribute('aria-expanded')).toBe('true');
});
