import {
  getBaselinePlayers,
  applyDeltas,
  generatePollDeltas,
} from '../mockData';

describe('getBaselinePlayers', () => {
  it('returns exactly 20 players', () => {
    expect(getBaselinePlayers()).toHaveLength(20);
  });

  it('returns players sorted by wagered descending', () => {
    const players = getBaselinePlayers();
    for (let i = 0; i < players.length - 1; i += 1) {
      expect(players[i].wagered).toBeGreaterThanOrEqual(players[i + 1].wagered);
    }
  });

  it('places P01 strictly ahead of P02', () => {
    const [p1, p2] = getBaselinePlayers();
    expect(p1.wagered).toBeGreaterThan(p2.wagered);
  });

  it('every player has the expected shape', () => {
    const players = getBaselinePlayers();
    players.forEach((p) => {
      expect(typeof p.id).toBe('string');
      expect(typeof p.username).toBe('string');
      expect(p.username.length).toBeGreaterThan(0);
      expect(typeof p.wagered).toBe('number');
      expect(p.wagered).toBeGreaterThan(0);
    });
  });

  it('player ids are unique', () => {
    const ids = getBaselinePlayers().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns identical data across calls (deterministic)', () => {
    const a = getBaselinePlayers();
    const b = getBaselinePlayers();
    expect(a).toEqual(b);
  });
});

describe('applyDeltas', () => {
  it('adds deltas to the matching players by id and re-sorts', () => {
    const players = [
      { id: 'a', username: 'A', wagered: 100 },
      { id: 'b', username: 'B', wagered: 50 },
    ];
    const next = applyDeltas(players, { b: 200 });
    expect(next[0].id).toBe('b');
    expect(next[0].wagered).toBe(250);
    expect(next[1].id).toBe('a');
    expect(next[1].wagered).toBe(100);
  });

  it('leaves unaffected players untouched', () => {
    const players = [
      { id: 'a', username: 'A', wagered: 100 },
      { id: 'b', username: 'B', wagered: 50 },
    ];
    const next = applyDeltas(players, { a: 10 });
    expect(next.find((p) => p.id === 'b').wagered).toBe(50);
  });

  it('returns a new array (does not mutate input)', () => {
    const players = [{ id: 'a', username: 'A', wagered: 100 }];
    const next = applyDeltas(players, { a: 1 });
    expect(next).not.toBe(players);
    expect(players[0].wagered).toBe(100);
  });
});

describe('generatePollDeltas', () => {
  it('returns an object keyed by player id with positive integer values', () => {
    const players = getBaselinePlayers();
    const deltas = generatePollDeltas(players, { seed: 42 });
    Object.entries(deltas).forEach(([id, value]) => {
      expect(players.find((p) => p.id === id)).toBeDefined();
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    });
  });

  it('affects between 1 and 3 players per poll', () => {
    const players = getBaselinePlayers();
    const deltas = generatePollDeltas(players, { seed: 42 });
    const count = Object.keys(deltas).length;
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(3);
  });

  it('is deterministic when seeded', () => {
    const players = getBaselinePlayers();
    const a = generatePollDeltas(players, { seed: 7 });
    const b = generatePollDeltas(players, { seed: 7 });
    expect(a).toEqual(b);
  });
});
