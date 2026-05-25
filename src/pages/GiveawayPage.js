import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where, limit as fLimit } from 'firebase/firestore';
import { Gift, Trophy, Megaphone } from 'lucide-react';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useUserDoc } from '../hooks/useUserDoc';

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

export default function GiveawayPage() {
  const { twitchUser, loginWithTwitch } = useTwitchAuth();
  const { user } = useUserDoc();
  const [active, setActive] = useState(null);
  const [past, setPast] = useState([]);

  // Active giveaways (open / rolling)
  useEffect(() => {
    const q = query(
      collection(db, 'giveaways'),
      where('status', 'in', ['open', 'rolling']),
      orderBy('createdAt', 'desc'),
      fLimit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      setActive(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
    });
    return unsub;
  }, []);

  // Past rolled giveaways
  useEffect(() => {
    const q = query(
      collection(db, 'giveaways'),
      where('status', '==', 'rolled'),
      orderBy('confirmedAt', 'desc'),
      fLimit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      setPast(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const userRegistered = !!user;
  const eligibleNote =
    twitchUser && !userRegistered
      ? 'Your account is initializing — try refreshing once it loads.'
      : null;

  return (
    <div className="relative min-h-screen pt-20 pb-20 px-4 sm:px-6 bg-zinc-broadcast text-white-body">
      <div className="relative z-10 max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <header className="mb-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
            <span className="inline-flex items-center gap-2 text-emerald-signal">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
              </span>
              <span>GIVEAWAY</span>
            </span>
            <span className="text-white/20">·</span>
            <span>GOOFER.TV</span>
          </div>
          <h1
            className="font-black leading-[0.85] tracking-[-0.035em] text-white-body"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(2.5rem, 9vw, 3.5rem)',
            }}
          >
            <span className="block">Free</span>
            <span className="block text-emerald-signal">giveaways.</span>
          </h1>
          <p className="mt-4 text-sm text-white/60 leading-relaxed">
            Enter by typing the keyword in Twitch chat while live. One entry per
            account. Linking Discord increases your odds.
          </p>
        </header>

        {/* Active card */}
        {active ? (
          <div className="border border-emerald-signal/40 bg-zinc-card/30">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 text-[10px] font-bold tracking-eyebrow-md uppercase font-mono">
              <Megaphone size={11} className="text-emerald-signal" aria-hidden="true" />
              <span className="text-emerald-signal">
                {active.status === 'rolling' ? 'Rolling now' : 'Live giveaway'}
              </span>
              <span className="ml-auto text-white/40 tabular-nums">
                {active.entryCount ?? 0} entries
              </span>
            </div>
            <div className="px-5 py-5 space-y-3">
              <div>
                <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 font-mono mb-1">
                  Prize
                </p>
                <p className="text-2xl font-black text-white-body tracking-tight leading-tight">
                  {active.prize}
                </p>
                <p className="text-sm text-white/55 mt-1">{active.title}</p>
              </div>
              {active.status === 'open' && (
                <div className="px-4 py-3 bg-zinc-broadcast/40 border border-white/10">
                  <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/45 mb-1 font-mono">
                    Type this in Twitch chat
                  </p>
                  <p className="text-xl font-black text-emerald-signal tabular-nums">
                    {active.keyword}
                  </p>
                </div>
              )}
              {active.status === 'rolling' && (
                <p className="text-sm text-orange-admin">
                  Entries closed — a winner is being picked on stream.
                </p>
              )}

              {/* Auth state hint */}
              {!twitchUser ? (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={loginWithTwitch}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-gamba hover:bg-purple-bright text-white-body transition-colors duration-150"
                  >
                    <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
                      Sign in to enter
                    </span>
                  </button>
                  <p className="mt-2 text-[10px] tracking-eyebrow uppercase text-white/40 font-mono">
                    Your Twitch account must be linked here so we can match your chat message.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] tracking-eyebrow uppercase text-white/45 font-mono">
                  Signed in as <span className="text-emerald-signal/85">{twitchUser.displayName}</span>
                  {user?.discordVerifiedAt ? <span className="text-white/40"> · Discord linked (extra weight)</span> : null}
                </p>
              )}
              {eligibleNote && (
                <p className="text-[11px] tracking-eyebrow uppercase text-orange-admin font-mono">
                  {eligibleNote}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="border border-white/8 bg-zinc-card/30 py-12 text-center">
            <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-2 font-mono">
              No active giveaway
            </p>
            <p className="text-sm text-white/55">
              Check back during the stream — giveaways drop live.
            </p>
          </div>
        )}

        {/* Past winners */}
        {past.length > 0 && (
          <div className="border border-white/8 bg-zinc-card/30">
            <div className="px-4 py-2.5 border-b border-white/8 text-[10px] font-bold uppercase tracking-eyebrow-md text-white/55 font-mono inline-flex items-center gap-2">
              <Trophy size={11} aria-hidden="true" />
              Recent winners
            </div>
            <ul>
              {past.map((g) => (
                <li
                  key={g.id}
                  className="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-2.5 border-t border-white/8"
                >
                  {g.winner?.profileImageUrl ? (
                    <img
                      src={g.winner.profileImageUrl}
                      alt=""
                      className="w-8 h-8 rounded-full border border-white/15"
                    />
                  ) : (
                    <div className="w-8 h-8 border border-white/15" />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-white-body text-sm truncate">
                      <span className="text-emerald-signal">{g.winner?.displayName || g.winner?.twitchName}</span>{' '}
                      <span className="text-white/45 font-normal">won</span>{' '}
                      {g.prize}
                    </p>
                    <p className="text-[10px] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
                      {formatTs(g.confirmedAt)}
                    </p>
                  </div>
                  <Gift size={13} className="text-white/30" aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
