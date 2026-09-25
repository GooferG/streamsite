import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where, limit as fLimit } from 'firebase/firestore';
import { Gift, Trophy, Megaphone, Users, Timer } from 'lucide-react';
import { db } from '../config/firebase';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useUserDoc } from '../hooks/useUserDoc';
import { useClock } from '../hooks/useClock';
import GiveawayEntriesGrid from '../components/GiveawayEntriesGrid';
import RevealScreen, { CrtStyles, useRevealState } from '../components/giveaway/RevealScreen';
import { formatClock, formatMoney, formatMulti, tsMillis } from '../utils/giveaway';

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

// Which bonus tickets this giveaway hands out, in viewer words.
function bonusList(weights = {}) {
  const out = [];
  if (weights.sub) out.push('subs');
  if (weights.vip) out.push('VIPs');
  if (weights.discord) out.push('Discord linked');
  if (weights.registered) out.push('signed in here');
  return out;
}

function useTimeUp(giveaway) {
  const closesAt = tsMillis(giveaway?.closesAt);
  const now = useClock({ intervalMs: 500, active: !!closesAt && giveaway?.status === 'open' });
  return { closesAt, now, timeUp: closesAt != null && now >= closesAt };
}

function PublicReveal({ giveaway, reveal }) {
  // Entrants for the channel surf. Frozen while rolling, so one read is fine.
  const [pool, setPool] = useState([]);
  useEffect(() => {
    const q = query(
      collection(db, 'giveaways', giveaway.id, 'entries'),
      orderBy('enteredAt', 'desc'),
      fLimit(40)
    );
    return onSnapshot(q, (snap) => setPool(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [giveaway.id]);
  const w = giveaway.winner;

  return (
    <div className="mt-5 grid grid-cols-1 sm:grid-cols-[15rem_1fr] gap-5 items-center">
      <CrtStyles />
      <div className="w-full max-w-[15rem]">
        <RevealScreen giveaway={giveaway} pool={pool} reveal={reveal} size="md" />
      </div>
      <div className="min-w-0">
        {reveal.landed ? (
          <>
            <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal mb-1 font-mono">
              Winner
            </p>
            <p className="text-3xl font-black text-white-body tracking-tight leading-none truncate">
              {w.displayName || w.twitchName}
            </p>
            <p className="mt-2 text-sm text-white/55">They have to answer in chat to claim it.</p>
          </>
        ) : (
          <p
            className="gvo-motion text-[0.6875rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono"
            style={{ animation: 'gvo-blink 0.8s steps(1) infinite' }}
          >
            Picking a winner on stream…
          </p>
        )}
      </div>
    </div>
  );
}

// A bonus-buy winner's bonus being played on stream.
function PublicNowPlaying({ giveaway }) {
  const p = giveaway.playing;
  const buy = p.buyAmount ?? giveaway.buyAmount ?? null;
  const hit = p.payout != null && buy != null && p.payout >= buy;
  const name = p.displayName || p.twitchName;
  return (
    <div className="mt-5 flex items-center gap-4 px-4 py-3 border border-orange-admin/40 bg-orange-admin/[0.05]">
      {p.slotImage && (
        <img src={p.slotImage} alt="" className="w-14 h-14 object-cover border border-white/15 flex-shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-orange-admin font-mono">
          Playing {name}&apos;s bonus
        </p>
        <p className="text-lg font-black text-white-body truncate">{p.slotName || 'Picking a slot…'}</p>
        <p className="text-sm text-white/55">
          {p.payout != null ? (
            <>
              Paid{' '}
              <span className={`font-mono font-bold ${hit ? 'text-emerald-signal' : 'text-white-body'}`}>
                {formatMoney(p.payout)}
              </span>
              {formatMulti(p.payout, buy) && <span className="text-white/40"> · {formatMulti(p.payout, buy)}</span>}
            </>
          ) : (
            `${buy != null ? `${formatMoney(buy)} buy` : giveaway.prize}, payout pending`
          )}
        </p>
      </div>
    </div>
  );
}

export default function GiveawayPage() {
  const { twitchUser, loginWithTwitch } = useTwitchAuth();
  const { user } = useUserDoc();
  const [active, setActive] = useState(null);
  const [past, setPast] = useState([]);
  const reveal = useRevealState(active);
  const { closesAt, now, timeUp } = useTimeUp(active);

  useEffect(() => {
    const q = query(
      collection(db, 'giveaways'),
      where('status', 'in', ['open', 'closed', 'rolling', 'playing']),
      orderBy('createdAt', 'desc'),
      fLimit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      setActive(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
    });
    return unsub;
  }, []);

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
      ? 'Your account is still setting up. Refresh once it loads.'
      : null;
  const entriesOpen = active?.status === 'open' && !timeUp;
  const rolling = active?.status === 'rolling' && !!active?.winner;
  const playing = active?.status === 'playing' && !!active?.playing;
  const bonuses = bonusList(active?.weights);
  const siteBonus = !!(active?.weights?.registered || active?.weights?.discord);

  return (
    <div className="relative min-h-screen pt-20 pb-20 px-4 sm:px-6 bg-zinc-broadcast text-white-body">
      <div className="relative z-10 max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <header className="mb-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-5 font-mono">
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
            account. Some giveaways hand out bonus tickets for subs, VIPs, or
            signing in here.
          </p>
        </header>

        {/* Active card */}
        {active ? (
          <>
            <div className="relative overflow-hidden border border-emerald-signal/40 bg-zinc-card/40">
              <div
                className="pointer-events-none absolute -top-32 -right-24 w-96 h-96 rounded-full bg-emerald-signal/10 blur-3xl motion-reduce:hidden"
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold tracking-eyebrow-md uppercase font-mono">
                <Megaphone size={11} className="text-emerald-signal" aria-hidden="true" />
                <span className="text-emerald-signal">
                  {rolling
                    ? 'Rolling now'
                    : playing
                      ? 'Bonus on stream'
                      : entriesOpen
                        ? 'Live giveaway'
                        : 'Entries closed'}
                </span>
                <span className="ml-auto text-white/40 tabular-nums">
                  {String(active.entryCount ?? 0).padStart(4, '0')} entries
                </span>
              </div>

              <div className="relative px-5 sm:px-7 py-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-end">
                <div className="min-w-0">
                  <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal/80 mb-2 font-mono">
                    ▸ Prize
                  </p>
                  <p
                    className="font-black text-white-body leading-[0.9] tracking-[-0.03em]"
                    style={{
                      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                      fontSize: 'clamp(1.75rem, 5vw, 2.75rem)',
                    }}
                  >
                    {active.prize}
                  </p>
                  <p className="text-sm text-white/55 mt-1">{active.title}</p>

                  {entriesOpen && (
                    <div className="mt-5 inline-flex items-baseline gap-3 px-4 py-3 border-2 border-emerald-signal/50 bg-emerald-signal/5">
                      <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-emerald-signal/80 font-mono">
                        Type in chat
                      </span>
                      <span
                        className="text-2xl sm:text-3xl font-black text-emerald-signal tracking-tight tabular-nums font-mono"
                      >
                        {active.keyword}
                      </span>
                    </div>
                  )}
                  {entriesOpen && closesAt && (
                    <p className="mt-3 flex items-center gap-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase text-white/55 font-mono">
                      <Timer size={12} aria-hidden="true" />
                      Closes in
                      <span className="text-sm font-black tabular-nums tracking-normal text-white-body">
                        {formatClock((closesAt - now) / 1000)}
                      </span>
                    </p>
                  )}
                  {entriesOpen && bonuses.length > 0 && (
                    <p className="mt-3 text-[0.6875rem] tracking-eyebrow uppercase text-white/45 font-mono">
                      +1 ticket each for {bonuses.join(', ')}
                    </p>
                  )}
                  {!entriesOpen && !rolling && !playing && (
                    <p className="mt-4 text-sm text-orange-admin">
                      Entries are closed. The winner gets picked on stream.
                    </p>
                  )}
                  {rolling && <PublicReveal giveaway={active} reveal={reveal} />}
                  {playing && <PublicNowPlaying giveaway={active} />}

                  {!entriesOpen ? null : !twitchUser ? (
                    siteBonus && (
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={loginWithTwitch}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-gamba hover:bg-purple-bright text-white-body transition-colors duration-150"
                      >
                        <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                          Sign in for a bonus ticket
                        </span>
                      </button>
                      <p className="mt-2 text-[0.625rem] tracking-eyebrow uppercase text-white/40 font-mono">
                        Anyone in chat can enter. Signing in here adds a bonus ticket.
                      </p>
                    </div>
                    )
                  ) : (
                    <p className="mt-4 text-[0.6875rem] tracking-eyebrow uppercase text-white/45 font-mono">
                      Signed in as <span className="text-emerald-signal/85">{twitchUser.displayName}</span>
                      {user?.discordVerifiedAt ? <span className="text-white/40"> · Discord linked</span> : null}
                    </p>
                  )}
                  {eligibleNote && (
                    <p className="mt-2 text-[0.6875rem] tracking-eyebrow uppercase text-orange-admin font-mono">
                      {eligibleNote}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Entries grid */}
            <div className="border border-white/8 bg-zinc-card/30 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
                <span className="inline-flex items-center gap-2 text-white/55">
                  <Users size={11} aria-hidden="true" />
                  Who&apos;s in
                </span>
                <span className="text-white/35 tabular-nums">
                  {active.entryCount ?? 0} total
                </span>
              </div>
              <GiveawayEntriesGrid
                giveawayId={active.id}
                rolling={active.status === 'rolling'}
                // Held back until the reveal lands, so the grid doesn't
                // spoil the pick before the stream shows it.
                winnerTwitchId={reveal.landed ? active.winnerTwitchId || null : null}
                skippedIds={active.skippedIds || []}
                wonIds={(active.winners || []).map((w) => w.twitchId).filter(Boolean)}
              />
            </div>
          </>
        ) : (
          <div className="border border-white/8 bg-zinc-card/30 py-12 text-center">
            <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-2 font-mono">
              No active giveaway
            </p>
            <p className="text-sm text-white/55">
              Check back during the stream. Giveaways drop live.
            </p>
          </div>
        )}

        {/* Past winners */}
        {past.length > 0 && (
          <div className="border border-white/8 bg-zinc-card/30">
            <div className="px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/55 font-mono inline-flex items-center gap-2">
              <Trophy size={11} aria-hidden="true" />
              Recent winners
            </div>
            <ul>
              {past.flatMap((g) => {
                // A giveaway may have named several winners; older docs only
                // carry `winner`. One row each, newest giveaway first.
                const rows =
                  g.winners && g.winners.length > 0 ? g.winners : g.winner ? [g.winner] : [];
                return rows.map((w, i) => (
                  <li
                    key={`${g.id}-${w.twitchId || w.twitchName || i}`}
                    className="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-4 py-2.5 border-t border-white/8"
                  >
                    {w.profileImageUrl ? (
                      <img
                        src={w.profileImageUrl}
                        alt=""
                        className="w-8 h-8 rounded-full border border-white/15"
                      />
                    ) : (
                      <div className="w-8 h-8 border border-white/15" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-white-body text-sm truncate">
                        <span className="text-emerald-signal">{w.displayName || w.twitchName}</span>{' '}
                        <span className="text-white/45 font-normal">won</span>{' '}
                        {w.payout != null ? (
                          <>
                            {formatMoney(w.payout)}
                            {w.slotName && <span className="text-white/45 font-normal"> on {w.slotName}</span>}
                          </>
                        ) : (
                          g.prize
                        )}
                      </p>
                      <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/40 font-mono">
                        {formatTs(g.confirmedAt)}
                        {w.payout != null && <span> · {g.prize}</span>}
                        {rows.length > 1 && <span className="text-white/25"> · {i + 1}/{rows.length}</span>}
                      </p>
                    </div>
                    <Gift size={13} className="text-white/30" aria-hidden="true" />
                  </li>
                ));
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
