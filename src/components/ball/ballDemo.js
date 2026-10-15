// ?demo=1 on the overlay: a fake round on a 24s loop, for placing the source
// in OBS. Balls drop in for 10s, one draw lands at 11s, then it starts over.
const NAMES = ['SlotGoblin', 'NightOwl', 'ReelRat', 'Pupper', 'SugarFan', 'BigWinz', 'CoolGuy', 'Mossy', 'DeadSpin', 'LuckyLou', 'Gizmo', 'Brick'];
const SLOTS = ['Gates of Olympus', 'Sugar Rush 1000', 'The Dog House', 'Wanted Dead or a Wild', 'Big Bass Bonanza', 'Zeus vs Hades', 'Le Bandit', 'Fire Portals', 'Mental', 'San Quentin', 'Starlight Princess', 'Fruit Party'];
const LOOP_MS = 24_000;
const DRAW_AT = 11_000;
const at = (ms) => ({ toMillis: () => ms });

export function demoFeed(elapsed, startedAt) {
  const loop = Math.floor(elapsed / LOOP_MS);
  const t = elapsed % LOOP_MS;
  const loopStart = startedAt + loop * LOOP_MS;
  const count = Math.min(NAMES.length, Math.floor(t / 800) + 1);
  const balls = NAMES.slice(0, count).map((name, i) => ({
    id: `demo-${loop}-${i}`,
    twitchId: `demo-${i}`,
    displayName: name,
    slotId: `demo-slot-${i}`,
    slotName: SLOTS[i],
    thumb: null,
    status: i === 6 && t >= DRAW_AT ? 'drawn' : 'drum',
    enteredAt: at(loopStart + i * 800),
  }));
  const rack =
    t >= DRAW_AT
      ? [{ drawNo: 1, twitchId: 'demo-6', displayName: NAMES[6], slotId: 'demo-slot-6', slotName: SLOTS[6], thumb: null, drawnAt: at(loopStart + DRAW_AT), scratched: false }]
      : [];
  const round = { id: `demo-${loop}`, status: 'open', prize: { tickets: 200, prize: { kind: 'cash', amount: 5 } }, huntId: null, rack };
  return { round, balls, ready: true, hunt: null, stale: false };
}
