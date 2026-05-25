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
} from 'lucide-react';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useUserDoc } from '../hooks/useUserDoc';
import { authedFetch } from '../utils/authedFetch';

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
              <span className="text-white/40 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono w-24 flex-shrink-0">
                Discord
              </span>
              <span className="text-white/40">Linking Discord — coming soon.</span>
            </li>
          </ul>
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
