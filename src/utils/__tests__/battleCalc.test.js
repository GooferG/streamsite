import { computeBattle, currency } from '../battleCalc';

// 3 ran players + 1 not-yet-run. Payouts 43.68, 41.76, 20. rake 10%.
const PLAYERS = [
  { id: 'a', name: 'SEPULTO', payout: 43.68, ran: true },
  { id: 'b', name: 'RENMVATO', payout: 41.76, ran: true },
  { id: 'c', name: 'IURIFISTER', payout: 20, ran: true },
  { id: 'd', name: 'UNSLOVIAK', payout: null, ran: false },
];

describe('computeBattle', () => {
  test('totalPot sums only ran payouts', () => {
    const r = computeBattle(PLAYERS, 10);
    expect(r.totalPot).toBeCloseTo(105.44, 2);
  });

  test('potAfterRake applies the rake percent', () => {
    const r = computeBattle(PLAYERS, 10);
    // 105.44 * 0.9 = 94.896
    expect(r.potAfterRake).toBeCloseTo(94.896, 3);
    expect(r.rakeAmount).toBeCloseTo(10.544, 3);
  });

  test('winner is the highest ran payout, loser the lowest', () => {
    const r = computeBattle(PLAYERS, 10);
    expect(r.winner.id).toBe('a');
    expect(r.loser.id).toBe('c');
  });

  test('counts: total / ran / left', () => {
    const r = computeBattle(PLAYERS, 10);
    expect(r.total).toBe(4);
    expect(r.ran).toBe(3);
    expect(r.left).toBe(1);
  });

  test('zero-payout player counts as ran and can be the loser', () => {
    const players = [
      { id: 'a', name: 'A', payout: 50, ran: true },
      { id: 'b', name: 'B', payout: 0, ran: true },
    ];
    const r = computeBattle(players, 10);
    expect(r.loser.id).toBe('b');
    expect(r.totalPot).toBeCloseTo(50, 2);
  });

  test('no ran players: winner/loser null, pot 0', () => {
    const r = computeBattle([{ id: 'a', payout: null, ran: false }], 10);
    expect(r.winner).toBeNull();
    expect(r.loser).toBeNull();
    expect(r.totalPot).toBe(0);
  });

  test('tie on payout: lower order index wins the tie-break', () => {
    const players = [
      { id: 'a', name: 'A', payout: 30, ran: true, order: 1 },
      { id: 'b', name: 'B', payout: 30, ran: true, order: 0 },
    ];
    const r = computeBattle(players, 10);
    expect(r.winner.id).toBe('b'); // order 0 wins tie
  });
});

describe('currency', () => {
  test('formats USD with two decimals and thousands separator', () => {
    expect(currency(1080)).toBe('$1,080.00');
    expect(currency(167.7)).toBe('$167.70');
    expect(currency(0)).toBe('$0.00');
  });
});
