// "Wager to climb" — how much more this player needs to pass the player directly
// above. `players` must be sorted descending by wagered (the feed already is).
// Returns 0 for the leader or any out-of-range/missing neighbor.
export function gapToClimb(players, index) {
  if (!Array.isArray(players) || index <= 0) return 0;
  const above = players[index - 1];
  const self = players[index];
  if (!above || !self) return 0;
  const diff = above.wagered - self.wagered;
  return diff > 0 ? diff : 0;
}
