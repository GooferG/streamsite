import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as fLimit,
} from 'firebase/firestore';
import {
  Lock,
  Unlock,
  Trophy,
  Plus,
  X,
  Trash2,
  ChevronRight,
  RefreshCcw,
  Layers,
} from 'lucide-react';
import { db } from '../config/firebase';
import { authedFetch } from '../utils/authedFetch';
import SuggestionList from '../components/SuggestionList';
import { roundCurrency } from '../utils/predictionRound';
import NewRoundModal from '../components/admin/predictions/NewRoundModal';

const inputCls =
  'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none transition-colors duration-150';

function formatTs(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SettleModal({ round, onClose, onSettled }) {
  const [actualPayout, setActualPayout] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filling, setFilling] = useState(false);
  const [liveWarning, setLiveWarning] = useState(false);
  const [staleWarning, setStaleWarning] = useState(false);
  const [error, setError] = useState(null);
  const currency = roundCurrency(round);
  const canFill = round.source === 'communityhunts' && !!round.bonusHuntSnapshot?.huntId;

  const fillFromHunt = async () => {
    setFilling(true);
    setError(null);
    try {
      const res = await authedFetch('/api/admin/hunts', {
        method: 'POST',
        body: JSON.stringify({ action: 'hunt_result', id: round.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          {
            HUNT_NOT_FOUND: 'Hunt not found on communityhunts.gg. Enter the payout by hand.',
            COMMUNITYHUNTS_UNAVAILABLE: 'communityhunts.gg is unavailable. Enter the payout by hand.',
          }[data.error] || data.error || 'Failed'
        );
      } else {
        setActualPayout(String(data.result.payout));
        setLiveWarning(data.result.ended === false);
        // A round opened while nothing was live snapshots the previous hunt;
        // its payout would settle the wrong hunt.
        const createdMs = round.createdAt?.toMillis ? round.createdAt.toMillis() : null;
        const endedMs = data.result.endedAt ? Date.parse(data.result.endedAt) : NaN;
        setStaleWarning(createdMs != null && Number.isFinite(endedMs) && endedMs < createdMs);
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setFilling(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (actualPayout === '' || !Number.isFinite(Number(actualPayout))) {
      return setError('Actual payout required');
    }
    setSubmitting(true);
    try {
      const res = await authedFetch('/api/admin/hunts', {
        method: 'POST',
        body: JSON.stringify({ action: 'settle', id: round.id, actualPayout: Number(actualPayout) }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Failed');
      else onSettled(data);
    } catch (e) {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-broadcast/70 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md border border-orange-admin/40 bg-zinc-card">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <Trophy size={11} aria-hidden="true" />
            Settle round
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 border border-white/10 text-white/55 hover:text-white-body hover:border-white/25">
            <X size={12} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <label htmlFor="settle-actual-payout" className="block text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono">
                Actual final payout{currency ? ` (${currency})` : ''} <span className="text-emerald-signal">*</span>
              </label>
              {canFill && (
                <button
                  type="button"
                  onClick={fillFromHunt}
                  disabled={filling}
                  className="inline-flex items-center gap-1.5 px-2 py-1 border border-white/15 text-white/65 hover:text-white-body hover:border-white/30 disabled:opacity-50"
                >
                  <RefreshCcw size={11} aria-hidden="true" className={filling ? 'animate-spin' : ''} />
                  <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Fill from hunt</span>
                </button>
              )}
            </div>
            <input
              id="settle-actual-payout"
              type="number"
              min="0"
              step="0.01"
              value={actualPayout}
              onChange={(e) => {
                setActualPayout(e.target.value);
                setLiveWarning(false);
                setStaleWarning(false);
              }}
              className={inputCls}
              placeholder="0.00"
            />
            {liveWarning && (
              <p className="mt-1.5 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-orange-admin font-mono">
                Hunt is still live. The payout may change.
              </p>
            )}
            {staleWarning && (
              <p className="mt-1.5 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-orange-admin font-mono">
                This hunt ended before this round opened. Make sure it is the right hunt before settling.
              </p>
            )}
          </div>
          {error && <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose} className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-white/10 text-white/60 hover:text-white-body transition-colors duration-150">
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Cancel</span>
          </button>
          <button type="submit" disabled={submitting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50">
            <Trophy size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">{submitting ? 'Settling…' : 'Reveal winners'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function RoundRow({ round, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(round)} className="w-full grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-3 border-t border-white/8 first:border-t-0 hover:bg-zinc-broadcast/40 text-left">
      <span className={`px-1.5 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow-md uppercase border font-mono ${
        round.status === 'open'
          ? 'text-emerald-signal border-emerald-signal/40'
          : round.status === 'locked'
            ? 'text-orange-admin border-orange-admin/40'
            : 'text-white/65 border-white/20'
      }`}>
        {round.status}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-white-body text-sm truncate">{round.title}</p>
        <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5">
          {[
            round.acceptPredictions && 'PREDICT',
            round.acceptSuggestions && `SUGGEST`,
          ].filter(Boolean).join(' + ')} · {round.source} · {formatTs(round.createdAt)}
        </p>
      </div>
      <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono tabular-nums">
        {round.entryCount ?? 0} entries
      </span>
      <ChevronRight size={14} className="text-white/30" aria-hidden="true" />
    </button>
  );
}

function RoundDetail({ round, onBack }) {
  const [busy, setBusy] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [settling, setSettling] = useState(false);

  const act = async (action) => {
    setBusy(action);
    try {
      const res = await authedFetch('/api/admin/hunts', {
        method: 'POST',
        body: JSON.stringify({ action, id: round.id }),
      });
      const data = await res.json();
      if (!res.ok) alert(`Action failed: ${data.error || res.status}`);
      else if (action === 'delete') onBack();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <button type="button" onClick={onBack} className="text-white/55 hover:text-white-body tracking-eyebrow-lg">
          ← Back to list
        </button>
        <span className="inline-flex items-center gap-2 text-orange-admin">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
          Round · {round.status}
        </span>
      </div>

      <div className="relative overflow-hidden border border-orange-admin/30 bg-zinc-card/40">
        <div className="pointer-events-none absolute -top-32 -right-24 w-96 h-96 rounded-full bg-orange-admin/15 blur-3xl motion-reduce:hidden" aria-hidden="true" />
        <div className="relative px-6 sm:px-8 py-7">
          <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin mb-2 font-mono">
            ▸ Prediction round
          </p>
          <p
            className="font-black text-white-body leading-[0.9] tracking-[-0.03em]"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(2.25rem, 6vw, 3.5rem)',
            }}
          >
            {round.title}
          </p>
          {round.contextNote && <p className="mt-2 text-sm text-white/55">{round.contextNote}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
            <span className="text-white/55">
              Features{' '}
              <span className="text-emerald-signal">
                {[
                  round.acceptPredictions && 'predictions',
                  round.acceptSuggestions && 'suggestions',
                ].filter(Boolean).join(' + ') || 'none'}
              </span>
            </span>
            <span className="text-white/15">·</span>
            <span className="text-white/55">Source <span className="text-white-body">{round.source}</span></span>
            {round.acceptPredictions && (
              <>
                <span className="text-white/15">·</span>
                <span className="text-white/55">Entries <span className="text-white-body tabular-nums">{round.entryCount ?? 0}</span></span>
              </>
            )}
            {round.acceptSuggestions && (
              <>
                <span className="text-white/15">·</span>
                <span className="text-white/55">Suggestions <span className="text-white-body tabular-nums">{round.suggestionCount ?? 0}</span></span>
                <span className="text-white/15">·</span>
                <span className="text-white/55">Cap <span className="text-white-body tabular-nums">{round.suggestionCap ?? 3}</span></span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {round.acceptPredictions && round.status === 'open' && (
          <button type="button" onClick={() => act('lock')} disabled={!!busy} className="inline-flex items-center gap-2 px-3.5 py-2 border border-white/15 text-white/70 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-50">
            <Lock size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">{busy === 'lock' ? 'Locking…' : 'Lock entries'}</span>
          </button>
        )}
        {round.acceptPredictions && round.status === 'locked' && (
          <button type="button" onClick={() => act('reopen')} disabled={!!busy} className="inline-flex items-center gap-2 px-3.5 py-2 border border-white/15 text-white/70 hover:text-white-body hover:border-white/35 transition-colors duration-150 disabled:opacity-50">
            <Unlock size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">{busy === 'reopen' ? 'Reopening…' : 'Reopen'}</span>
          </button>
        )}
        {round.acceptPredictions && ['open', 'locked'].includes(round.status) && (
          <button type="button" onClick={() => setSettling(true)} disabled={!!busy} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-30">
            <Trophy size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Settle & reveal</span>
          </button>
        )}
        {round.acceptPredictions && round.status === 'settled' && round.winners?.[0] && (
          <div className="inline-flex items-center gap-2 px-3 py-2 border border-emerald-signal/40 bg-emerald-signal/5 text-emerald-signal text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
            <Trophy size={12} aria-hidden="true" />
            1st: {round.winners[0].displayName}
          </div>
        )}
        {!confirmingDelete ? (
          <button type="button" onClick={() => setConfirmingDelete(true)} className="ml-auto inline-flex items-center gap-2 px-3 py-2 border border-red-destructive/30 text-red-destructive/70 hover:bg-red-destructive/10 hover:border-red-destructive/60 transition-colors duration-150">
            <Trash2 size={12} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Delete</span>
          </button>
        ) : (
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => act('delete')} className="inline-flex items-center gap-2 px-3 py-2 bg-red-destructive/15 border border-red-destructive/50 text-red-destructive hover:bg-red-destructive/25 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Confirm</button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className="px-3 py-2 border border-white/10 text-white/60 hover:text-white-body text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">Cancel</button>
          </div>
        )}
      </div>

      {round.acceptSuggestions && (
        <SuggestionList huntId={round.id} adminMode />
      )}

      {settling && (
        <SettleModal
          round={round}
          onClose={() => setSettling(false)}
          onSettled={() => setSettling(false)}
        />
      )}
    </div>
  );
}

export default function AdminHuntsPage() {
  const [list, setList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'hunts'), orderBy('createdAt', 'desc'), fLimit(50));
    const unsub = onSnapshot(q, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const selected = useMemo(() => list.find((r) => r.id === selectedId) || null, [list, selectedId]);
  const grouped = useMemo(() => {
    const live = list.filter((r) => r.status === 'open' || r.status === 'locked');
    const past = list.filter((r) => r.status === 'settled');
    return { live, past };
  }, [list]);

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

      {!selected && (
        <div className="flex items-center justify-end mb-6">
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-3.5 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150">
            <Plus size={13} aria-hidden="true" />
            <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">New round</span>
          </button>
        </div>
      )}

      {selected ? (
        <RoundDetail round={selected} onBack={() => setSelectedId(null)} />
      ) : (
        <div className="space-y-6">
          {grouped.live.length > 0 && (
            <section>
              <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal mb-2 font-mono">
                Live · {grouped.live.length}
              </p>
              <div className="border border-white/8 bg-zinc-card/30">
                {grouped.live.map((r) => (
                  <RoundRow key={r.id} round={r} onOpen={(x) => setSelectedId(x.id)} />
                ))}
              </div>
            </section>
          )}
          {grouped.past.length > 0 && (
            <section>
              <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 mb-2 font-mono">
                Past · {grouped.past.length}
              </p>
              <div className="border border-white/8 bg-zinc-card/30">
                {grouped.past.map((r) => (
                  <RoundRow key={r.id} round={r} onOpen={(x) => setSelectedId(x.id)} />
                ))}
              </div>
            </section>
          )}
          {list.length === 0 && (
            <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/15 mb-3 text-white/35">
                <Layers size={16} aria-hidden="true" />
              </div>
              <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono">No rounds yet</p>
              <p className="text-sm text-white/55">Start one to begin.</p>
            </div>
          )}
        </div>
      )}

      {creating && (
        <NewRoundModal
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}
