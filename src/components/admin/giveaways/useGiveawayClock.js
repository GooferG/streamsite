import { useEffect, useRef } from 'react';
import { AUTO_ROLL_GRACE_MS, LAST_CALL_SECONDS, tsMillis } from '../../../utils/giveaway';
import { postAction, QUIET_ANNOUNCE } from './api';

// Runs the entry timer (only in the tab that drives, see useDriverLock): posts
// the last call, closes entries at zero, and rolls when the giveaway asked
// for it. EventSub already refuses late entries on its own, so a missed tick
// only delays the status flip.
export default function useGiveawayClock(list, onWarn, { armed = true } = {}) {
  const listRef = useRef(list);
  listRef.current = list;
  const fired = useRef(new Set());
  const timed = list.some((g) => g.status === 'open' && g.closesAt);

  useEffect(() => {
    if (!timed || !armed) return undefined;
    const tick = async () => {
      const now = Date.now();
      for (const g of listRef.current) {
        if (g.status !== 'open') continue;
        const closesAt = tsMillis(g.closesAt);
        if (!closesAt) continue;

        const lcKey = `lastCall:${g.id}`;
        if (
          g.announceLastCall &&
          !g.lastCallAt &&
          now >= closesAt - LAST_CALL_SECONDS * 1000 &&
          now < closesAt - 3000 &&
          !fired.current.has(lcKey)
        ) {
          fired.current.add(lcKey);
          postAction('lastCall', { id: g.id })
            .then(({ data }) => {
              const a = data.announce;
              if (a && a.posted === false && !QUIET_ANNOUNCE.includes(a.reason)) {
                onWarn(`Last call didn't post in chat: ${a.reason}`);
              }
            })
            .catch(() => {});
        }

        const closeKey = `close:${g.id}`;
        if (now >= closesAt && !fired.current.has(closeKey)) {
          fired.current.add(closeKey);
          const closed = await postAction('close', { id: g.id }).catch(() => ({ ok: false }));
          // Only auto-roll when we watched the clock run out, not when the
          // page is opened long after the timer ended.
          if (closed.ok && g.autoRoll && now - closesAt < AUTO_ROLL_GRACE_MS) {
            if ((g.entryCount ?? 0) === 0) {
              onWarn('Time ran out with no entries, so nothing was rolled.');
            } else {
              const rolled = await postAction('roll', { id: g.id }).catch(() => ({ ok: false, data: {} }));
              // ROLL_RACE: someone rolled it by hand at the same moment. Fine.
              if (!rolled.ok && rolled.data?.error !== 'ROLL_RACE') {
                onWarn(`Auto-roll failed: ${rolled.data?.error || 'unknown'}`);
              }
            }
          }
        }
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [timed, armed, onWarn]);
}
