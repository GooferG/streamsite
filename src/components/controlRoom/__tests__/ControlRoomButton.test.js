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
