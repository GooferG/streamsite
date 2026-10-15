import { useRef } from 'react';

// Goofer Ball moments (a draw, the winner card) are timed off the server's
// drawnAt / settledAt. An OBS or Stage browser whose clock is off by more than
// the reveal would drop or cut them short, so a moment that arrives LIVE is
// anchored to this browser's arrival time instead (utils/ball drawMoment /
// winnerMoment take `anchors`).
//
// The first snapshot seen for a round anchors nothing: after a reload the
// server timestamps are all we have, and an old draw must never replay. It
// resets when the round id changes. Returns one stable object per hook
// instance, `{ draws: Map<drawNo, localMs>, settle: localMs | null }`, updated
// in render (idempotently, so strict mode's double render is harmless).
export default function useMomentAnchors(round) {
  const store = useRef(null);
  if (store.current === null) {
    store.current = { anchors: { draws: new Map(), settle: null }, id: null, seen: new Set(), status: null, settledSeen: false };
  }
  const s = store.current;
  const id = round ? round.id : null;
  if (id !== s.id) {
    s.id = id;
    s.anchors.draws.clear();
    s.anchors.settle = null;
    s.seen = new Set();
    s.settledSeen = false;
    s.status = null;
    if (round) {
      // First snapshot for this round: remember what is already there.
      for (const e of round.rack || []) s.seen.add(e.drawNo);
      s.settledSeen = round.status === 'settled';
      s.status = round.status;
    }
    return s.anchors;
  }
  if (!round) return s.anchors;
  const now = Date.now();
  for (const e of round.rack || []) {
    if (s.seen.has(e.drawNo)) continue;
    s.seen.add(e.drawNo);
    s.anchors.draws.set(e.drawNo, now);
  }
  if (round.status === 'settled' && !s.settledSeen) {
    s.settledSeen = true;
    s.anchors.settle = now;
  }
  s.status = round.status;
  return s.anchors;
}
