import { useEffect, useMemo, useRef } from 'react';
import {
  REVEAL_MS,
  WINNER_CHANNEL,
  buildSurfFrames,
  pickKey,
  revealPhase,
  surfFrameIndex,
  tsMillis,
} from '../../utils/giveaway';
import { useClock, usePrefersReducedMotion } from '../../hooks/useClock';

// SVG turbulence as a tiling background. Stepping its position reads as TV
// snow; cheap enough for an OBS browser source (no canvas loop).
const NOISE_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

const SCANLINES =
  'repeating-linear-gradient(0deg, rgba(0,0,0,0.38) 0px, rgba(0,0,0,0.38) 1px, transparent 1px, transparent 3px)';

/** Keyframes shared by the overlay, the public page and the admin preview. */
export function CrtStyles() {
  return (
    <style>{`
      @keyframes gvo-snow {
        0% { background-position: 0 0; }
        20% { background-position: -40px 30px; }
        40% { background-position: 25px -55px; }
        60% { background-position: -70px -20px; }
        80% { background-position: 50px 60px; }
        100% { background-position: 0 0; }
      }
      @keyframes gvo-roll {
        0% { transform: translateY(-14%) skewX(-6deg); filter: brightness(1.8) contrast(1.4); opacity: 0.4; }
        55% { transform: translateY(3%) skewX(2deg); filter: brightness(1.2); opacity: 1; }
        100% { transform: translateY(0) skewX(0); filter: none; opacity: 1; }
      }
      @keyframes gvo-flash {
        0% { opacity: 0; }
        30% { opacity: 0.85; }
        100% { opacity: 0; }
      }
      @keyframes gvo-land {
        0% { transform: scaleY(0.02) scaleX(1.3); filter: brightness(3); }
        45% { transform: scaleY(1.08) scaleX(0.98); filter: brightness(1.4); }
        100% { transform: scale(1); filter: none; }
      }
      @keyframes gvo-rise {
        0% { transform: translateY(18px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      @keyframes gvo-fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes gvo-blink {
        0%, 55% { opacity: 1; }
        56%, 100% { opacity: 0.4; }
      }
      @keyframes gvo-stamp {
        0% { transform: rotate(-4deg) scale(1.9); opacity: 0; }
        60% { transform: rotate(-4deg) scale(0.94); opacity: 1; }
        100% { transform: rotate(-4deg) scale(1); opacity: 1; }
      }
      @keyframes gvo-pop {
        0% { transform: scale(0.4); opacity: 0; }
        70% { transform: scale(1.12); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes gvo-bump {
        0% { transform: scale(1.35); color: #34d399; }
        100% { transform: scale(1); }
      }
      @keyframes gvo-ticker {
        0% { transform: translateX(-12px); opacity: 0; }
        15% { transform: translateX(0); opacity: 1; }
        85% { opacity: 1; }
        100% { opacity: 0.55; }
      }
      @media (prefers-reduced-motion: reduce) {
        .gvo-motion { animation: none !important; }
      }
    `}</style>
  );
}

