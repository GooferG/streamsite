import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Users } from 'lucide-react';
import { db } from '../../../config/firebase';
import { formatMoney } from '../../../utils/money';
import { roundCurrency } from '../../../utils/predictionRound';
import { placeLabel } from '../../../utils/predictionRewards';
import { formatTs } from './shared';

const th = 'px-4 py-2 font-bold';

// Every guess in a round, live. Staff can read entries while the round is
// open (firestore.rules), so this works before the lock. Sorted by guess
// until settled, then by distance to the actual payout.
export default function EntriesTable({ round }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!round?.id) return undefined;
    return onSnapshot(collection(db, 'hunts', round.id, 'entries'), (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [round?.id]);

  const currency = roundCurrency(round);
  const actual = round.status === 'settled' ? round.actual?.payout : null;
  const settled = typeof actual === 'number';
  const places = useMemo(
    () => Object.fromEntries((round.winners || []).map((w) => [w.twitchId, w.place])),
    [round.winners]
  );
  const rows = useMemo(() => {
    const guessed = entries.filter((e) => typeof e.payoutGuess === 'number');
    if (!settled) return guessed.sort((a, b) => a.payoutGuess - b.payoutGuess);
    return guessed
      .map((e) => ({ ...e, diff: Math.abs(e.payoutGuess - actual) }))
      .sort((a, b) => a.diff - b.diff);
  }, [entries, settled, actual]);

  return (
    <section className="border border-white/8 bg-zinc-card/30">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-white/65">
          <Users size={11} aria-hidden="true" /> Entries
        </span>
        <span className="text-white/40 tabular-nums">{rows.length}</span>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
          No guesses yet
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.5625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
                <th scope="col" className={th}>Viewer</th>
                <th scope="col" className={`${th} text-right`}>Guess</th>
                {settled && <th scope="col" className={`${th} text-right`}>Off by</th>}
                <th scope="col" className={`${th} text-right`}>Edits</th>
                <th scope="col" className={`${th} text-right`}>Last edit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-white/8">
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      {places[e.twitchId] && (
                        <span className="px-1 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow-md uppercase border border-orange-admin/50 text-orange-admin font-mono">
                          {placeLabel(places[e.twitchId])}
                        </span>
                      )}
                      {e.profileImageUrl ? (
                        <img
                          src={e.profileImageUrl}
                          alt=""
                          loading="lazy"
                          className="w-5 h-5 rounded-full border border-white/15 flex-shrink-0"
                        />
                      ) : (
                        <span
                          className="w-5 h-5 rounded-full border border-white/15 flex-shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span className="text-white-body truncate">{e.displayName || e.twitchName || e.id}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-white-body">
                    {formatMoney(e.payoutGuess, currency)}
                  </td>
                  {settled && (
                    <td className="px-4 py-2 text-right tabular-nums text-white/65">{formatMoney(e.diff, currency)}</td>
                  )}
                  <td className="px-4 py-2 text-right tabular-nums text-white/55">{e.editCount ?? 1}</td>
                  <td className="px-4 py-2 text-right text-white/45 font-mono text-[0.6875rem]">
                    {formatTs(e.lastEditAt || e.submittedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
