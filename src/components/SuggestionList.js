import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  ListChecks,
  X,
  Check,
  Trash2,
  Undo2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { authedFetch } from '../utils/authedFetch';

const STATUS_LABEL = {
  pending: { label: 'PENDING', cls: 'text-white/55 border-white/20' },
  added: { label: 'ADDED', cls: 'text-emerald-signal border-emerald-signal/40' },
  'played-bonus': { label: 'BONUS HIT', cls: 'text-orange-admin border-orange-admin/50' },
  'played-no-bonus': { label: 'NO HIT', cls: 'text-red-destructive/80 border-red-destructive/40' },
  skipped: { label: 'SKIPPED', cls: 'text-white/35 border-white/15' },
};

// Sort order: pending first, then added, then played, then skipped, settled at bottom.
const STATUS_ORDER = ['added', 'played-bonus', 'played-no-bonus', 'pending', 'skipped'];

function statusSort(a, b) {
  const ai = STATUS_ORDER.indexOf(a.status || 'pending');
  const bi = STATUS_ORDER.indexOf(b.status || 'pending');
  if (ai !== bi) return ai - bi;
  // Within same status, newer first
  const aMs = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
  const bMs = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
  return bMs - aMs;
}

function SuggestionRow({ suggestion, huntId, isMine, adminMode, onError }) {
  const [busy, setBusy] = useState(null);
  const meta = STATUS_LABEL[suggestion.status] || STATUS_LABEL.pending;
  const dim = suggestion.status === 'skipped';

  const callAdmin = async (newStatus) => {
    setBusy(newStatus);
    try {
      const res = await authedFetch('/api/admin/suggestions', {
        method: 'POST',
        body: JSON.stringify({
          huntId,
          suggestionId: suggestion.id,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) onError?.(data.error || 'Failed');
    } finally {
      setBusy(null);
    }
  };

  const deleteOwn = async () => {
    setBusy('delete');
    try {
      const res = await authedFetch('/api/suggestions/delete', {
        method: 'POST',
        body: JSON.stringify({ huntId, suggestionId: suggestion.id }),
      });
      const data = await res.json();
      if (!res.ok) onError?.(data.error || 'Failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-3 border-t border-white/8 first:border-t-0 transition-opacity duration-150 ${
        dim ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        {suggestion.profileImageUrl ? (
          <img
            src={suggestion.profileImageUrl}
            alt=""
            className="w-8 h-8 rounded-full border border-white/15 flex-shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="w-8 h-8 rounded-full border border-white/15 bg-zinc-broadcast/40 flex items-center justify-center text-[11px] font-bold font-mono text-white/55 flex-shrink-0">
            {(suggestion.displayName || suggestion.twitchName || '?').charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`font-bold text-sm leading-tight truncate ${dim ? 'line-through' : 'text-white-body'}`}>
            {suggestion.slotName}
          </p>
          <span
            className={`px-1.5 py-0.5 text-[9px] font-bold tracking-eyebrow-md uppercase border font-mono ${meta.cls}`}
          >
            {meta.label}
          </span>
          {isMine && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-eyebrow-md uppercase text-white/55 border border-white/20 font-mono">
              YOU
            </span>
          )}
        </div>
        <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5 truncate">
          {suggestion.displayName || suggestion.twitchName}
          {suggestion.note && (
            <>
              {' · '}
              <span className="text-white/55 italic normal-case font-normal">"{suggestion.note}"</span>
            </>
          )}
          {suggestion.adminNote && (
            <>
              {' · '}
              <span className="text-orange-admin/80 normal-case font-normal">[note] {suggestion.adminNote}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex gap-1 flex-shrink-0">
        {adminMode && suggestion.status === 'pending' && (
          <>
            <button
              type="button"
              onClick={() => callAdmin('added')}
              disabled={!!busy}
              className="p-1.5 border border-emerald-signal/40 text-emerald-signal hover:bg-emerald-signal/10 transition-colors duration-150 disabled:opacity-50"
              title="Add to hunt"
            >
              <Check size={12} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => callAdmin('skipped')}
              disabled={!!busy}
              className="p-1.5 border border-white/15 text-white/55 hover:text-white-body hover:border-white/30 transition-colors duration-150 disabled:opacity-50"
              title="Skip"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </>
        )}
        {adminMode && suggestion.status === 'added' && (
          <>
            <button
              type="button"
              onClick={() => callAdmin('played-bonus')}
              disabled={!!busy}
              className="inline-flex items-center gap-1 px-2 py-1.5 border border-orange-admin/50 text-orange-admin hover:bg-orange-admin/10 transition-colors duration-150 disabled:opacity-50"
              title="Played - bonus hit!"
            >
              <TrendingUp size={11} aria-hidden="true" />
              <span className="text-[9px] font-bold tracking-eyebrow-md uppercase font-mono">HIT</span>
            </button>
            <button
              type="button"
              onClick={() => callAdmin('played-no-bonus')}
              disabled={!!busy}
              className="inline-flex items-center gap-1 px-2 py-1.5 border border-red-destructive/40 text-red-destructive/80 hover:bg-red-destructive/10 transition-colors duration-150 disabled:opacity-50"
              title="Played - no bonus"
            >
              <TrendingDown size={11} aria-hidden="true" />
              <span className="text-[9px] font-bold tracking-eyebrow-md uppercase font-mono">MISS</span>
            </button>
            <button
              type="button"
              onClick={() => callAdmin('pending')}
              disabled={!!busy}
              className="p-1.5 border border-white/15 text-white/55 hover:text-white-body hover:border-white/30 transition-colors duration-150 disabled:opacity-50"
              title="Back to pending"
            >
              <Undo2 size={12} aria-hidden="true" />
            </button>
          </>
        )}
        {adminMode && ['played-bonus', 'played-no-bonus', 'skipped'].includes(suggestion.status) && (
          <button
            type="button"
            onClick={() => callAdmin('pending')}
            disabled={!!busy}
            className="p-1.5 border border-white/15 text-white/55 hover:text-white-body hover:border-white/30 transition-colors duration-150 disabled:opacity-50"
            title="Back to pending"
          >
            <Undo2 size={12} aria-hidden="true" />
          </button>
        )}
        {!adminMode && isMine && suggestion.status === 'pending' && (
          <button
            type="button"
            onClick={deleteOwn}
            disabled={!!busy}
            className="p-1.5 border border-red-destructive/30 text-red-destructive/70 hover:bg-red-destructive/10 hover:border-red-destructive/60 transition-colors duration-150 disabled:opacity-50"
            title="Delete my suggestion"
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Props:
 *   huntId
 *   adminMode?: bool — show admin status-change buttons
 */
export default function SuggestionList({ huntId, adminMode = false }) {
  const { twitchUser } = useTwitchAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!huntId) return undefined;
    const q = query(
      collection(db, 'hunts', huntId, 'suggestions'),
      orderBy('submittedAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setSuggestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [huntId]);

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const sorted = [...suggestions].sort(statusSort);

  return (
    <div className="border border-white/10 bg-zinc-card/30">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold tracking-eyebrow-md uppercase font-mono">
        <span className="inline-flex items-center gap-2 text-white/55">
          <ListChecks size={11} aria-hidden="true" />
          Slot suggestions
        </span>
        <span className="text-white/35 tabular-nums">{suggestions.length} total</span>
      </div>
      {sorted.length === 0 ? (
        <p className="px-5 py-8 text-sm text-white/45 text-center">No suggestions yet.</p>
      ) : (
        <div>
          {sorted.map((s) => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              huntId={huntId}
              isMine={!!twitchUser && s.twitchId === twitchUser.twitchId}
              adminMode={adminMode}
              onError={setError}
            />
          ))}
        </div>
      )}
      {error && (
        <div className="px-4 py-2 border-t border-red-destructive/30 text-[10px] font-bold tracking-eyebrow-lg uppercase text-red-destructive font-mono">
          {error}
        </div>
      )}
    </div>
  );
}
