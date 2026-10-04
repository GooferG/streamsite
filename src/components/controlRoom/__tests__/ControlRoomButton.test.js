import { render, screen, fireEvent } from '@testing-library/react';
import ControlRoomButton from '../ControlRoomButton';

test('idle: a plain Control room button', () => {
  const onClick = jest.fn();
  render(<ControlRoomButton giveaway={null} onClick={onClick} />);
  fireEvent.click(screen.getByRole('button', { name: /control room/i }));
  expect(onClick).toHaveBeenCalled();
});

test('live: shows the entry count and status', () => {
  render(<ControlRoomButton giveaway={{ status: 'closed', prize: 'Key', entryCount: 12 }} onClick={() => {}} />);
  expect(screen.getByRole('button', { name: /12 entries, closed/i })).toBeTruthy();
});

test('On Air: signal while a giveaway runs, never orange, data hook kept', () => {
  const { container } = render(
    <ControlRoomButton giveaway={{ status: 'open', prize: 'Key', entryCount: 37 }} onClick={() => {}} />
  );
  const btn = screen.getByRole('button', { name: /37 entries, live/i });
  expect(btn.className).toContain('text-onair-signal-light');
  expect(btn.hasAttribute('data-control-room-button')).toBe(true);
  expect(btn.getAttribute('aria-keyshortcuts')).toBe('`');
  expect(container.innerHTML).not.toMatch(/orange|animate-ping/);
});
