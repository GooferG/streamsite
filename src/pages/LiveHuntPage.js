import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Radio, Star, RadioTower } from 'lucide-react';
import { db } from '../config/firebase';
import { fmt, fmtX, computeStats, openingOrder } from '../utils/huntCalc';
import StatCell from '../components/StatCell';

export default function LiveHuntPage() {
  const { shareId } = useParams();
  const [hunt, setHunt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!shareId) return;
    const unsub = onSnapshot(
      doc(db, 'shared_hunts', shareId),
      (snap) => {
        setLoading(false);
        if (snap.exists()) {
          setHunt({ id: snap.id, ...snap.data() });
          setMissing(false);
        } else {
          setHunt(null);
          setMissing(true);
        }
      },
      (err) => {
        console.error('live sub error:', err);
        setLoading(false);
        setMissing(true);
      }
    );
    return unsub;
  }, [shareId]);

  const stats = hunt ? computeStats(hunt) : null;
  const bonuses = hunt?.bonuses ?? [];
  const gamblers = hunt?.gamblers ?? [];
  const finishBalance = hunt?.finishBalance ?? '';
  const totalBuyIns = stats?.totalBuyIns ?? 0;

  // Opening current/next (mirrors the tracker's logic).
  const order = openingOrder(bonuses);
  const opening = hunt?.phase === 'opening';
  const openingIdx = Math.min(
    Math.max(0, hunt?.openingIndex ?? 0),
    Math.max(0, order.length - 1)
  );
  const currentBonus = opening ? order[openingIdx] || null : null;
  const nextBonus = opening ? order[openingIdx + 1] || null : null;

  return (
    <div className="min-h-screen bg-zinc-broadcast text-white-body px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-eyebrow-lg text-red-destructive font-mono mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-red-destructive animate-pulse" />
          <Radio size={12} aria-hidden="true" />
          <span>Live bonus hunt</span>
        </div>

        {loading && (
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono py-16 text-center">
            Connecting…
          </p>
        )}

        {!loading && missing && (
          <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/15 mb-3 text-white/35">
              <RadioTower size={16} aria-hidden="true" />
            </div>
            <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono">
              This hunt isn’t live
            </p>
            <p className="text-sm text-white/55">The stream may have ended sharing.</p>
          </div>
        )}

        {!loading && hunt && (
          <>
            <h1 className="font-black text-white-body leading-tight tracking-[-0.02em] text-3xl sm:text-4xl mb-1">
              {hunt.name}
            </h1>
            <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono mb-6">
              {opening ? '▸ Opening slots' : '▸ Collecting bonuses'}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              <StatCell label="Start" value={fmt(stats.start)} />
              <StatCell label="Finish" value={fmt(stats.finish)} />
              <StatCell
                label="Profit"
                value={
                  stats.profit == null ? (
                    '—'
                  ) : (
                    <span className={stats.profit >= 0 ? 'text-emerald-signal' : 'text-red-destructive'}>
                      {stats.profit >= 0 ? '+' : ''}
                      {fmt(stats.profit)}
                    </span>
                  )
                }
              />
              <StatCell label="Best X" value={stats.bestX != null ? fmtX(stats.bestX) : '—'} />
            </div>

            {/* Current / next during opening */}
            {opening && currentBonus && (
              <div className="border border-purple-gamba/40 bg-purple-gamba/5 p-4 mb-6">
                <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-purple-bright font-mono">
                  Now opening
                </span>
                <p className="font-black text-white-body text-2xl leading-tight truncate mt-1">
                  {currentBonus.slot}
                </p>
                <p className="text-[11px] font-mono text-white/50 tabular-nums">
                  stake {fmt(currentBonus.stake)}
                  {currentBonus.caller ? ` · 📣 ${currentBonus.caller}` : ''}
                </p>
                {nextBonus && (
                  <p className="text-[11px] font-mono text-white/40 mt-2">
                    Next: <span className="text-white/70">{nextBonus.slot}</span>
                  </p>
                )}
              </div>
            )}

            {/* Bonus list */}
            {bonuses.length > 0 && (
              <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin] mb-6">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
                      <th className="text-left px-3 py-2 font-bold">Slot</th>
                      <th className="text-right px-3 py-2 font-bold">Stake</th>
                      <th className="text-right px-3 py-2 font-bold">Win</th>
                      <th className="text-right px-3 py-2 font-bold">X</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonuses.map((b) => {
                      const x = b.stake > 0 && b.win > 0 ? b.win / b.stake : null;
                      const isCurrent = currentBonus?.id === b.id;
                      return (
                        <tr
                          key={b.id}
                          className={`border-b border-white/5 ${isCurrent ? 'bg-purple-gamba/15' : ''}`}
                        >
                          <td className="px-3 py-2 font-bold text-white-body max-w-[200px]">
                            <span className="flex items-center gap-1.5 min-w-0">
                              {b.super && (
                                <span className="shrink-0 px-1 py-0.5 text-[8px] font-bold tracking-eyebrow-md uppercase font-mono border border-orange-admin/60 text-orange-admin leading-none">S</span>
                              )}
                              {b.fiveScat && (
                                <Star size={11} aria-label="5 scatter" className="shrink-0 fill-yellow-400 text-yellow-400" />
                              )}
                              <span className="truncate">{b.slot}</span>
                            </span>
                            {b.caller && (
                              <span className="block text-[10px] font-mono tracking-eyebrow-md uppercase text-purple-bright truncate mt-0.5">
                                📣 {b.caller}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-white/70 tabular-nums">{fmt(b.stake)}</td>
                          <td className="px-3 py-2 text-right text-white/70 tabular-nums">{b.win ? fmt(b.win) : '—'}</td>
                          <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                            {x != null ? fmtX(x) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Squad split */}
            {gamblers.length > 0 && (
              <div className="border border-white/8 overflow-x-auto [scrollbar-width:thin]">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono">
                      <th className="text-left px-3 py-2 font-bold">Name</th>
                      <th className="text-right px-3 py-2 font-bold">In for</th>
                      <th className="text-right px-3 py-2 font-bold">%</th>
                      <th className="text-right px-3 py-2 font-bold">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gamblers.map((g) => {
                      const pct = totalBuyIns > 0 ? (g.inFor / totalBuyIns) * 100 : 0;
                      const payout =
                        finishBalance !== '' && totalBuyIns > 0
                          ? (pct / 100) * Number(finishBalance)
                          : null;
                      return (
                        <tr key={g.id} className="border-b border-white/5">
                          <td className="px-3 py-2 font-bold text-white-body">{g.name}</td>
                          <td className="px-3 py-2 text-right text-white/70 tabular-nums">{fmt(g.inFor)}</td>
                          <td className="px-3 py-2 text-right text-purple-bright font-bold tabular-nums">{pct.toFixed(2)}%</td>
                          <td className="px-3 py-2 text-right font-bold text-white/70 tabular-nums">
                            {payout != null ? fmt(payout) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-center text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/25 font-mono mt-8">
              goofer.tv · live hunt
            </p>
          </>
        )}
      </div>
    </div>
  );
}
