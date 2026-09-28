import {
  activeRoundOf,
  controlRoomAllowed,
  currentPickOf,
  panelAllowed,
  pickConfirmed,
  shownGiveaway,
} from '../selectors';

const at = (ms) => ({ toMillis: () => ms });

test('an older rolling giveaway wins over a newer open one', () => {
  const list = [
    { id: 'new', status: 'open' },
    { id: 'old', status: 'rolling' },
  ];
  expect(shownGiveaway(list).id).toBe('old');
});

test('playing beats open, open beats closed, empty is null', () => {
  expect(shownGiveaway([{ id: 'c', status: 'closed' }, { id: 'p', status: 'playing' }]).id).toBe('p');
  expect(shownGiveaway([{ id: 'c', status: 'closed' }, { id: 'o', status: 'open' }]).id).toBe('o');
  expect(shownGiveaway([])).toBeNull();
});

test('the current pick needs a winner and a roll time', () => {
  expect(currentPickOf([{ id: 'a', status: 'rolling', winnerTwitchId: null, rolledAt: at(1) }])).toBeNull();
  expect(currentPickOf([{ id: 'b', status: 'playing', winnerTwitchId: 'tw', rolledAt: at(1) }]).id).toBe('b');
});

test('the active round is an open or locked prediction round', () => {
  expect(activeRoundOf([{ id: 's', status: 'open', acceptPredictions: false }])).toBeNull();
  expect(activeRoundOf([{ id: 'x', status: 'settled', acceptPredictions: true }, { id: 'l', status: 'locked', acceptPredictions: true }]).id).toBe('l');
});

test('a pick is confirmed once it is in winners', () => {
  expect(pickConfirmed({ winnerTwitchId: 'tw', winners: [{ twitchId: 'tw' }] })).toBe(true);
  expect(pickConfirmed({ winnerTwitchId: 'tw', winners: [] })).toBe(false);
  expect(pickConfirmed(null)).toBe(false);
});

test('OBS sources never run the control room; /admin runs it without the panel', () => {
  expect(controlRoomAllowed('/giveaway-overlay')).toBe(false);
  expect(controlRoomAllowed('/suggest-overlay')).toBe(false);
  expect(controlRoomAllowed('/admin/giveaways')).toBe(true);
  expect(panelAllowed('/admin/giveaways')).toBe(false);
  expect(panelAllowed('/gamba/hunts')).toBe(true);
  expect(panelAllowed('/')).toBe(true);
});
