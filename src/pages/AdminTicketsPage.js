import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { Search, Plus, Minus, Ticket, Clock, ArrowLeft } from 'lucide-react';
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

const REASON_LABELS = {
  watchtime: 'Watch time',
  daily: 'Daily',
  admin_grant: 'Granted',
  discord_link: 'Discord',
  redeem: 'Redeem',
  refund: 'Refund',
};

export default function AdminTicketsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [grantAmount, setGrantAmount] = useState(50);
  const [grantNote, setGrantNote] = useState('');
  const [granting, setGranting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [holders, setHolders] = useState([]);
  const [loadingHolders, setLoadingHolders] = useState(true);

  const loadHolders = async () => {
    setLoadingHolders(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('tickets', '>', 0),
        orderBy('tickets', 'desc'),
        limit(200)
      );
      const snap = await getDocs(q);
      setHolders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('holders load error', err);
      setHolders([]);
    } finally {
      setLoadingHolders(false);
    }
  };

  useEffect(() => {
    loadHolders();
  }, []);

  const runSearch = async (e) => {
    e?.preventDefault();
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      // Prefix-match on twitchName (lowercase login). Firestore "range" trick.
      const q = query(
        collection(db, 'users'),
        where('twitchName', '>=', term),
        where('twitchName', '<=', term + ''),
        orderBy('twitchName', 'asc'),
        limit(20)
      );
      const snap = await getDocs(q);
      setResults(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('search error', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Load ledger for selected user.
  useEffect(() => {
    if (!selected?.id) {
      setLedger([]);
      return;
    }
    (async () => {
      const q = query(
        collection(db, 'ticket_ledger'),
        where('userId', '==', selected.id),
        orderBy('createdAt', 'desc'),
        limit(25)
      );
      const snap = await getDocs(q);
      setLedger(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, [selected?.id, feedback]);

  const grant = async (sign) => {
    if (!selected) return;
    const amount = Math.abs(Number(grantAmount)) * sign;
    if (!Number.isInteger(amount) || amount === 0) {
      setFeedback({ kind: 'error', message: 'Amount must be a non-zero integer.' });
      return;
    }
    setGranting(true);
    setFeedback(null);
    try {
      const res = await authedFetch('/api/admin/grant-tickets', {
        method: 'POST',
        body: JSON.stringify({
          twitchId: selected.id,
          delta: amount,
          reason: 'admin_grant',
          note: grantNote || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ kind: 'error', message: data.error || 'Failed.' });
      } else {
        setFeedback({
          kind: 'success',
          message: `${amount > 0 ? '+' : ''}${amount} tickets to ${selected.displayName || selected.twitchName}.`,
        });
        setGrantNote('');
        // Refresh selected user balance.
        const refreshed = await getDocs(
          query(collection(db, 'users'), where('twitchId', '==', selected.id), limit(1))
        );
        if (!refreshed.empty) {
          const data2 = refreshed.docs[0].data();
          setSelected({ id: refreshed.docs[0].id, ...data2 });
        }
        loadHolders();
      }
    } catch (err) {
      setFeedback({ kind: 'error', message: 'Network error.' });
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
          <span className="inline-flex items-center gap-2 text-orange-admin">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
            <span>TICKET LEDGER</span>
          </span>
          <span className="text-white/20">·</span>
          <span>MODULE</span>
          <span className="text-white/70 tracking-eyebrow-lg">TKT</span>
        </div>
        <h1
          className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
          style={{
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: 'clamp(2.25rem, 6vw, 3.25rem)',
          }}
        >
          <span className="block">Grant &amp; audit</span>
          <span className="block text-orange-admin">tickets.</span>
        </h1>
      </header>

      {/* Search */}
      <form onSubmit={runSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Twitch login (lowercase) — e.g. gooferg"
          className="flex-1 bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/25 focus:border-orange-admin/70 focus:outline-none transition-colors duration-150"
        />
        <button
          type="submit"
          disabled={searching}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-orange-admin text-zinc-broadcast hover:bg-orange-bright transition-colors duration-150 disabled:opacity-50"
        >
          <Search size={13} aria-hidden="true" />
          <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
            {searching ? 'Searching…' : 'Search'}
          </span>
        </button>
      </form>

      {/* Default: all ticket holders, sorted desc */}
      {!selected && results.length === 0 && (
        <div className="border border-white/8 bg-zinc-card/30 mb-6">
          <div className="px-4 py-2.5 border-b border-white/8 text-[10px] font-bold tracking-eyebrow-md uppercase text-white/55 font-mono">
            {loadingHolders
              ? 'Loading…'
              : `${holders.length} ticket holder${holders.length === 1 ? '' : 's'} · top first`}
          </div>
          {!loadingHolders && holders.length === 0 && (
            <p className="px-5 py-6 text-sm text-white/50">No users have tickets yet.</p>
          )}
          {holders.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelected(u)}
              className="w-full grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-3 border-t border-white/8 first:border-t-0 hover:bg-zinc-broadcast/40 text-left"
            >
              {u.profileImageUrl ? (
                <img src={u.profileImageUrl} alt="" className="w-9 h-9 rounded-full border border-white/15" />
              ) : (
                <div className="w-9 h-9 border border-white/15" />
              )}
              <div className="min-w-0">
                <p className="font-bold text-white-body text-sm">{u.displayName}</p>
                <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
                  {u.twitchName}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-emerald-signal text-sm font-bold tabular-nums">
                <Ticket size={12} aria-hidden="true" />
                {u.tickets ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && !selected && (
        <div className="border border-white/8 bg-zinc-card/30 mb-6">
          <div className="px-4 py-2.5 border-b border-white/8 text-[10px] font-bold tracking-eyebrow-md uppercase text-white/55 font-mono">
            {results.length} match{results.length === 1 ? '' : 'es'}
          </div>
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setSelected(u)}
              className="w-full grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-3 border-t border-white/8 first:border-t-0 hover:bg-zinc-broadcast/40 text-left"
            >
              {u.profileImageUrl ? (
                <img src={u.profileImageUrl} alt="" className="w-9 h-9 rounded-full border border-white/15" />
              ) : (
                <div className="w-9 h-9 border border-white/15" />
              )}
              <div className="min-w-0">
                <p className="font-bold text-white-body text-sm">{u.displayName}</p>
                <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
                  {u.twitchName}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-emerald-signal text-sm font-bold tabular-nums">
                <Ticket size={12} aria-hidden="true" />
                {u.tickets ?? 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Selected user — grant + ledger */}
      {selected && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setFeedback(null);
              setGrantNote('');
              loadHolders();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 border border-white/10 text-white/60 hover:text-white-body hover:border-white/25 transition-colors duration-150"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              Back to list
            </span>
          </button>
          <div className="border border-white/8 bg-zinc-card/30">
            <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
              <span className="inline-flex items-center gap-2 text-orange-admin">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
                <span>Selected viewer</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setFeedback(null);
                  setGrantNote('');
                }}
                className="text-white/40 hover:text-white-body uppercase tracking-eyebrow-lg"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/8 bg-zinc-broadcast/40">
              <div className="flex items-center gap-3 min-w-0">
                {selected.profileImageUrl && (
                  <img
                    src={selected.profileImageUrl}
                    alt=""
                    className="w-10 h-10 rounded-full border border-white/15"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-white-body text-sm">{selected.displayName}</p>
                  <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
                    {selected.twitchName} · ID {selected.id}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
                  Balance
                </p>
                <p className="text-2xl font-black text-emerald-signal tabular-nums">
                  {selected.tickets ?? 0}
                </p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-3">
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <label className="block">
                  <span className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                    Amount
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                    className="w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body focus:border-orange-admin/70 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 mb-1.5 font-mono">
                    Note · optional
                  </span>
                  <input
                    value={grantNote}
                    onChange={(e) => setGrantNote(e.target.value)}
                    placeholder="Reason…"
                    className="w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body focus:border-orange-admin/70 focus:outline-none"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => grant(1)}
                  disabled={granting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-50"
                >
                  <Plus size={13} aria-hidden="true" />
                  <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                    Add tickets
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => grant(-1)}
                  disabled={granting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-red-destructive/40 text-red-destructive hover:bg-red-destructive/10 transition-colors duration-150 disabled:opacity-50"
                >
                  <Minus size={13} aria-hidden="true" />
                  <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                    Subtract
                  </span>
                </button>
              </div>
              {feedback && (
                <p
                  className={`text-[11px] font-bold tracking-eyebrow uppercase font-mono ${
                    feedback.kind === 'success' ? 'text-emerald-signal' : 'text-red-destructive'
                  }`}
                >
                  {feedback.message}
                </p>
              )}
            </div>
          </div>

          {/* Ledger */}
          <div className="border border-white/8 bg-zinc-card/30">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md text-white/55 font-mono">
              <Clock size={11} aria-hidden="true" />
              <span>Ledger · last {ledger.length}</span>
            </div>
            {ledger.length === 0 ? (
              <p className="px-5 py-6 text-sm text-white/50">No activity.</p>
            ) : (
              <ul>
                {ledger.map((e) => {
                  const earn = e.delta > 0;
                  return (
                    <li
                      key={e.id}
                      className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2.5 border-t border-white/8"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white-body">
                          {REASON_LABELS[e.reason] || e.reason}
                          {e.itemName ? <span className="text-white/45"> · {e.itemName}</span> : null}
                          {e.note ? <span className="text-white/45"> · {e.note}</span> : null}
                        </p>
                        <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
                          {formatTs(e.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`tabular-nums text-sm font-bold ${
                          earn ? 'text-emerald-signal' : 'text-orange-admin'
                        }`}
                      >
                        {earn ? '+' : ''}
                        {e.delta}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
