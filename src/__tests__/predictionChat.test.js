import { openedMessage, lockedMessage, resultsMessage } from '../../api/_lib/predictionChat';

const CH = {
  source: 'communityhunts',
  bonusHuntSnapshot: { currency: 'USD', totalCost: 1200, bonusCount: 14 },
};

test('opened message lists bonuses and cost from the snapshot', () => {
  expect(openedMessage(CH)).toBe(
    'Predictions are open! Guess the final payout of the hunt (14 bonuses, $1,200 in). Closest guess wins. goofer.tv/gamba/hunts'
  );
});

test('opened message for a manual round with a cost', () => {
  expect(openedMessage({ source: 'manual', manualTotalCost: 500 })).toBe(
    'Predictions are open! Guess the final payout of the hunt ($500 in). Closest guess wins. goofer.tv/gamba/hunts'
  );
});

test('opened message without a snapshot or cost drops the brackets', () => {
  expect(openedMessage({ source: 'manual', manualTotalCost: null })).toBe(
    'Predictions are open! Guess the final payout of the hunt. Closest guess wins. goofer.tv/gamba/hunts'
  );
});

test('locked message counts guesses', () => {
  expect(lockedMessage({ entryCount: 1 })).toBe(
    'Predictions locked. 1 guess in. Revealed at goofer.tv/gamba/hunts'
  );
  expect(lockedMessage({ entryCount: 37 })).toBe(
    'Predictions locked. 37 guesses in. Revealed at goofer.tv/gamba/hunts'
  );
});

test('results message lists winners in place order', () => {
  const round = {
    ...CH,
    actual: { payout: 1843 },
    winners: [
      { place: 2, displayName: 'viewerB', payoutGuess: 1900 },
      { place: 1, displayName: 'viewerA', payoutGuess: 1810.5 },
    ],
  };
  expect(resultsMessage(round)).toBe(
    'Final payout $1,843. 1st: viewerA ($1,810.50) · 2nd: viewerB ($1,900)'
  );
});

test('results message includes 3rd place', () => {
  const round = {
    ...CH,
    actual: { payout: 100 },
    winners: [
      { place: 1, displayName: 'a', payoutGuess: 100 },
      { place: 2, displayName: 'b', payoutGuess: 90 },
      { place: 3, twitchName: 'c', payoutGuess: 80 },
    ],
  };
  expect(resultsMessage(round)).toBe(
    'Final payout $100. 1st: a ($100) · 2nd: b ($90) · 3rd: c ($80)'
  );
});

test('results message with no winners', () => {
  expect(resultsMessage({ ...CH, actual: { payout: 1843 }, winners: [] })).toBe(
    'Final payout $1,843. No guesses this round.'
  );
});

test('results use the hunt currency', () => {
  const round = {
    source: 'communityhunts',
    bonusHuntSnapshot: { currency: 'CAD' },
    actual: { payout: 1843 },
    winners: [{ place: 1, twitchName: 'viewera', payoutGuess: 1800 }],
  };
  const text = resultsMessage(round);
  expect(text).toContain('CA$1,843');
  expect(text).toContain('1st: viewera (CA$1,800)');
});
