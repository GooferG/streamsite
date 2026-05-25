import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { CheckCircle2, XCircle, Filter as FilterIcon } from 'lucide-react';
import { db } from '../config/firebase';
import { authedFetch } from '../utils/authedFetch';

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

export default function AdminRedemptionsPage() {
  const [redemptions, setRedemptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [busyId, setBusyId] = useState(null);
  const [noteInputs, setNoteInputs] = useState({});

  useEffect(() => {
    const q = query(
      collection(db, 'redemptions'),
      where('status', '==', statusFilter),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setRedemptions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [statusFilter]);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      const res = await authedFetch('/api/admin/redemptions', {
        method: 'POST',
        body: JSON.stringify({ id, action, note: noteInputs[id] || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Action failed: ${data.error || res.status}`);
      } else {
        setNoteInputs((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>FULFILLMENT QUEUE</span>
          </span>
          <span className="text-white/20">·</span>
          <span>MODULE</span>
          <span className="text-white/70 tracking-eyebrow-lg">RED</span>
          <span className="text-white/20">·</span>
          <span className="text-white/45">FILTER</span>
          <span className="text-white/70 tracking-eyebrow-lg">{statusFilter.toUpperCase()}</span>
        </div>
        <h1
          className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
          style={{
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 'clamp(2.25rem, 6vw, 3.25rem)',
          }}
        >
          <span className="block">Redemption</span>
          <span className="block text-orange-admin">queue.</span>
        </h1>
      </header>

      {/* Filter strip */}
      <div className="flex items-center gap-2 mb-6">
        <FilterIcon size={12} className="text-white/40" aria-hidden="true" />
        {['pending', 'fulfilled', 'cancelled'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 border text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono transition-colors duration-150 ${
              statusFilter === s
                ? 'bg-orange-admin text-zinc-broadcast border-orange-admin'
                : 'border-white/10 text-white/55 hover:text-white-body hover:border-white/25'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {redemptions.length === 0 ? (
        <div className="border border-white/8 bg-zinc-card/30 py-16 text-center">
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-2 font-mono">
            No {statusFilter}
          </p>
          <p className="text-sm text-white/55">Nothing to handle right now.</p>
        </div>
      ) : (
        <div className="border border-white/8 bg-zinc-card/30">
          {redemptions.map((r) => (
            <div
              key={r.id}
              className="px-4 py-3 border-t border-white/8 first:border-t-0 space-y-2"
            >
              <div className="grid grid-cols-[auto_1fr_auto] gap-3 items-start">
                {r.profileImageUrl ? (
                  <img
                    src={r.profileImageUrl}
                    alt=""
                    className="w-9 h-9 rounded-full border border-white/15 flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 border border-white/15 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white-body text-sm">{r.itemName}</p>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold tracking-eyebrow-md uppercase border font-mono ${
                        r.kind === 'stream'
                          ? 'text-orange-admin border-orange-admin/40'
                          : 'text-emerald-signal border-emerald-signal/40'
                      }`}
                    >
                      {r.kind}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono mt-0.5">
                    {r.displayName || r.twitchName || r.userId} · {formatTs(r.createdAt)} ·{' '}
                    <span className="text-emerald-signal/70">{r.cost}t</span>
                  </p>
                  {r.note && (
                    <p className="mt-1.5 text-xs text-white/55 italic">Note: {r.note}</p>
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold tracking-eyebrow-lg uppercase px-2 py-1 border font-mono ${
                    r.status === 'fulfilled'
                      ? 'text-emerald-signal border-emerald-signal/40'
                      : r.status === 'cancelled'
                        ? 'text-red-destructive border-red-destructive/40'
                        : 'text-orange-admin border-orange-admin/40'
                  }`}
                >
                  {r.status}
                </span>
              </div>

              {r.status === 'pending' && (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <input
                    type="text"
                    value={noteInputs[r.id] || ''}
                    onChange={(e) =>
                      setNoteInputs((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    placeholder="Optional note…"
                    className="flex-1 bg-zinc-broadcast/60 border border-white/10 px-3 py-2 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => act(r.id, 'fulfill')}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} aria-hidden="true" />
                      <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                        Fulfill
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => act(r.id, 'cancel')}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-2 px-3 py-2 border border-red-destructive/40 text-red-destructive hover:bg-red-destructive/10 transition-colors duration-150 disabled:opacity-50"
                    >
                      <XCircle size={13} aria-hidden="true" />
                      <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                        Cancel · refund
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
