import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Ticket,
  Users as UsersIcon,
  Link2,
  Gift,
  TrendingUp,
  Inbox,
  ListOrdered,
  Calendar,
  Hash,
} from 'lucide-react';
import { authedFetch } from '../utils/authedFetch';

function formatTs(ts) {
  if (!ts) return '—';
  const ms = ts._seconds ? ts._seconds * 1000 : ts.seconds ? ts.seconds * 1000 : null;
  if (ms === null) return '—';
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(ts) {
  if (!ts) return '—';
  const ms = ts._seconds ? ts._seconds * 1000 : ts.seconds ? ts.seconds * 1000 : null;
  if (ms === null) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

const SORT_OPTIONS = [
  { key: 'tickets', label: 'Tickets ↓' },
  { key: 'created', label: 'Newest signup' },
  { key: 'recent', label: 'Recent activity' },
];

function Avatar({ url, name, size = 32 }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="rounded-full border border-white/15"
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className="rounded-full border border-white/15 bg-zinc-card flex items-center justify-center font-mono font-bold text-white/60"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="border border-white/10 bg-zinc-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">
        {Icon && <Icon size={11} aria-hidden="true" />}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold text-white-body tabular-nums">{value}</div>
      {hint && <div className="text-[0.625rem] text-white/40 font-mono">{hint}</div>}
    </div>
  );
}

function Section({ icon: Icon, title, count, children }) {
  return (
    <section className="border border-white/10 bg-zinc-card/30">
      <header className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
        {Icon && <Icon size={13} className="text-orange-admin" aria-hidden="true" />}
        <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white-body font-mono">
          {title}
        </span>
        {typeof count === 'number' && (
          <span className="ml-auto text-[0.625rem] font-mono text-white/45 tabular-nums">
            {count}
          </span>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function UserRow({ user, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left border-l-2 transition-colors duration-100 ${
        selected
          ? 'border-orange-admin bg-orange-admin/10'
          : 'border-transparent hover:bg-white/5'
      }`}
    >
      <Avatar url={user.profileImageUrl} name={user.displayName || user.twitchName} size={28} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white-body truncate">
          {user.displayName || user.twitchName}
        </div>
        <div className="text-[0.625rem] text-white/40 font-mono truncate">
          {user.twitchName ? `@${user.twitchName}` : user.twitchId}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-orange-admin tabular-nums">{user.tickets}</div>
        <div className="text-[0.5625rem] text-white/35 font-mono">tickets</div>
      </div>
    </button>
  );
}

function UserDetail({ twitchId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    (async () => {
      try {
        const res = await authedFetch(
          `/api/admin/users?action=detail&twitchId=${encodeURIComponent(twitchId)}`,
          { method: 'GET' }
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Failed to load.');
        } else {
          setDetail(data);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [twitchId]);

  if (loading) {
    return (
      <div className="p-8 text-center text-[0.6875rem] font-mono uppercase tracking-eyebrow text-white/45">
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8 text-center text-[0.6875rem] font-mono uppercase tracking-eyebrow text-red-destructive">
        {error}
      </div>
    );
  }
  if (!detail) return null;

  const { user, redemptions, ledger, giveawayEntries, huntPredictions, huntSuggestions } = detail;

  return (
    <div className="space-y-5">
      {/* Identity card */}
      <div className="border border-white/10 bg-zinc-card/40 p-5 flex items-center gap-4">
        <Avatar url={user.profileImageUrl} name={user.displayName || user.twitchName} size={64} />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white-body truncate">
            {user.displayName || user.twitchName || 'Unknown'}
          </h2>
          <p className="text-sm text-white/55 font-mono truncate">
            {user.twitchName ? `@${user.twitchName}` : ''}{' '}
            <span className="text-white/30">· id {user.twitchId}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[0.625rem] font-mono uppercase tracking-eyebrow">
            <span className="px-2 py-0.5 bg-purple-gamba/30 text-purple-bright/80 border border-purple-bright/30">
              Twitch
            </span>
            {user.discordVerifiedAt ? (
              <span className="px-2 py-0.5 bg-[#5865F2]/20 text-[#a3aef8] border border-[#5865F2]/40">
                Discord · {user.discordUsername || 'linked'}
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-white/5 text-white/35 border border-white/10">
                Discord · not linked
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={Ticket} label="Balance" value={user.tickets} />
        <StatTile icon={Ticket} label="Earned" value={user.totalEarned} />
        <StatTile icon={Ticket} label="Spent" value={user.totalSpent} />
        <StatTile icon={Calendar} label="Joined" value={formatDate(user.createdAt)} />
      </div>

      {/* Activity rows */}
      <Section icon={Inbox} title="Redemptions" count={redemptions.length}>
        {redemptions.length === 0 ? (
          <p className="text-sm text-white/40 italic">No redemptions yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {redemptions.map((r) => (
              <li key={r.id} className="py-2 flex items-center gap-3 text-sm">
                <span
                  className={`px-2 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow uppercase font-mono border ${
                    r.status === 'fulfilled'
                      ? 'border-emerald-signal/40 text-emerald-signal/85 bg-emerald-signal/10'
                      : r.status === 'pending'
                        ? 'border-orange-admin/40 text-orange-admin bg-orange-admin/10'
                        : 'border-white/15 text-white/45 bg-white/5'
                  }`}
                >
                  {r.status}
                </span>
                <span className="flex-1 min-w-0 truncate text-white/75">
                  {r.itemName || '(item)'}{' '}
                  {r.kind === 'giveaway' && (
                    <span className="text-[0.625rem] text-purple-bright/70 font-mono uppercase">
                      · giveaway
                    </span>
                  )}
                </span>
                <span className="text-[0.625rem] font-mono text-white/40 tabular-nums">
                  {r.cost > 0 ? `-${r.cost}` : 'free'}
                </span>
                <span className="text-[0.625rem] font-mono text-white/40 hidden sm:inline">
                  {formatTs(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Gift} title="Giveaway entries" count={giveawayEntries.length}>
        {giveawayEntries.length === 0 ? (
          <p className="text-sm text-white/40 italic">Hasn't entered any giveaway.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {giveawayEntries.map((e) => (
              <li key={e.id + e.giveawayId} className="py-2 flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0 truncate text-white/75">
                  {e.giveaway?.title || '(unknown giveaway)'}{' '}
                  {e.giveaway?.prize && (
                    <span className="text-white/40">· {e.giveaway.prize}</span>
                  )}
                </span>
                {e.isWinner && (
                  <span className="px-2 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow uppercase font-mono border border-orange-admin/40 text-orange-admin bg-orange-admin/10">
                    Winner
                  </span>
                )}
                <span className="text-[0.625rem] font-mono text-white/45 tabular-nums">
                  weight {e.weight}
                </span>
                <span className="text-[0.625rem] font-mono text-white/40 hidden sm:inline">
                  {formatTs(e.enteredAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={TrendingUp} title="Hunt predictions" count={huntPredictions.length}>
        {huntPredictions.length === 0 ? (
          <p className="text-sm text-white/40 italic">No predictions yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {huntPredictions.map((p) => (
              <li key={p.id + p.huntId} className="py-2 flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0 truncate text-white/75">
                  {p.hunt?.title || '(unknown hunt)'}
                </span>
                <span className="text-[0.625rem] font-mono text-white/55 tabular-nums">
                  {p.payoutGuess !== null && `$${p.payoutGuess}`}
                  {p.topSlotGuess && (
                    <span className="ml-2 text-white/40">{p.topSlotGuess}</span>
                  )}
                </span>
                <span className="text-[0.625rem] font-mono text-white/40 hidden sm:inline">
                  {formatTs(p.lastEditAt || p.submittedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={ListOrdered} title="Slot suggestions" count={huntSuggestions.length}>
        {huntSuggestions.length === 0 ? (
          <p className="text-sm text-white/40 italic">No suggestions yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {huntSuggestions.map((s) => (
              <li key={s.id} className="py-2 flex items-center gap-3 text-sm">
                <span
                  className={`px-2 py-0.5 text-[0.5625rem] font-bold tracking-eyebrow uppercase font-mono border ${
                    s.status === 'accepted'
                      ? 'border-emerald-signal/40 text-emerald-signal/85 bg-emerald-signal/10'
                      : s.status === 'rejected'
                        ? 'border-red-destructive/40 text-red-destructive/85 bg-red-destructive/10'
                        : 'border-white/15 text-white/45 bg-white/5'
                  }`}
                >
                  {s.status}
                </span>
                <span className="flex-1 min-w-0 truncate text-white/75">
                  {s.slotName}
                  {s.hunt?.title && (
                    <span className="text-white/40"> · {s.hunt.title}</span>
                  )}
                </span>
                <span className="text-[0.625rem] font-mono text-white/40 hidden sm:inline">
                  {formatTs(s.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Hash} title="Recent ticket ledger" count={ledger.length}>
        {ledger.length === 0 ? (
          <p className="text-sm text-white/40 italic">No ledger entries.</p>
        ) : (
          <ul className="divide-y divide-white/5 font-mono text-[0.6875rem]">
            {ledger.map((l) => (
              <li key={l.id} className="py-1.5 flex items-center gap-3">
                <span className="w-16 text-white/45">{l.reason || 'unknown'}</span>
                <span
                  className={`flex-1 ${l.delta > 0 ? 'text-emerald-signal' : 'text-red-destructive'} tabular-nums`}
                >
                  {l.delta > 0 ? `+${l.delta}` : l.delta}
                </span>
                <span className="text-white/40">{formatTs(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('tickets');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = async (sortKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/users?action=list&sort=${sortKey}`, {
        method: 'GET',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed.');
      } else {
        setUsers(data.users || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(sort);
  }, [sort]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      return (
        (u.twitchName || '').toLowerCase().includes(term) ||
        (u.displayName || '').toLowerCase().includes(term) ||
        (u.discordUsername || '').toLowerCase().includes(term)
      );
    });
  }, [users, searchTerm]);

  // Default-select the first user once loaded.
  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(filtered[0].twitchId);
    }
  }, [filtered, selectedId]);

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="inline-flex items-center gap-1.5 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/50 hover:text-white-body font-mono mb-3"
          >
            <ArrowLeft size={11} aria-hidden="true" />
            Back to hub
          </button>
          <div className="flex items-center gap-2 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-orange-admin font-mono mb-2">
            <UsersIcon size={11} aria-hidden="true" />
            <span>Module USR</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white-body">Users</h1>
          <p className="mt-1 text-sm text-white/55">
            Everyone signed in on the site. Click to see their full activity.
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-4 px-3 py-2 border border-red-destructive/40 bg-red-destructive/10 text-[0.6875rem] font-mono uppercase tracking-eyebrow text-red-destructive">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[22rem_1fr] gap-5">
        {/* Left: list */}
        <aside className="border border-white/10 bg-zinc-card/30 flex flex-col max-h-[80vh]">
          <div className="p-3 border-b border-white/10 space-y-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search login / display / discord"
                className="w-full pl-7 pr-3 py-1.5 bg-zinc-card border border-white/10 text-sm focus:outline-none focus:border-orange-admin/60"
              />
            </div>
            <div className="flex gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSort(opt.key)}
                  className={`flex-1 px-2 py-1 text-[0.625rem] font-bold tracking-eyebrow uppercase font-mono border transition-colors ${
                    sort === opt.key
                      ? 'border-orange-admin/60 bg-orange-admin/10 text-orange-admin'
                      : 'border-white/10 text-white/45 hover:text-white-body'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="text-[0.625rem] font-mono text-white/40 px-1">
              {loading
                ? 'Loading…'
                : `${filtered.length} ${filtered.length === 1 ? 'user' : 'users'}`}
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map((u) => (
              <UserRow
                key={u.twitchId}
                user={u}
                selected={selectedId === u.twitchId}
                onClick={() => setSelectedId(u.twitchId)}
              />
            ))}
            {!loading && filtered.length === 0 && (
              <div className="p-6 text-center text-[0.6875rem] font-mono uppercase tracking-eyebrow text-white/40">
                No users.
              </div>
            )}
          </div>
        </aside>

        {/* Right: detail */}
        <div className="min-w-0">
          {selectedId ? (
            <UserDetail twitchId={selectedId} />
          ) : (
            <div className="border border-white/10 bg-zinc-card/20 p-12 text-center">
              <Link2
                size={20}
                className="mx-auto mb-3 text-white/30"
                aria-hidden="true"
              />
              <p className="text-[0.6875rem] font-mono uppercase tracking-eyebrow text-white/45">
                Pick a user on the left.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
