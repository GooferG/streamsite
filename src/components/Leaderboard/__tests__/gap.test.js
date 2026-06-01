import { gapToClimb } from '../gap';

const players = [
  { position: 1, wagered: 1000 },
  { position: 2, wagered: 600 },
  { position: 3, wagered: 550 },
];

describe('gapToClimb', () => {
  it('returns 0 for the leader (index 0)', () => {
    expect(gapToClimb(players, 0)).toBe(0);
  });

  it('returns the wager difference to the player directly above', () => {
    expect(gapToClimb(players, 1)).toBe(400);
    expect(gapToClimb(players, 2)).toBe(50);
  });

  it('returns 0 when the player above is missing or out of range', () => {
    expect(gapToClimb(players, 99)).toBe(0);
    expect(gapToClimb([], 0)).toBe(0);
  });
});
