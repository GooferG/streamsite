import { render, screen } from '@testing-library/react';
import PredictionWinnersReveal from '../PredictionWinnersReveal';

const base = { status: 'settled', source: 'manual', actual: { payout: 1000 } };

test('shows the prize label of a settled winner', () => {
  render(
    <PredictionWinnersReveal
      round={{
        ...base,
        winners: [
          {
            place: 1,
            twitchId: 'a',
            displayName: 'viewerA',
            payoutGuess: 990,
            diff: 10,
            prize: { tickets: 100, kind: 'bonus', amount: 20, label: 'Bonus buy $20' },
          },
        ],
      }}
    />
  );
  expect(screen.getByText('Bonus buy $20')).toBeTruthy();
  expect(screen.getByText('+100 tickets')).toBeTruthy();
});

test('falls back to the legacy cashLabel', () => {
  render(
    <PredictionWinnersReveal
      round={{
        ...base,
        winners: [
          {
            place: 1,
            twitchId: 'a',
            displayName: 'viewerA',
            payoutGuess: 990,
            diff: 10,
            prize: { tickets: null, cashLabel: '$25 PayPal' },
          },
        ],
      }}
    />
  );
  expect(screen.getByText('$25 PayPal')).toBeTruthy();
});
