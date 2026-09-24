import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useGiveawayFeed } from '../hooks/useGiveawayFeed';
import { useClock } from '../hooks/useClock';
import RevealScreen, {
  CrtStyles,
  GiveawayAvatar,
  useRevealState,
} from '../components/giveaway/RevealScreen';
import {
  REVEAL_MS,
  formatClock,
  tsMillis,
} from '../utils/giveaway';

// OBS browser source for giveaways. Transparent, no controls; everything is
// driven by Firestore, so the operator runs the giveaway from /admin/giveaways
// and this follows along.
//
// Query params:
//   pos=bl|br|tl|tr   corner for the entry card (default bl)
//   sound=1           static/channel-click sound on the reveal (OBS audio)
//   demo=1            loop a fake giveaway, for positioning it in OBS

const WRAP_MS = 12000;

const POSITION = {
  bl: 'left-8 bottom-8',
  br: 'right-8 bottom-8',
  tl: 'left-8 top-8',
  tr: 'right-8 top-8',
};

const SCANLINES_SOFT =
  'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)';

// ─── Sound ──────────────────────────────────────────────────────────────────

function useOverlaySound(enabled) {
  const ctxRef = useRef(null);
  const noiseRef = useRef(null);

  useEffect(
    () => () => {
      ctxRef.current?.close?.().catch(() => {});
      ctxRef.current = null;
    },
    []
  );

  const getCtx = useCallback(() => {
    if (!enabled) return null;
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      ctxRef.current = ctx;
      noiseRef.current = buf;
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, [enabled]);

  const noise = useCallback(
    (ms, gain, freq) => {
      const ctx = getCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseRef.current;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      src.connect(filter).connect(g).connect(ctx.destination);
      src.start(t);
      src.stop(t + ms / 1000 + 0.02);
    },
    [getCtx]
  );

  const thump = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.28);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.34);
  }, [getCtx]);

  return useMemo(
    () => ({
      tick: () => noise(30, 0.22, 2600),
      burst: (ms = 300) => noise(ms, 0.3, 1400),
      land: () => {
        noise(180, 0.28, 900);
        thump();
      },
    }),
    [noise, thump]
  );
}

// ─── Demo feed ──────────────────────────────────────────────────────────────

const DEMO_NAMES = [
  'couchgoblin', 'LateNiteLarry', 'BeanWater', 'vhs_tape_dan', 'MothToLamp',
  'sofa_king', 'GRAINFILTER', 'nightowl_88', 'ch3_static', 'Snackrifice',
  'TubeAmp', 'dialtone_dee',
];
const DEMO = { entryEvery: 800, openMs: 11000 };
DEMO.rollAt = DEMO.openMs + 1800;
DEMO.msgAt = DEMO.rollAt + REVEAL_MS + 2600;
DEMO.confirmAt = DEMO.msgAt + 2200;
DEMO.endAt = DEMO.confirmAt + 3500;
DEMO.cycleMs = DEMO.endAt + 7000;

function demoSnapshot(now, startedAt) {
  const elapsed = (now - startedAt) % DEMO.cycleMs;
  const cycleStart = now - elapsed;
  const count = Math.min(DEMO_NAMES.length, Math.floor(elapsed / DEMO.entryEvery) + 1);
  const entries = DEMO_NAMES.slice(0, count)
    .map((name, i) => ({
      id: `demo-${i}`,
      twitchId: `demo-${i}`,
      displayName: name,
      twitchName: name.toLowerCase(),
      weight: i % 3 === 0 ? 3 : i % 4 === 0 ? 2 : 1,
      enteredAt: cycleStart + i * DEMO.entryEvery,
    }))
    .reverse();
  const winnerEntry = { ...(entries.find((e) => e.id === 'demo-5') || entries[0]) };
  let status = 'open';
  if (elapsed >= DEMO.endAt) status = 'rolled';
  else if (elapsed >= DEMO.rollAt) status = 'rolling';
  else if (elapsed >= DEMO.openMs) status = 'closed';
  const picked = status === 'rolling' || status === 'rolled';
  const giveaway = {
    id: 'demo',
    title: 'Demo giveaway',
    prize: 'Hades II · Steam key',
    keyword: 'tunedin',
    status,
    entryCount: count,
    totalWeight: entries.reduce((a, e) => a + e.weight, 0),
    durationSec: DEMO.openMs / 1000,
    closesAt: cycleStart + DEMO.openMs,
    targetWinners: 1,
    winner: picked ? winnerEntry : null,
    winnerTwitchId: picked ? winnerEntry.twitchId : null,
    rolledAt: picked ? cycleStart + DEMO.rollAt : null,
    winners: elapsed >= DEMO.confirmAt ? [winnerEntry] : [],
    endedAt: status === 'rolled' ? cycleStart + DEMO.endAt : null,
  };
  const firstMessage =
    status === 'rolling' && elapsed >= DEMO.msgAt
      ? {
          id: 'demo-msg',
          text: 'WAIT i actually won?? lets gooo',
          twitchName: winnerEntry.displayName,
          createdAt: cycleStart + DEMO.msgAt,
        }
      : null;
  return { giveaway, entries, firstMessage };
}

