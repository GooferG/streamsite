import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
} from 'firebase/firestore';
import {
  Ticket,
  Gift,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  Sparkles,
  AlertCircle,
  Link2,
  CheckCircle2,
  ListChecks,
  ListPlus,
  Wallet,
} from 'lucide-react';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useUserDoc } from '../hooks/useUserDoc';
import { authedFetch } from '../utils/authedFetch';
import SlotAutocomplete from '../components/SlotAutocomplete';

const DISCORD_CLIENT_ID = process.env.REACT_APP_DISCORD_CLIENT_ID;
const DISCORD_REDIRECT_URI =
  process.env.REACT_APP_DISCORD_REDIRECT_URI ||
  (typeof window !== 'undefined' ? `${window.location.origin}/discord-callback` : '');

function discordAuthUrl() {
  if (!DISCORD_CLIENT_ID) return null;
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function DiscordLinkPanel({ discordId, discordUsername }) {
  const url = discordAuthUrl();
  const linked = !!discordId;

  if (linked) {
    return (
      <div className="px-5 py-4 border-t border-white/8 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-signal" aria-hidden="true" />
          <span className="text-sm font-bold text-white-body">
            Discord linked
            {discordUsername ? (
              <span className="text-white/45 font-normal"> · @{discordUsername}</span>
            ) : null}
          </span>
        </div>
        <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-emerald-signal/70 font-mono">
          Bonus claimed
        </span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="px-5 py-4 border-t border-white/8 text-[11px] tracking-eyebrow uppercase text-white/40 font-mono">
        Discord linking not configured.
      </div>
    );
  }

  return (
    <div className="px-5 py-4 border-t border-white/8">
      <a
        href={url}
        className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white-body transition-colors duration-150"
      >
        <Link2 size={13} aria-hidden="true" />
        <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
          Link Discord
        </span>
      </a>
    </div>
  );
}

function SuggestionRecord({ user }) {
  const s = user?.stats?.suggestions || {};
  const submitted = Number(s.submittedCount) || 0;
  const added = Number(s.addedCount) || 0;
  const hit = Number(s.bonusHitCount) || 0;
  const miss = Number(s.bonusMissCount) || 0;
  const played = hit + miss;
  const hitRate = played > 0 ? Math.round((hit / played) * 100) : null;

  // Hide entirely if the user has never participated.
  if (submitted === 0 && added === 0 && hit === 0 && miss === 0) return null;

  const cells = [
    { label: 'Submitted', value: submitted, tone: 'text-white-body' },
    { label: 'Added', value: added, tone: 'text-emerald-signal' },
    { label: 'Bonus hit', value: hit, tone: 'text-orange-admin' },
    {
      label: 'Hit rate',
      value: hitRate == null ? '—' : `${hitRate}%`,
      tone: hitRate == null ? 'text-white/45' : 'text-emerald-signal',
    },
  ];

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      <div className="px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <ListChecks size={11} aria-hidden="true" />
          <span>Suggestion record</span>
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 px-3 py-4 gap-0">
        {cells.map((c, i) => (
          <div
            key={c.label}
            className={`px-3 py-1 ${i > 0 ? 'border-l border-white/8' : ''}`}
          >
            <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono mb-1">
              {c.label}
            </p>
            <p className={`text-2xl font-black tabular-nums leading-none ${c.tone}`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const MAX_SLOTS = 6;

function SlotProfileCard({ user }) {
  const initialSlots = Array.isArray(user?.slotProfile?.defaultSlots)
    ? user.slotProfile.defaultSlots
    : [];
  const initialDiscoverable = user?.slotProfile?.discoverable === true;

  const [slots, setSlots] = useState(() => {
    const padded = [...initialSlots];
    while (padded.length < MAX_SLOTS) padded.push('');
    return padded.slice(0, MAX_SLOTS);
  });
  const [discoverable, setDiscoverable] = useState(initialDiscoverable);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState(null);

  function setSlot(i, val) {
    setSlots((arr) => arr.map((s, idx) => (idx === i ? val : s)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const defaultSlots = slots.map((s) => s.trim()).filter(Boolean);
    try {
      const res = await authedFetch('/api/me/slot-profile', {
        method: 'POST',
        body: JSON.stringify({ defaultSlots, discoverable }),
      });
      if (!res.ok) {
        setError('Could not save. Try again.');
      } else {
        setSavedAt(Date.now());
      }
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/40 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      <div className="px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <ListPlus size={11} aria-hidden="true" />
          <span>Default slots</span>
        </span>
      </div>
      <div className="px-5 py-5 space-y-4">
        <p className="text-sm text-white/65">
          Save your go-to slots. When a host runs a bonus hunt, they can drop
          these into their list for you — even while you're away.
        </p>

        <div className="space-y-2">
          {slots.map((s, i) => (
            <SlotAutocomplete
              key={i}
              value={s}
              onChange={(v) => setSlot(i, v)}
              placeholder={`Slot ${i + 1}`}
              className={inputCls}
            />
          ))}
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={discoverable}
            onChange={(e) => setDiscoverable(e.target.checked)}
            className="w-4 h-4 accent-emerald-signal"
          />
          <span className="text-sm text-white/75">
            Let hunt hosts add my slots
          </span>
        </label>

        {error && (
          <p className="text-red-destructive text-sm">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40"
          >
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              {saving ? 'Saving…' : 'Save defaults'}
            </span>
          </button>
          {savedAt > 0 && !saving && !error && (
            <span className="inline-flex items-center gap-1.5 text-emerald-signal text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              <CheckCircle2 size={12} aria-hidden="true" /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PayoutProfileCard({ user }) {
  const initial = user?.payoutProfile?.rainbetUsername || '';
  const [rainbet, setRainbet] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState(null);

  async function save() {
    setSaving(true);
    setError(null);
    const rainbetUsername = rainbet.trim();
    try {
      const res = await authedFetch('/api/me/payout-profile', {
        method: 'POST',
        body: JSON.stringify({ rainbetUsername }),
      });
      if (!res.ok) {
        setError('Could not save. Try again.');
      } else {
        setSavedAt(Date.now());
      }
    } catch {
      setError('Network error.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2.5 text-sm text-white-body placeholder:text-white/40 focus:border-emerald-signal/70 focus:outline-none transition-colors duration-150';

  return (
    <div className="border border-white/8 bg-zinc-card/30">
      <div className="px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <Wallet size={11} aria-hidden="true" />
          <span>Rainbet payout</span>
        </span>
      </div>
      <div className="px-5 py-5 space-y-4">
        <p className="text-sm text-white/65">
          Save your Rainbet username so the host knows where to send your cut
          when a hunt pays out.
        </p>

        <input
          type="text"
          value={rainbet}
          onChange={(e) => setRainbet(e.target.value)}
          placeholder="Rainbet username"
          maxLength={50}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={inputCls}
        />

        {error && <p className="text-red-destructive text-sm">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-40"
          >
            <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              {saving ? 'Saving…' : 'Save Rainbet'}
            </span>
          </button>
          {savedAt > 0 && !saving && !error && (
            <span className="inline-flex items-center gap-1.5 text-emerald-signal text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
              <CheckCircle2 size={12} aria-hidden="true" /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const REASON_LABELS = {
  watchtime: 'Watch time',
  daily: 'Daily claim',
  admin_grant: 'Granted',
  discord_link: 'Discord linked',
  redeem: 'Redemption',
  refund: 'Refund',
};

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

function useCountdown(targetMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetMs || targetMs <= Date.now()) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [targetMs]);
  if (!targetMs) return null;
  const diff = targetMs - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MyAccountPage() {
  const { twitchUser, loginWithTwitch } = useTwitchAuth();
  const { user } = useUserDoc();
  const [ledger, setLedger] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const countdown = useCountdown(cooldownUntil);

  useEffect(() => {
    if (!twitchUser?.twitchId) return undefined;
    const lq = query(
      collection(db, 'ticket_ledger'),
      where('userId', '==', twitchUser.twitchId),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    const unsubL = onSnapshot(lq, (snap) => {
      setLedger(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const rq = query(
      collection(db, 'redemptions'),
      where('userId', '==', twitchUser.twitchId),
      orderBy('createdAt', 'desc'),
      limit(15)
    );
    const unsubR = onSnapshot(rq, (snap) => {
      setRedemptions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubL();
      unsubR();
    };
  }, [twitchUser?.twitchId]);

  // Compute initial cooldown from server-side timestamp.
  useEffect(() => {
    if (!user?.lastDailyClaimAt) {
      setCooldownUntil(null);
      return;
    }
    const lastMs = user.lastDailyClaimAt.toMillis
      ? user.lastDailyClaimAt.toMillis()
      : new Date(user.lastDailyClaimAt).getTime();
    const next = lastMs + 22 * 60 * 60 * 1000;
    setCooldownUntil(next > Date.now() ? next : null);
  }, [user?.lastDailyClaimAt]);

  const handleClaimDaily = async () => {
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await authedFetch('/api/me/claim-daily', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'COOLDOWN' && data.nextAt) {
          setCooldownUntil(data.nextAt);
          setClaimError('Already claimed — come back later.');
        } else {
          setClaimError(data.error || 'Claim failed.');
        }
      }
    } catch (err) {
      setClaimError('Network error.');
    } finally {
      setClaiming(false);
    }
  };

  if (!twitchUser) {
    return (
      <div className="relative min-h-screen pt-20 pb-20 px-4 sm:px-6 bg-zinc-broadcast text-white-body">
        <div className="max-w-md mx-auto">
          <div className="border border-white/8 bg-zinc-card/30">
            <div className="px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md text-orange-admin font-mono">
              <span className="inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-admin" />
                Access required
              </span>
            </div>
            <div className="px-5 py-6 space-y-4">
              <p className="text-sm text-white/70">
                Sign in with Twitch to view your account.
              </p>
              <button
                type="button"
                onClick={loginWithTwitch}
                className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 bg-purple-gamba hover:bg-purple-bright text-white-body transition-colors duration-150"
              >
                <span className="text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono">
                  Sign in with Twitch
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pt-20 pb-20 px-4 sm:px-6 bg-zinc-broadcast text-white-body">
      <div className="relative z-10 max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <header className="mb-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
            <span className="inline-flex items-center gap-2 text-emerald-signal">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
              <span>VIEWER ACCOUNT</span>
            </span>
            <span className="text-white/20">·</span>
            <span className="text-white/70 tracking-eyebrow-lg truncate max-w-[20ch]">
              {twitchUser.displayName?.toUpperCase()}
            </span>
          </div>

          <h1
            className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(2.25rem, 7vw, 3rem)',
            }}
          >
            <span className="block">My</span>
            <span className="block text-emerald-signal">account.</span>
          </h1>
        </header>

        {/* Balance card */}
        <div className="border border-white/8 bg-zinc-card/30">
          <div className="px-4 py-2.5 border-b border-white/8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
            <span className="inline-flex items-center gap-2 text-emerald-signal">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
              <span>Balance</span>
            </span>
          </div>
          <div className="px-5 py-6 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-1 font-mono">
                Current tickets
              </p>
              <p className="inline-flex items-baseline gap-2">
                <Ticket size={20} className="text-emerald-signal" aria-hidden="true" />
                <span className="text-5xl font-black text-white-body tabular-nums leading-none">
                  {user?.tickets ?? '—'}
                </span>
              </p>
              <div className="flex gap-4 mt-3 text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono">
                <span>
                  Earned <span className="text-emerald-signal/80 tabular-nums">{user?.totalEarned ?? 0}</span>
                </span>
                <span>
                  Spent <span className="text-orange-admin/80 tabular-nums">{user?.totalSpent ?? 0}</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClaimDaily}
              disabled={claiming || !!cooldownUntil}
              className="inline-flex items-center gap-2 px-4 py-3 bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
            >
              <Gift size={14} aria-hidden="true" />
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                {claiming
                  ? 'Claiming…'
                  : cooldownUntil
                    ? `Next in ${countdown ?? '—'}`
                    : 'Claim daily'}
              </span>
            </button>
          </div>
          {claimError && (
            <div className="flex items-center gap-2 px-5 pb-4 -mt-2 text-[11px] font-bold tracking-eyebrow uppercase text-red-destructive font-mono">
              <AlertCircle size={12} aria-hidden="true" />
              {claimError}
            </div>
          )}
        </div>

        <SuggestionRecord user={user} />

        {/* key re-inits the card's local state once the user doc streams in
            (useUserDoc is async; the card derives initial values from `user`). */}
        <SlotProfileCard key={user?.slotProfile ? 'loaded' : 'empty'} user={user} />

        {/* key re-inits the card's local state once the user doc streams in. */}
        <PayoutProfileCard key={user?.payoutProfile ? 'payout-loaded' : 'payout-empty'} user={user} />

        {/* Earn methods info */}
        <div className="border border-white/8 bg-zinc-card/30">
          <div className="px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
            <span className="inline-flex items-center gap-2 text-emerald-signal">
              <Sparkles size={11} aria-hidden="true" />
              <span>How to earn</span>
            </span>
          </div>
          <ul className="px-5 py-4 space-y-2 text-sm text-white/65">
            <li className="flex items-baseline gap-2">
              <span className="text-emerald-signal text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono w-24 flex-shrink-0">
                Watch
              </span>
              <span>Hang out in chat while the stream is live — tickets drop every 5 minutes.</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-emerald-signal text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono w-24 flex-shrink-0">
                Daily
              </span>
              <span>Claim once every 22 hours from this page.</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-emerald-signal text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono w-24 flex-shrink-0">
                Discord
              </span>
              <span>One-time bonus for linking your Discord (must be in the server).</span>
            </li>
          </ul>
          <DiscordLinkPanel
            discordId={user?.discordId}
            discordUsername={user?.discordUsername}
          />
        </div>

        {/* Ledger */}
        <div className="border border-white/8 bg-zinc-card/30">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
            <span className="inline-flex items-center gap-2 text-white/55">
              <Clock size={11} aria-hidden="true" />
              <span>Ledger</span>
            </span>
            <span className="text-white/30 tracking-eyebrow-lg">
              Last {ledger.length}
            </span>
          </div>
          {ledger.length === 0 ? (
            <p className="px-5 py-6 text-sm text-white/50">No activity yet.</p>
          ) : (
            <ul>
              {ledger.map((entry) => {
                const earn = entry.delta > 0;
                return (
                  <li
                    key={entry.id}
                    className="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-2.5 border-t border-white/8"
                  >
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 border ${
                        earn
                          ? 'border-emerald-signal/40 text-emerald-signal'
                          : 'border-orange-admin/40 text-orange-admin'
                      }`}
                    >
                      {earn ? (
                        <ArrowUpRight size={12} aria-hidden="true" />
                      ) : (
                        <ArrowDownRight size={12} aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white-body truncate">
                        {REASON_LABELS[entry.reason] || entry.reason}
                        {entry.itemName ? (
                          <span className="text-white/45"> · {entry.itemName}</span>
                        ) : null}
                      </p>
                      <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
                        {formatTs(entry.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`tabular-nums text-sm font-bold ${
                        earn ? 'text-emerald-signal' : 'text-orange-admin'
                      }`}
                    >
                      {earn ? '+' : ''}
                      {entry.delta}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Redemption history */}
        {redemptions.length > 0 && (
          <div className="border border-white/8 bg-zinc-card/30">
            <div className="px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md text-white/55 font-mono">
              Redemptions
            </div>
            <ul>
              {redemptions.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2.5 border-t border-white/8"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white-body truncate">
                      {r.itemName}
                    </p>
                    <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
                      {formatTs(r.createdAt)} · {r.kind}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono px-2 py-1 border ${
                      r.status === 'fulfilled'
                        ? 'text-emerald-signal border-emerald-signal/40'
                        : r.status === 'cancelled'
                          ? 'text-red-destructive border-red-destructive/40'
                          : 'text-orange-admin border-orange-admin/40'
                    }`}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
