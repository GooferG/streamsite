import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { Radio, RadioTower } from 'lucide-react';
import { db } from '../config/firebase';
import { fmt, fmtX, computeStats, openingOrder } from '../utils/huntCalc';
import StatCell from '../components/StatCell';
import ScatterPill from '../components/ScatterPill';

export default function LiveHuntPage() {
  const { shareId } = useParams();
  const [hunt, setHunt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  // Connection health: last successful snapshot time + a transient error flag,
  // kept distinct from `missing` (a genuinely absent/ended hunt).
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connError, setConnError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!shareId) return;
    const unsub = onSnapshot(
      doc(db, 'shared_hunts', shareId),
      (snap) => {
        setLoading(false);
        setConnError(false);
        setLastUpdate(Date.now());
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
        setConnError(true);
      }
    );
    return unsub;
  }, [shareId]);

  // Tick so the "Xs ago" staleness recomputes once a second.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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

  const openedCount = bonuses.filter((b) => (Number(b.win) || 0) > 0).length;
  const bonusCount = bonuses.length;

  // Stale if no snapshot has landed in a while. Drives a calmer eyebrow + stops
  // the live pulse so frozen data never looks confidently live.
  const STALE_MS = 20000;
  const ageMs = lastUpdate ? now - lastUpdate : null;
  const stale = ageMs != null && ageMs > STALE_MS;

  return (
    <div className="min-h-screen bg-zinc-broadcast text-white-body px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div
          className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-eyebrow-lg font-mono mb-4 ${
            stale || connError ? 'text-orange-admin' : 'text-red-destructive'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              stale || connError
                ? 'bg-orange-admin'
                : 'bg-red-destructive motion-safe:animate-pulse'
            }`}
          />
          <Radio size={12} aria-hidden="true" />
          <span>
            {connError
              ? 'Reconnecting…'
              : stale
                ? `Last update ${Math.round(ageMs / 1000)}s ago`
                : 'Live bonus hunt'}
          </span>
        </div>

        {loading && (
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono py-16 text-center">
            Connecting…
          </p>
        )}

        {!loading && missing && (
          <div className="relative overflow-hidden border border-white/8 bg-zinc-card/30 py-16 text-center">
            {/* Dead-channel static — fades in behind the message, motion-gated */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-screen motion-reduce:hidden off-air-static"
              aria-hidden="true"
            />
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/15 mb-3 text-white/35">
                <RadioTower size={16} aria-hidden="true" />
              </div>
              <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono">
                Off air
              </p>
              <p className="text-sm text-white/55">
                Nothing on this channel right now. Catch the next hunt on stream.
              </p>
            </div>
            <style jsx>{`
              .off-air-static {
                background-image: repeating-radial-gradient(
                  circle at 50% 50%,
                  rgba(255, 255, 255, 0.5) 0px,
                  rgba(255, 255, 255, 0.5) 1px,
                  transparent 1px,
                  transparent 2px
                );
                background-size: 3px 3px;
                animation: off-air-flicker 0.5s steps(3) infinite;
              }
              @keyframes off-air-flicker {
                0% {
                  background-position: 0 0;
                }
                33% {
                  background-position: 1px -1px;
                }
                66% {
                  background-position: -1px 1px;
                }
                100% {
                  background-position: 1px 1px;
                }
              }
            `}</style>
          </div>
        )}

        {!loading && hunt && (
          <>
            <h1 className="font-black text-white-body leading-tight tracking-[-0.02em] text-3xl sm:text-4xl mb-1">
              {hunt.name}
            </h1>
            <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal font-mono mb-5">
              {opening ? '▸ Opening slots' : '▸ Building the hunt'}
            </p>

            {/* Lead — phase-aware: profit hero while opening, "building" while collecting */}
            {opening ? (
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-[11px] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono">
                  Profit
                </span>
                <span
                  className={`text-4xl sm:text-5xl font-black tabular-nums leading-none ${
                    stats.profit == null
                      ? 'text-white/50'
                      : stats.profit >= 0
                        ? 'text-emerald-signal'
                        : 'text-red-destructive'
                  }`}
                >
                  {stats.profit == null
                    ? '—'
                    : `${stats.profit >= 0 ? '+' : ''}${fmt(stats.profit)}`}
                </span>
              </div>
            ) : (
              <div className="border border-purple-gamba/40 bg-purple-gamba/5 p-5 mb-2">
                <p className="text-[11px] font-bold tracking-eyebrow-lg uppercase text-purple-bright font-mono mb-2">
                  Building the hunt
                </p>
                <p className="text-3xl sm:text-4xl font-black leading-none mb-1 tabular-nums">
                  <span className="text-purple-bright">{bonusCount}</span>{' '}
                  {bonusCount === 1 ? 'bonus' : 'bonuses'} lined up
                </p>
                <p className="text-[12px] font-mono text-white/50 mb-3 tabular-nums">
                  {bonusCount > 0
                    ? `avg bet ${fmt(stats.totalStakes / bonusCount)}`
                    : 'no bonuses yet'}
                </p>
                <p className="text-sm text-white/55">
                  Slots are still going in. Opening starts once the list is locked.
                </p>
              </div>
            )}

            {/* Now opening — the live focal point, above the supporting stats */}
            {opening && currentBonus && (
              <div className="border border-purple-gamba/40 bg-purple-gamba/5 p-5 mb-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-purple-bright font-mono">
                    Now opening
                  </span>
                  <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono tabular-nums">
                    {openedCount} / {bonusCount} opened
                  </span>
                </div>
                <div className="h-0.5 bg-white/10 mb-3">
                  <div
                    className="h-full bg-purple-bright transition-all"
                    style={{
                      width: `${bonusCount ? (openedCount / bonusCount) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <ScatterPill bonus={currentBonus} size="md" />
                  <p className="font-black text-white-body text-3xl sm:text-4xl leading-tight truncate">
                    {currentBonus.slot}
                  </p>
                </div>
                <p className="text-[12px] font-mono text-white/50 tabular-nums">
                  bet {fmt(currentBonus.stake)}
                  {currentBonus.caller ? ` · 📣 ${currentBonus.caller}` : ''}
                </p>
                {nextBonus && (
                  <p className="text-[11px] font-mono text-white/40 mt-3">
                    Next: <span className="text-white/70">{nextBonus.slot}</span>
                    <span className="text-white/40"> · {fmt(nextBonus.stake)}</span>
                  </p>
                )}
              </div>
            )}

            {/* Primary stats: count, buy-in, running winnings + profit/loss */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              <StatCell
                label="Bonuses"
                value={
                  <span>
                    <span className="text-purple-bright">{openedCount}</span>
                    <span className="text-white/40"> / {bonusCount}</span>
                  </span>
                }
              />
              <StatCell label="Start cost" value={fmt(stats.start)} />
              <StatCell label="Winnings" value={fmt(stats.totalWins)} />
              <StatCell
                label="Profit / loss"
                value={
                  stats.runningProfit == null ? (
                    '—'
                  ) : (
                    <span
                      className={
                        stats.runningProfit >= 0
                          ? 'text-emerald-signal'
                          : 'text-red-destructive'
                      }
                    >
                      {stats.runningProfit >= 0 ? '+' : '−'}
                      {fmt(Math.abs(stats.runningProfit))}
                    </span>
                  )
                }
              />
            </div>

            {/* Secondary stats: per-bonus averages + multipliers */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
              <StatCell
                label="Avg req"
                value={stats.avgReqRemaining != null ? fmt(stats.avgReqRemaining) : '—'}
              />
              <StatCell
                label="Cur avg"
                value={stats.curAvgWin != null ? fmt(stats.curAvgWin) : '—'}
              />
              <StatCell label="Total X" value={stats.totalX > 0 ? fmtX(stats.totalX) : '—'} />
              <StatCell
                label="Cur avg X"
                value={stats.curAvgX != null ? fmtX(stats.curAvgX) : '—'}
              />
              <StatCell label="Best X" value={stats.bestX != null ? fmtX(stats.bestX) : '—'} />
            </div>

            {/* Two-column body: bonuses left, squad right; stacks on mobile */}
            <div className="grid lg:grid-cols-2 gap-5 items-start">
              <div>
                <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono mb-2">
                  Bonuses <span className="text-white/30">· {bonusCount}</span>
                </p>
                {bonuses.length > 0 && (
                  <div className="border border-white/8 overflow-x-auto overflow-y-auto max-h-[48vh] [scrollbar-width:thin]">
                    <table className="w-full text-sm min-w-[360px]">
                      <thead>
                        <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono sticky top-0 z-10">
                          <th className="text-left px-3 py-2 font-bold">Slot</th>
                          <th className="text-right px-3 py-2 font-bold">Bet</th>
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
                              className={`border-b border-white/5 ${
                                isCurrent
                                  ? 'bg-purple-gamba/25 shadow-[inset_3px_0_0_#c084fc]'
                                  : ''
                              }`}
                            >
                              <td className="px-3 py-2 font-bold text-white-body max-w-[200px]">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <ScatterPill bonus={b} size="sm" />
                                  <span className="truncate" title={b.slot}>{b.slot}</span>
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
              </div>

              <div>
                <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono mb-2">
                  Squad split <span className="text-white/30">· {gamblers.length}</span>
                </p>
                {gamblers.length > 0 && (
                  <div className="border border-white/8 overflow-x-auto overflow-y-auto max-h-[48vh] [scrollbar-width:thin]">
                    <table className="w-full text-sm min-w-[360px]">
                      <thead>
                        <tr className="border-b border-white/10 text-white/65 text-[10px] uppercase tracking-eyebrow-md bg-zinc-broadcast/50 font-mono sticky top-0 z-10">
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
                              <td
                                className={`px-3 py-2 text-right font-bold tabular-nums ${
                                  payout == null
                                    ? 'text-white/60'
                                    : payout >= g.inFor
                                      ? 'text-emerald-signal'
                                      : 'text-red-destructive'
                                }`}
                              >
                                {payout != null ? fmt(payout) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <p className="text-center text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/25 font-mono mt-8">
              goofer.tv · live hunt
            </p>
          </>
        )}
      </div>
    </div>
  );
}
