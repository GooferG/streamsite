import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit as fLimit } from 'firebase/firestore';
import { Plus, ChevronRight, Layers } from 'lucide-react';
import { db } from '../config/firebase';
import SuggestionList from '../components/SuggestionList';
import NewRoundModal from '../components/admin/predictions/NewRoundModal';
import RoundControl from '../components/admin/predictions/RoundControl';
import EntriesTable from '../components/admin/predictions/EntriesTable';
import RoundResults from '../components/admin/predictions/RoundResults';
import useResultsAnnounce from '../components/admin/predictions/useResultsAnnounce';
import { formatTs, statusTone } from '../components/admin/predictions/shared';
import { lastRewardsRound } from '../utils/predictionRewards';

function RoundRow({ round, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(round)}
      className="w-full grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-3 border-t border-white/8 first:border-t-0 hover:bg-zinc-broadcast/40 text-left"
    >
      <span
        className={`px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow-md uppercase border font-mono ${statusTone(round.status)}`}
      >
        {round.status}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-white-body text-sm truncate">{round.title}</p>
        <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5">
          {[round.acceptPredictions && 'PREDICT', round.acceptSuggestions && 'SUGGEST'].filter(Boolean).join(' + ')} ·{' '}
          {round.source} · {formatTs(round.createdAt)}
        </p>
      </div>
      <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono tabular-nums">
        {round.entryCount ?? 0} entries
      </span>
      <ChevronRight size={14} className="text-white/30" aria-hidden="true" />
    </button>
  );
}

// /admin/hunts: the prediction control room. The newest round (the one viewers
// see on /gamba/hunts) leads the page; past rounds open read-only below.
export default function AdminHuntsPage() {
  const [list, setList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'hunts'), orderBy('createdAt', 'desc'), fLimit(50));
    return onSnapshot(q, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const current = list[0] || null;
  const selected = selectedId ? list.find((r) => r.id === selectedId) : null;
  const viewing = selected || current;
  const past = list.slice(1);
  const active = list.find(
    (r) => r.acceptPredictions && (r.status === 'open' || r.status === 'locked')
  );
  // Production may hold an older open/locked round from before New round was
  // blocked while one is active. That round is never read-only — otherwise it
  // could only be viewed under Past (Delete only), with no way to act on it.
  const readOnly = !!viewing && !!current && viewing.id !== current.id && viewing.id !== active?.id;
  const results = useResultsAnnounce(current);
  const lastRound = useMemo(() => lastRewardsRound(list), [list]);

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>PREDICTIONS</span>
          </span>
          <span className="text-white/20">·</span>
          <span>MODULE</span>
          <span className="text-white/70 tracking-eyebrow-lg">PRD</span>
        </div>
        <h1
          className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
          style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 'clamp(2.25rem, 6vw, 3.25rem)' }}
        >
          <span className="block">Prediction</span>
          <span className="block text-orange-admin">rounds.</span>
        </h1>
      </header>

      <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
        {active && (
          <p className="inline-flex items-center gap-2 text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/45 font-mono">
            <span>
              {active.id === current?.id
                ? 'Settle or delete the current round first'
                : `Settle or delete "${active.title}" first`}
            </span>
            {active.id !== current?.id && viewing?.id !== active.id && (
              <button
                type="button"
                onClick={() => setSelectedId(active.id)}
                className="text-orange-admin hover:text-orange-bright"
              >
                View
              </button>
            )}
          </p>
        )}
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={!!active}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-40 disabled:hover:bg-orange-admin"
        >
          <Plus size={13} aria-hidden="true" />
          <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">New round</span>
        </button>
      </div>

      {viewing ? (
        <div className="space-y-5">
          {readOnly && (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-[0.625rem] font-bold uppercase tracking-eyebrow-lg font-mono text-white/55 hover:text-white-body"
            >
              ← Back to current round
            </button>
          )}
          <RoundControl
            key={viewing.id}
            round={viewing}
            readOnly={readOnly}
            results={viewing.id === current?.id ? results : null}
            onDeleted={() => setSelectedId(null)}
          />
          {viewing.acceptPredictions && viewing.status === 'settled' && <RoundResults round={viewing} />}
          {viewing.acceptPredictions && <EntriesTable round={viewing} />}
          {viewing.acceptSuggestions && <SuggestionList huntId={viewing.id} adminMode />}
        </div>
      ) : (
        <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/15 mb-3 text-white/35">
            <Layers size={16} aria-hidden="true" />
          </div>
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono">
            No rounds yet
          </p>
          <p className="text-sm text-white/55">Start one to begin.</p>
        </div>
      )}

      {past.length > 0 && (
        <section className="mt-10">
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 mb-2 font-mono">
            Past · {past.length}
          </p>
          <div className="border border-white/8 bg-zinc-card/30">
            {past.map((r) => (
              <RoundRow key={r.id} round={r} onOpen={(x) => setSelectedId(x.id)} />
            ))}
          </div>
        </section>
      )}

      {creating && (
        <NewRoundModal
          lastRound={lastRound}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