function useDemoFeed(enabled) {
  const startedAt = useRef(Date.now());
  const now = useClock({ intervalMs: 200, active: enabled });
  return useMemo(
    () => (enabled ? demoSnapshot(now, startedAt.current) : null),
    [enabled, now]
  );
}

// ─── Entry card (open / closed) ─────────────────────────────────────────────

function Countdown({ giveaway }) {
  const closesAt = tsMillis(giveaway.closesAt);
  const now = useClock({ intervalMs: 250, active: !!closesAt });
  if (!closesAt) return null;
  const total = (Number(giveaway.durationSec) || 0) * 1000;
  const left = Math.max(0, closesAt - now);
  const pct = total > 0 ? Math.min(100, (left / total) * 100) : 0;
  const hot = left > 0 && left <= 30000;
  return (
    <div className="px-6 pb-5">
      <div className="flex items-baseline justify-between mb-2 font-mono font-bold uppercase tracking-eyebrow-md text-xs">
        <span className={hot ? 'text-orange-admin' : 'text-white/55'}>
          {left > 0 ? 'Closes in' : "Time's up"}
        </span>
        <span
          className={`gvo-motion text-2xl font-black tabular-nums tracking-normal ${
            left === 0 ? 'text-white/40' : hot ? 'text-orange-admin' : 'text-white-body'
          }`}
          style={hot ? { animation: 'gvo-blink 1s steps(1) infinite' } : undefined}
        >
          {formatClock(left / 1000)}
        </span>
      </div>
      <div className="h-1.5 bg-white/10 overflow-hidden">
        <div
          className={`h-full transition-[width] duration-300 ease-linear ${hot ? 'bg-orange-admin' : 'bg-emerald-signal'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EntryCard({ giveaway, entries, position }) {
  const closesAt = tsMillis(giveaway.closesAt);
  const now = useClock({ intervalMs: 500, active: !!closesAt && giveaway.status === 'open' });
  const timeUp = closesAt != null && now >= closesAt;
  const open = giveaway.status === 'open' && !timeUp;
  const count = giveaway.entryCount ?? entries.length;
  const latest = entries[0];
  const faces = entries.slice(0, 9);
  const winners = giveaway.winners || [];
  const target = Number(giveaway.targetWinners) || 1;

  return (
    <section
      className={`gvo-motion fixed ${position} w-[30rem] max-w-[calc(100vw-4rem)] bg-zinc-broadcast/[0.93] border border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden`}
      style={{ animation: 'gvo-rise 0.4s ease-out both' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: SCANLINES_SOFT }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-emerald-signal/15 blur-3xl"
      />

      <div className="relative flex items-center gap-3 px-6 py-3 border-b border-white/10 font-mono font-bold uppercase tracking-eyebrow-md text-xs">
        <span className="relative flex w-2 h-2">
          <span
            className={`absolute inset-0 rounded-full ${open ? 'bg-emerald-signal motion-safe:animate-ping opacity-60' : 'bg-orange-admin'}`}
          />
          <span className={`relative w-2 h-2 rounded-full ${open ? 'bg-emerald-signal' : 'bg-orange-admin'}`} />
        </span>
        <span className={open ? 'text-emerald-signal' : 'text-orange-admin'}>Giveaway</span>
        <span className="text-white/30">CH 07</span>
        <span className="ml-auto text-white/45">
          Entries{' '}
          <span
            key={count}
            className="gvo-motion inline-block text-white-body text-lg font-black tabular-nums tracking-normal"
            style={{ animation: 'gvo-bump 0.35s ease-out both' }}
          >
            {String(count).padStart(4, '0')}
          </span>
        </span>
      </div>

      <div className="relative px-6 pt-5 pb-4">
        <p className="font-mono font-bold uppercase tracking-eyebrow-lg text-[0.6875rem] text-white/45 mb-1.5">
          Prize
        </p>
        <p className="font-black text-white-body text-[2.1rem] leading-[0.95] tracking-[-0.02em] line-clamp-2">
          {giveaway.prize}
        </p>

        {open ? (
          <div className="mt-5 flex items-center gap-4 px-4 py-3 border-2 border-emerald-signal/55 bg-emerald-signal/[0.07]">
            <span className="font-mono font-bold uppercase tracking-eyebrow-md text-[0.6875rem] text-emerald-signal/80 leading-tight">
              Type in
              <br />
              chat
            </span>
            <span className="font-mono font-black text-emerald-signal text-[2.5rem] leading-none tracking-tight truncate">
              {giveaway.keyword}
            </span>
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-3 px-4 py-3 border-2 border-orange-admin/45 bg-orange-admin/[0.06]">
            <span
              className="gvo-motion font-mono font-black uppercase tracking-eyebrow-md text-orange-admin text-lg"
              style={{ animation: 'gvo-blink 1.4s steps(1) infinite' }}
            >
              Entries closed
            </span>
            <span className="ml-auto font-mono font-bold uppercase tracking-eyebrow text-xs text-white/55">
              Drawing soon
            </span>
          </div>
        )}

        {faces.length > 0 && (
          <div className="mt-5 flex items-center gap-3">
            <div className="flex -space-x-2.5">
              {faces.map((e) => (
                <GiveawayAvatar
                  key={e.id}
                  entry={e}
                  className="gvo-motion w-9 h-9 text-sm"
                  ringClass="border-zinc-broadcast"
                  style={{ animation: 'gvo-pop 0.35s ease-out both' }}
                />
              ))}
            </div>
            {count > faces.length && (
              <span className="font-mono font-bold text-xs text-white/45 tabular-nums">
                +{count - faces.length}
              </span>
            )}
          </div>
        )}
        {latest && open && (
          <p
            key={latest.id}
            className="gvo-motion mt-3 font-mono text-sm text-white/80 truncate"
            style={{ animation: 'gvo-ticker 3s ease-out both' }}
          >
            <span className="text-emerald-signal font-bold">{latest.displayName || latest.twitchName}</span>{' '}
            tuned in
            {(latest.weight || 1) > 1 && (
              <span className="text-white/40"> · {latest.weight} tickets</span>
            )}
          </p>
        )}
      </div>

      {winners.length > 0 && (
        <div className="relative px-6 py-3 border-t border-white/10 flex items-center gap-3">
          <span className="font-mono font-bold uppercase tracking-eyebrow-md text-[0.6875rem] text-emerald-signal">
            Won so far{target > 1 ? ` · ${winners.length}/${target}` : ''}
          </span>
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {winners.map((w, i) => (
              <span key={`${w.twitchId}-${i}`} className="inline-flex items-center gap-1.5 min-w-0">
                <GiveawayAvatar entry={w} className="w-6 h-6 text-[0.625rem]" ringClass="border-emerald-signal/60" />
                <span className="text-sm font-bold text-white-body truncate max-w-[8rem]">
                  {w.displayName || w.twitchName}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="relative">{open && closesAt && <Countdown giveaway={giveaway} />}</div>
    </section>
  );
}

// ─── Reveal stage (rolling) ─────────────────────────────────────────────────

function ClaimClock({ giveaway, reveal, firstMessage }) {
  const name = giveaway.winner?.displayName || giveaway.winner?.twitchName;
  const answeredAt = tsMillis(firstMessage?.createdAt);
  const landedAt = tsMillis(giveaway.rolledAt) + REVEAL_MS;
  const seconds = answeredAt ? Math.max(0, (answeredAt - landedAt) / 1000) : reveal.sinceLanded;
  const tone = answeredAt
    ? 'text-emerald-signal border-emerald-signal/50'
    : seconds >= 90
      ? 'text-red-destructive border-red-destructive/60'
      : seconds >= 30
        ? 'text-orange-admin border-orange-admin/60'
        : 'text-white-body border-white/25';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`flex items-center gap-4 px-5 py-2.5 border-2 bg-zinc-broadcast/85 transition-colors duration-500 ${tone}`}>
        <span className="font-mono font-bold uppercase tracking-eyebrow-md text-xs text-white/60">
          {answeredAt ? `${name} answered in` : `Waiting on ${name}`}
        </span>
        <span className="font-mono font-black text-3xl tabular-nums leading-none">{formatClock(seconds)}</span>
      </div>
      {firstMessage && (
        <p
          className="gvo-motion max-w-[36rem] px-4 py-2.5 bg-zinc-card/95 border border-emerald-signal/40 text-lg text-white-body"
          style={{ animation: 'gvo-rise 0.35s ease-out both' }}
        >
          <span className="text-emerald-signal font-bold">{firstMessage.twitchName || name}:</span>{' '}
          {firstMessage.text}
        </p>
      )}
    </div>
  );
}

function RevealStage({ giveaway, entries, firstMessage, sound }) {
  const reveal = useRevealState(giveaway);
  const winners = giveaway.winners || [];
  const confirmed = winners.some((w) => w.twitchId === giveaway.winnerTwitchId);
  const target = Number(giveaway.targetWinners) || 1;
  const winnerNo = confirmed
    ? winners.findIndex((w) => w.twitchId === giveaway.winnerTwitchId) + 1
    : winners.length + 1;
  const w = giveaway.winner;
  // Only make noise for a reveal that is actually playing, not when OBS
  // reloads the source halfway through someone's claim clock.
  const live = reveal.elapsed != null && reveal.elapsed < REVEAL_MS + 800;

  return (
    <div
      className="gvo-motion fixed inset-0 flex flex-col items-center justify-center gap-6 px-8"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(9,9,11,0.62) 0%, rgba(9,9,11,0.9) 75%)',
        animation: 'gvo-fade 0.35s ease-out both',
      }}
    >
      <p className="font-mono font-bold uppercase tracking-eyebrow-lg text-sm text-white/60 text-center">
        <span className="text-emerald-signal">Giveaway</span> · {giveaway.prize}
        {target > 1 && <span className="text-white/40"> · winner {winnerNo} of {target}</span>}
      </p>

      <div className="relative w-[34rem] max-w-[80vw]">
        {confirmed && reveal.landed && (
          <span
            className="gvo-motion absolute z-10 -right-12 bottom-10 px-4 py-2 border-[3px] border-emerald-signal text-emerald-signal font-mono font-black uppercase tracking-eyebrow-md text-2xl bg-zinc-broadcast/90 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
            style={{ animation: 'gvo-stamp 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.3) both' }}
          >
            Locked in
          </span>
        )}
        <RevealScreen
          giveaway={giveaway}
          pool={entries}
          reveal={reveal}
          onFrame={live ? () => sound.tick() : undefined}
          onPhase={
            live
              ? (phase) => {
                  if (phase === 'static') sound.burst(260);
                  if (phase === 'flash') sound.burst(420);
                  if (phase === 'landed') sound.land();
                }
              : undefined
          }
        />
      </div>

      {/* Fixed height so the screen doesn't jump when the chat line lands. */}
      <div className="h-[17rem] flex flex-col items-center gap-4">
        {reveal.landed ? (
          <>
            <div className="gvo-motion text-center" style={{ animation: 'gvo-rise 0.4s ease-out both' }}>
              <p
                className="font-black text-white-body leading-[1] tracking-[-0.03em] pb-1"
                style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)', textShadow: '0 4px 30px rgba(0,0,0,0.6)' }}
              >
                {w.displayName || w.twitchName}
              </p>
              <p className="mt-2 font-mono font-bold uppercase tracking-eyebrow-md text-sm text-white/50">
                {(w.weight || 1) > 1 ? `${w.weight} tickets in the hat` : '1 ticket in the hat'}
              </p>
            </div>
            <ClaimClock giveaway={giveaway} reveal={reveal} firstMessage={firstMessage} />
          </>
        ) : (
          <p
            className="gvo-motion font-mono font-bold uppercase tracking-eyebrow-lg text-lg text-white/70"
            style={{ animation: 'gvo-blink 0.8s steps(1) infinite' }}
          >
            Tuning in…
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Wrap-up (just ended) ───────────────────────────────────────────────────

function WrapCard({ giveaway }) {
  const winners = giveaway.winners || [];
  return (
    // Centered by the outer flex row: the rise animation owns `transform`,
    // so a translate-x centering would be overwritten.
    <div className="fixed inset-x-0 bottom-10 flex justify-center px-8">
      <section
        className="gvo-motion w-[34rem] max-w-full bg-zinc-broadcast/[0.93] border border-emerald-signal/40 shadow-[0_24px_60px_rgba(0,0,0,0.55)] px-6 py-5"
        style={{ animation: 'gvo-rise 0.4s ease-out both' }}
      >
        <p className="font-mono font-bold uppercase tracking-eyebrow-lg text-xs text-emerald-signal mb-1">
          That&apos;s a wrap
        </p>
        <p className="font-black text-white-body text-2xl leading-tight mb-4 truncate">{giveaway.prize}</p>
        <ul className="flex flex-wrap gap-3">
          {winners.map((w, i) => (
            <li key={`${w.twitchId}-${i}`} className="inline-flex items-center gap-2 pr-3 border border-white/10 bg-zinc-card/80">
              <GiveawayAvatar entry={w} className="w-9 h-9 text-sm" ringClass="border-emerald-signal/60" />
              <span className="font-bold text-white-body">
                {winners.length > 1 && <span className="font-mono text-emerald-signal/70 mr-1">#{i + 1}</span>}
                {w.displayName || w.twitchName}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function GiveawayOverlay() {
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const demo = params.get('demo') === '1';
  const position = POSITION[params.get('pos')] || POSITION.bl;
  const sound = useOverlaySound(params.get('sound') === '1');

  const live = useGiveawayFeed({ enabled: !demo });
  const demoFeed = useDemoFeed(demo);
  const { giveaway, entries, firstMessage } = demo ? demoFeed : live;

  // The browser source must be see-through. OBS injects a transparent body by
  // default; this covers a plain browser tab and custom CSS setups too.
  useEffect(() => {
    const prev = [document.documentElement.style.background, document.body.style.background];
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      [document.documentElement.style.background, document.body.style.background] = prev;
    };
  }, []);

  const endedAt = tsMillis(giveaway?.endedAt);
  const wrapping =
    giveaway?.status === 'rolled' &&
    (giveaway.winners || []).length > 0 &&
    endedAt != null &&
    Date.now() - endedAt < WRAP_MS;
  // Re-render once the wrap window passes so the card clears itself.
  useClock({ intervalMs: 1000, active: wrapping });

  let body = null;
  if (giveaway) {
    if (giveaway.status === 'rolling' && giveaway.winner) {
      body = (
        <RevealStage giveaway={giveaway} entries={entries} firstMessage={firstMessage} sound={sound} />
      );
    } else if (['open', 'closed', 'rolling'].includes(giveaway.status)) {
      body = <EntryCard giveaway={giveaway} entries={entries} position={position} />;
    } else if (wrapping) {
      body = <WrapCard giveaway={giveaway} />;
    }
  }

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none text-white-body">
      <CrtStyles />
      {body}
    </div>
  );
}
