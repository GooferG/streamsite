import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../config/firebase';

function fmt(val) {
  if (val == null || !Number.isFinite(Number(val))) return '—';
  if (val >= 1000) return `$${Math.round(val / 100) / 10}k`;
  return `$${Math.round(val)}`;
}

/**
 * A thin horizontal axis showing all viewers' payout guesses as ticks.
 * Only renders when round.kinds.payout is on and at least 2 entries exist.
 */
export default function PredictionNumberLine({ round }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!round?.id || !round?.kinds?.payout) return undefined;
    const q = query(
      collection(db, 'prediction_rounds', round.id, 'entries'),
      orderBy('submittedAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [round?.id, round?.kinds?.payout]);

  const { min, max, ticks, actualPct } = useMemo(() => {
    if (!round?.kinds?.payout || entries.length === 0) {
      return { min: 0, max: 0, ticks: [], actualPct: null };
    }
    const guesses = entries
      .map((e) => e.payoutGuess)
      .filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (guesses.length === 0) {
      return { min: 0, max: 0, ticks: [], actualPct: null };
    }
    const actual = round.actual?.payout;
    const candidates = [...guesses];
    if (typeof actual === 'number') candidates.push(actual);
    let lo = Math.min(...candidates);
    let hi = Math.max(...candidates);
    // Pad the range a bit so points aren't right on the edges.
    const pad = Math.max((hi - lo) * 0.05, hi * 0.02, 1);
    lo = Math.max(0, lo - pad);
    hi = hi + pad;
    if (hi === lo) hi = lo + 1;
    const ticksOut = entries.map((e) => ({
      id: e.id,
      twitchId: e.twitchId,
      name: e.displayName || e.twitchName,
      avatar: e.profileImageUrl || null,
      val: e.payoutGuess,
      pct: ((e.payoutGuess - lo) / (hi - lo)) * 100,
    }));
    const actualPctOut =
      typeof actual === 'number' ? ((actual - lo) / (hi - lo)) * 100 : null;
    return { min: lo, max: hi, ticks: ticksOut, actualPct: actualPctOut };
  }, [entries, round]);

  const winnersById = useMemo(() => {
    const m = {};
    (round?.winners || []).forEach((w) => {
      m[w.twitchId] = w;
    });
    return m;
  }, [round]);

  if (!round?.kinds?.payout || ticks.length < 2) return null;

  return (
    <div className="border border-white/10 bg-zinc-card/30 px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between mb-3 text-[10px] font-bold tracking-eyebrow-md uppercase font-mono">
        <span className="text-white/55">Distribution</span>
        <span className="text-white/35 tabular-nums">{ticks.length} guesses</span>
      </div>

      <div className="relative h-10 px-2">
        {/* Axis line */}
        <div
          className="absolute left-2 right-2 top-1/2 h-px bg-white/15"
          aria-hidden="true"
        />

        {/* Ticks */}
        {ticks.map((t) => {
          const winner = winnersById[t.twitchId];
          const isWinner = !!winner;
          return (
            <div
              key={t.id}
              className="group absolute top-0 bottom-0 flex flex-col items-center"
              style={{ left: `calc(${Math.max(0, Math.min(100, t.pct))}% )`, transform: 'translateX(-50%)' }}
              title={`${t.name}: ${fmt(t.val)}`}
            >
              <span
                className={`w-0.5 h-full ${
                  isWinner
                    ? winner.place === 1
                      ? 'bg-orange-admin'
                      : winner.place === 2
                        ? 'bg-white-body'
                        : 'bg-emerald-signal'
                    : 'bg-white/45'
                }`}
              />
            </div>
          );
        })}

        {/* Actual marker */}
        {actualPct != null && (
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
            style={{
              left: `calc(${Math.max(0, Math.min(100, actualPct))}% )`,
              transform: 'translateX(-50%)',
            }}
          >
            <span className="text-[8px] font-bold tracking-eyebrow-lg uppercase text-orange-admin bg-zinc-broadcast/90 px-1 py-0.5 font-mono mb-0.5">
              Actual
            </span>
            <span className="w-0.5 flex-1 bg-orange-admin" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 text-[10px] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono tabular-nums">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}
