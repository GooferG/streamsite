import { render, screen } from '@testing-library/react';
import StaffLayer from '../StaffLayer';
import { useControlRoom } from '../../../contexts/ControlRoomContext';

jest.mock('../../../contexts/ControlRoomContext', () => ({ useControlRoom: jest.fn() }));
jest.mock('../ControlRoom', () => () => require('react').createElement('p', null, 'panel body'));
jest.mock('../StageMoment', () => () => require('react').createElement('p', null, 'stage body'));

const staff = (prefs = {}) => ({ enabled: true, prefs: { stage: false, hideLiveBadge: false, ...prefs } });

// Final review M2: the shell hands the control room context to this layer
// alone; what it renders must match what App.js rendered before.
test('viewers get the LIVE badge and nothing else', () => {
  useControlRoom.mockReturnValue(null);
  render(<StaffLayer isLive streamData={null} pathname="/" />);
  expect(screen.getByText(/goofer live now/i)).toBeTruthy();
  expect(screen.queryByText('panel body')).toBeNull();
});

test('staff get the panel and, with Stage on, the stage; the badge can be hidden', async () => {
  useControlRoom.mockReturnValue(staff({ stage: true, hideLiveBadge: true }));
  render(<StaffLayer isLive streamData={null} pathname="/gamba/hunts" />);
  expect(await screen.findByText('panel body')).toBeTruthy();
  expect(await screen.findByText('stage body')).toBeTruthy();
  expect(screen.queryByText(/goofer live now/i)).toBeNull();
});

test('/admin keeps the badge and gets no panel or stage', () => {
  useControlRoom.mockReturnValue(staff({ stage: true }));
  render(<StaffLayer isLive streamData={null} pathname="/admin/giveaways" />);
  expect(screen.getByText(/goofer live now/i)).toBeTruthy();
  expect(screen.queryByText('panel body')).toBeNull();
  expect(screen.queryByText('stage body')).toBeNull();
});
