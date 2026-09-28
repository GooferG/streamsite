import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Trophy, Ticket } from 'lucide-react';
import { db } from '../../../config/firebase';
import { formatMoney } from '../../../utils/money';
import { roundCurrency } from '../../../utils/predictionRound';
import { placeLabel, winnerPrizeLabel } from '../../../utils/predictionRewards';

function RedemptionStatus({ id }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!id) return undefined;
    return onSnapshot(
      doc(db, 'redemptions', id),
      (snap) => setStatus(snap.exists() ? snap.data().status : 'missing'),
      () => setStatus('unknown')
    );
  }, [id]);
  const tone =
    status === 'fulfilled'
      ? 'text-emerald-signal border-emerald-signal/40'
      : status === 'pending'
        ? 'text-orange-admin border-orange-admin/40'
        : 'text-white/45 border-white/20';
  return (
    <Link
      to="/admin/redemptions"
      className={`px-1.5 py-0.5 border text-[0.5625rem] font-bold tracking-eyebrow-md uppercase font-mono ${tone}`}
    >
      {status || '…'}
    </Link>
  );
}

// A settled round's payout and what each winner got. Tickets were credited at
// settle; a prize links to its redemption so it can be marked done.
export default function RoundResults({ round }) {
  const currency = roundCurrency(round);
  const winners = (round.winners || []).slice().sort((a, b) => a.place - b.place);
  return (
    <section className="border border-emerald-signal/30 bg-zinc-card/30">
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <Trophy size={11} aria-hidden="true" /> Results
        </span>
        <span className="text-white/55">
          Actual <span className="text-white-body tabular-nums">{formatMoney(round.actual?.payout, currency)}</span>
        </span>
      </header>
      {winners.length === 0 ? (
        <p className="px-4 py-6 text-center text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
          No winners — no eligible entries.
        </p>
      ) : (
        <ul>
          {winners.map((w) => {
            const prize = winnerPrizeLabel(w.prize);
            const tickets = Number(w.prize?.tickets) || 0;
            return (
              <li
                key={`${w.place}-${w.twitchId}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-white/8 first:border-t-0"
              >
                <span className="w-9 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono">
                  {placeLabel(w.place)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white-body text-sm truncate">{w.displayName || w.twitchName}</p>
                  <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono mt-0.5">
                    guess {formatMoney(w.payoutGuess, currency)}
                    {typeof w.diff === 'number' ? ` · off by ${formatMoney(w.diff, currency)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
                  {tickets > 0 && (
                    <span className="inline-flex items-center gap-1 text-emerald-signal">
                      <Ticket size={10} aria-hidden="true" />+{tickets} credited
                    </span>
                  )}
                  {prize && <span className="text-white-body">{prize}</span>}
                  {w.redemptionId && <RedemptionStatus id={w.redemptionId} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
