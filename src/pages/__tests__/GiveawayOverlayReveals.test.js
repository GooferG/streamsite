import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GiveawayOverlay from '../GiveawayOverlay';
import { useGiveawayFeed } from '../../hooks/useGiveawayFeed';
import useBroadcastSettings from '../../hooks/useBroadcastSettings';

jest.mock('../../hooks/useGiveawayFeed', () => ({ useGiveawayFeed: jest.fn() }));
jest.mock('../../hooks/useBroadcastSettings', () => jest.fn());
jest.mock('../../components/giveaway/RevealStage', () => () => require('react').createElement('p', null, 'reveal stage'));

const at = (ms) => ({ toMillis: () => ms });
const ROLLING = {
  id: 'g1',
  title: 'Test giveaway',
  status: 'rolling',
  keyword: 'GOOF',
  prize: 'Bonus buy $50',
  entryCount: 3,
  winners: [],
  winnerTwitchId: 'w1',
  winner: { twitchId: 'w1', displayName: 'Winner' },
  rolledAt: at(Date.now() - 1000),
};

function show(reveals, ready = true) {
  useGiveawayFeed.mockReturnValue({ giveaway: ROLLING, entries: [], firstMessage: null });
  useBroadcastSettings.mockReturnValue({ reveals, ready });
  return render(
    <MemoryRouter initialEntries={['/giveaway-overlay']}>
      <GiveawayOverlay />
    </MemoryRouter>
  );
}

test('OBS mode plays the reveal', () => {
  show('overlay');
  expect(screen.getByText('reveal stage')).toBeTruthy();
});

test('Stage mode: the OBS overlay skips the full-screen reveal', () => {
  show('stage');
  expect(screen.queryByText('reveal stage')).toBeNull();
  expect(screen.getByText('Bonus buy $50')).toBeTruthy();
});

test('the mode not known yet: OBS holds the full-screen reveal', () => {
  show('overlay', false);
  expect(screen.queryByText('reveal stage')).toBeNull();
});