export function GiveawayAvatar({ entry, className = '', ringClass = 'border-white/20', style }) {
  const name = entry?.displayName || entry?.twitchName || '?';
  if (entry?.profileImageUrl) {
    return (
      <img
        src={entry.profileImageUrl}
        alt=""
        className={`rounded-full border-2 object-cover ${ringClass} ${className}`}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`rounded-full border-2 bg-zinc-elevated text-white/70 font-mono font-black inline-flex items-center justify-center ${ringClass} ${className}`}
      style={style}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/**
 * Where the current pick is in its reveal. Every screen computes this from
 * the same `rolledAt`, so they stay in step without talking to each other.
 */
export function useRevealState(giveaway) {
  const reduced = usePrefersReducedMotion();
  const rolledAtMs = tsMillis(giveaway?.rolledAt);
  const hasPick = giveaway?.status === 'rolling' && !!giveaway?.winner && rolledAtMs != null;
  const inReveal = hasPick && Date.now() - rolledAtMs < REVEAL_MS + 300;
  const now = useClock({ fast: inReveal && !reduced, intervalMs: 500, active: hasPick });
  const elapsed = hasPick ? now - rolledAtMs : null;
  let phase = hasPick ? revealPhase(elapsed) : null;
  // Reduced motion: no surf, a straight cut once the pick is in.
  if (hasPick && reduced) phase = elapsed >= 0 ? 'landed' : 'pending';
  return {
    hasPick,
    reduced,
    now,
    elapsed,
    phase,
    landed: phase === 'landed',
    // Seconds since the name landed on screen. The claim clock starts here.
    sinceLanded: hasPick ? Math.max(0, (now - rolledAtMs - REVEAL_MS) / 1000) : 0,
  };
}

/**
 * The CRT "channel surfing" screen: static, entrant avatars flicking by as
 * channels, slowing, landing on the winner on channel 07.
 *
 * Props:
 *  - giveaway: the rolling giveaway doc (needs winner, winnerTwitchId, rolledAt)
 *  - pool: entries to flick through (any order; shuffled per pick)
 *  - reveal: result of useRevealState(giveaway)
 *  - onFrame / onPhase: optional hooks for sound
 *  - size: 'lg' (overlay) | 'md' (public page)
 */
export default function RevealScreen({ giveaway, pool, reveal, onFrame, onPhase, size = 'lg' }) {
  const key = pickKey(giveaway);
  const frames = useMemo(
    () => buildSurfFrames({ winner: giveaway?.winner, pool: pool || [], seedKey: key || '' }),
    // Entries are frozen while rolling; the pool size is enough to notice a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, pool?.length]
  );
  const { phase, elapsed } = reveal;
  const frameIdx = phase === 'surf' ? surfFrameIndex(elapsed) : frames.length - 1;
  const frame = frames[frameIdx];
  const showWinner = phase === 'landed';
  const showSurf = phase === 'surf';
  const snowOpacity =
    phase === 'static' || phase === 'pending' || phase === 'flash'
      ? 1
      : showSurf
        ? frame?.entry
          ? 0.28
          : 0.9
        : 0.1;

  // Sound cues. Refs so the callbacks do not re-trigger effects.
  const onFrameRef = useRef(onFrame);
  const onPhaseRef = useRef(onPhase);
  onFrameRef.current = onFrame;
  onPhaseRef.current = onPhase;
  useEffect(() => {
    if (phase === 'surf') onFrameRef.current?.(frameIdx);
  }, [phase, frameIdx]);
  useEffect(() => {
    if (phase) onPhaseRef.current?.(phase);
  }, [phase]);

  const lg = size === 'lg';
  const channel = showWinner || phase === 'flash' ? WINNER_CHANNEL : frame?.channel ?? WINNER_CHANNEL;
  const shown = showWinner ? giveaway?.winner : frame?.entry;

  return (
    <div
      className={`relative w-full overflow-hidden bg-black border-2 border-white/15 shadow-[0_0_0_6px_rgba(9,9,11,0.9),0_30px_80px_rgba(0,0,0,0.6)] ${
        lg ? 'rounded-[2rem]' : 'rounded-2xl'
      }`}
      style={{ aspectRatio: '4 / 3' }}
    >
      {/* Picture */}
      {(showSurf || showWinner) && shown && (
        <div
          key={showWinner ? 'winner' : frameIdx}
          className="gvo-motion absolute inset-0 flex flex-col items-center justify-center gap-[6%]"
          style={{
            animation: showWinner
              ? 'gvo-land 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2) both'
              : 'gvo-roll 0.14s ease-out both',
            background: showWinner
              ? 'radial-gradient(circle at 50% 42%, rgba(16,185,129,0.28), rgba(9,9,11,0.95) 70%)'
              : 'radial-gradient(circle at 50% 42%, rgba(255,255,255,0.08), rgba(9,9,11,0.95) 70%)',
          }}
        >
          <GiveawayAvatar
            entry={shown}
            className={
              showWinner
                ? lg
                  ? 'w-[48%] aspect-square text-[6rem]'
                  : 'w-[46%] aspect-square text-5xl'
                : lg
                  ? 'w-[38%] aspect-square text-[5rem]'
                  : 'w-[36%] aspect-square text-4xl'
            }
            ringClass={showWinner ? 'border-emerald-signal' : 'border-white/30'}
          />
          {/* Once landed, the name is set big outside the screen instead. */}
          {!showWinner && (
            <span
              className={`max-w-[88%] truncate font-black tracking-tight text-white-body ${
                lg ? 'text-[2.4rem]' : 'text-xl'
              }`}
            >
              {shown.displayName || shown.twitchName}
            </span>
          )}
        </div>
      )}
      {showSurf && !shown && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`font-mono font-bold tracking-eyebrow-lg uppercase text-white/70 ${lg ? 'text-lg' : 'text-xs'}`}
          >
            No signal
          </span>
        </div>
      )}

      {/* Snow */}
      <div
        aria-hidden="true"
        className="gvo-motion pointer-events-none absolute inset-0 mix-blend-screen transition-opacity duration-150"
        style={{
          backgroundImage: NOISE_URL,
          backgroundSize: '160px 160px',
          opacity: snowOpacity,
          animation: 'gvo-snow 0.32s steps(5) infinite',
        }}
      />
      {/* Scanlines + vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: SCANLINES }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.75) 100%)' }}
      />
      {phase === 'flash' && (
        <div
          aria-hidden="true"
          className="gvo-motion pointer-events-none absolute inset-0 bg-white"
          style={{ animation: 'gvo-flash 0.4s ease-out both' }}
        />
      )}

      {/* On-screen display */}
      <div
        className={`absolute top-[5%] left-[6%] font-mono font-black text-white-body tabular-nums ${
          lg ? 'text-[2.2rem]' : 'text-lg'
        }`}
        style={{ textShadow: '0 0 10px rgba(255,255,255,0.45)' }}
      >
        CH {String(channel).padStart(2, '0')}
      </div>
      <div
        className={`gvo-motion absolute top-[6%] right-[6%] font-mono font-bold tracking-eyebrow-md uppercase ${
          lg ? 'text-sm' : 'text-[0.5625rem]'
        } ${showWinner ? 'text-emerald-bright' : 'text-white/75'}`}
        style={showWinner ? undefined : { animation: 'gvo-blink 0.9s steps(1) infinite' }}
      >
        {showWinner ? '● Winner' : 'Tuning…'}
      </div>
    </div>
  );
}
