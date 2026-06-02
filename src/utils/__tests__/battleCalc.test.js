import { computeBattle, currency } from '../battleCalc';

// 3 ran players + 1 not-yet-run. Payouts 43.68, 41.76, 20.
// Entry fee $20, rake 10%.
const PLAYERS = [
  { id: 'a', name: 'SEPULTO', payout: 43.68, ran: true },
  { id: 'b', name: 'RENMVATO', payout: 41.76, ran: true },
  { id: 'c', name: 'IURIFISTER', payout: 20, ran: true },
  { id: 'd', name: 'UNSLOVIAK', payout: null, ran: false },
];
const OPTS = { rakePct: 10, entryFee: 20 };

describe('computeBattle — pot from entry fees', () => {
  test('totalPot = entryFee × player count (all players, ran or not)', () => {
    const r = computeBattle(PLAYERS, OPTS);
    // 20 × 4 = 80
    expect(r.totalPot).toBeCloseTo(80, 2);
  });

  test('potAfterRake applies the rake percent to the fee pot', () => {
    const r = computeBattle(PLAYERS, OPTS);
    // 80 × 0.9 = 72
    expect(r.potAfterRake).toBeCloseTo(72, 2);
    expect(r.rakeAmount).toBeCloseTo(8, 2);
  });

  test('totalPayouts sums ran payouts (for display/ranking, NOT the pot)', () => {
    const r = computeBattle(PLAYERS, OPTS);
    expect(r.totalPayouts).toBeCloseTo(105.44, 2);
  });

  test('winner is the highest ran payout, loser the lowest', () => {
    const r = computeBattle(PLAYERS, OPTS);
    expect(r.winner.id).toBe('a');
    expect(r.loser.id).toBe('c');
  });

  test('counts: total / ran / left', () => {
    const r = computeBattle(PLAYERS, OPTS);
    expect(r.total).toBe(4);
    expect(r.ran).toBe(3);
    expect(r.left).toBe(1);
  });

  test('entryFee 0 → pot 0 regardless of payouts', () => {
    const r = computeBattle(PLAYERS, { rakePct: 10, entryFee: 0 });
    expect(r.totalPot).toBe(0);
    expect(r.potAfterRake).toBe(0);
  });

  test('zero-payout player counts as ran and can be the loser', () => {
    const players = [
      { id: 'a', name: 'A', payout: 50, ran: true },
      { id: 'b', name: 'B', payout: 0, ran: true },
    ];
    const r = computeBattle(players, OPTS);
    expect(r.loser.id).toBe('b');
    expect(r.totalPayouts).toBeCloseTo(50, 2);
    expect(r.totalPot).toBeCloseTo(40, 2); // 20 × 2 players
  });

  test('no players: winner/loser null, pot 0', () => {
    const r = computeBattle([], OPTS);
    expect(r.winner).toBeNull();
    expect(r.loser).toBeNull();
    expect(r.totalPot).toBe(0);
  });

  test('tie on payout: lower order index wins the tie-break', () => {
    const players = [
      { id: 'a', name: 'A', payout: 30, ran: true, order: 1 },
      { id: 'b', name: 'B', payout: 30, ran: true, order: 0 },
    ];
    const r = computeBattle(players, OPTS);
    expect(r.winner.id).toBe('b'); // order 0 wins tie
  });

  test('legacy: number as 2nd arg is treated as rakePct, entryFee 0', () => {
    const r = computeBattle(PLAYERS, 10);
    expect(r.totalPot).toBe(0);
    expect(r.rakeAmount).toBe(0);
    expect(r.totalPayouts).toBeCloseTo(105.44, 2);
  });
});

describe('currency', () => {
  test('formats USD with two decimals and thousands separator', () => {
    expect(currency(1080)).toBe('$1,080.00');
    expect(currency(167.7)).toBe('$167.70');
    expect(currency(0)).toBe('$0.00');
  });
});
