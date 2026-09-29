import RevealScreen, { useRevealState } from './RevealScreen';
import { REVEAL_MS, formatClock, tsMillis } from '../../utils/giveaway';

// Silent stand-in for the overlay's sound hook, so the control room's stage
// moment can reuse the reveal without Web Audio.
const NO_SOUND = { tick() {}, burst() {}, land() {} };

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

export default function RevealStage({ giveaway, entries, firstMessage, sound = NO_SOUND, holding = false }) {
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
            {holding ? (
              // Confirmed bonus buy: cue the hand-off to the corner card.
              <p
                className="gvo-motion px-5 py-2.5 border-2 border-emerald-signal/50 bg-zinc-broadcast/85 font-mono font-bold uppercase tracking-eyebrow-md text-sm text-emerald-signal"
                style={{ animation: 'gvo-rise 0.35s ease-out both' }}
              >
                Up next: their {giveaway.prize}
              </p>
            ) : (
              <ClaimClock giveaway={giveaway} reveal={reveal} firstMessage={firstMessage} />
            )}
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
