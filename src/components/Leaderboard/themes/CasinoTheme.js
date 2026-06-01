import { useCountdown } from '../../../hooks/useCountdown';
import { formatUSD, formatPrizeHeadline, formatOrdinalPlace } from '../format';
import { gapToClimb } from '../gap';
import useCountUp from '../useCountUp';
import FlipTile from '../FlipTile';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function freshness(now, lastUpdatedAt) {
  const ms = Math.max(0, now - lastUpdatedAt);
  if (ms < 60_000) return `${Math.floor(ms / 1000)}S AGO`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}M AGO`;
  return `${Math.floor(ms / 3_600_000)}H AGO`;
}

function deltaInfo(player) {
  const d = (player.previousPosition || player.position) - player.position;
  if (d > 0) return { glyph: '▲', cls: 'text-emerald-bright' };
  if (d < 0) return { glyph: '▼', cls: 'text-red-destructive' };
  return { glyph: '–', cls: 'text-white/35' };
}

// CSS engraved gold seal — radial metal disc, dashed inner ring, embossed rank
// numeral. Replaces emoji medals (handoff: do not use emoji). 1st gets a larger
// seal + crown glyph.
function Seal({ position, first }) {
  return (
    <div className="relative mx-auto mb-3" aria-hidden="true">
      {first && (
        <span
          className="absolute left-1/2 -top-4 -translate-x-1/2 text-xl text-gold-lite"
          style={{ filter: 'drop-shadow(0 0 8px rgba(231,194,103,0.7))' }}
        >
          ♔
        </span>
      )}
      <div
        className={`relative rounded-full flex items-center justify-center ${
          first ? 'w-[78px] h-[78px]' : 'w-[62px] h-[62px]'
        }`}
        style={{
          background:
            'radial-gradient(circle at 35% 30%, #f8e7b0, #e7c267 45%, #a9812f 100%)',
          boxShadow:
            '0 4px 14px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(90,60,15,0.7)',
        }}
      >
        <span
          className="absolute rounded-full border border-dashed"
          style={{ inset: '5px', borderColor: 'rgba(110,80,25,0.6)' }}
        />
        <span
          className={`font-serif-luxe font-bold ${first ? 'text-[34px]' : 'text-[26px]'}`}
          style={{
            color: '#3a2a08',
            textShadow: '0 1px 0 rgba(255,255,255,0.4)',
          }}
        >
          {position}
        </span>
      </div>
    </div>
  );
}

function PodiumCard({ player, first, animatedWagered }) {
  if (!player) return null;
  const wag =
    first && animatedWagered != null ? animatedWagered : player.wagered;
  return (
    <div
      className={`relative text-center px-5 ${
        first
          ? 'pt-10 pb-8 border border-gold-deep'
          : 'pt-7 pb-6 border border-gold/20'
      }`}
      style={
        first
          ? {
              background:
                'linear-gradient(180deg, rgba(40,28,12,0.8), rgba(14,10,5,0.6))',
              boxShadow:
                '0 0 50px rgba(231,194,103,0.16), inset 0 1px 0 rgba(231,194,103,0.3)',
            }
          : {
              background:
                'linear-gradient(180deg, rgba(24,17,9,0.65), rgba(10,7,4,0.5))',
            }
      }
    >
      <Seal position={player.position} first={first} />
      <div className="text-[11px] tracking-eyebrow text-cream/45 uppercase font-mono">
        {formatOrdinalPlace(player.position)}
      </div>
      <div className="mt-1.5 font-serif-luxe font-bold text-2xl sm:text-3xl text-cream tracking-wide break-all">
        {player.maskedUsername}
      </div>
      <div className="mt-2 font-serif-luxe font-bold text-2xl sm:text-[34px] tabular-nums text-gold-lite">
        {formatUSD(wag)}
      </div>
      <div className="mt-2 text-xs tracking-eyebrow text-gold uppercase">
        Prize {formatUSD(player.prize)}
      </div>
    </div>
  );
}

// Casino-classic: black + gold Monte-Carlo luxe. Renders the full info contract;
// restrained motion (gold-foil shimmer only). Replaces emoji medals with CSS
// engraved seals.
export default function CasinoTheme({ data, now }) {
  const remaining = useCountdown(data.endsAt);
  const [first, second, third, ...rest] = data.players;
  const list = rest.slice(0, 17);
  const animatedWagered = useCountUp(first ? first.wagered : 0, {
    durationMs: 1500,
    delayMs: 200,
  });

  return (
    <div data-theme="casino" className="relative overflow-hidden">
      {/* Guilloché texture + gold glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-50"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(231,194,103,0.025) 0 2px, transparent 2px 9px), repeating-linear-gradient(-45deg, rgba(231,194,103,0.02) 0 2px, transparent 2px 9px)',
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-32 w-[700px] h-[440px] z-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle, rgba(231,194,103,0.16), transparent 65%)',
          filter: 'blur(10px)',
        }}
      />

      {/* Double-framed plaque */}
      <div
        className="relative z-[1] border border-gold/20"
        style={{
          background:
            'linear-gradient(180deg, rgba(20,14,8,0.5), rgba(8,6,4,0.2))',
          boxShadow:
            '0 0 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(231,194,103,0.12)',
        }}
      >
        <div className="m-2.5 border border-gold/10">
          {/* Header */}
          <div className="px-4 sm:px-6 py-6 border-b border-gold/20 text-center">
            <div className="text-[11px] tracking-eyebrow-lg text-gold uppercase font-mono">
              {data.periodLabel}
            </div>
            <h2 className="mt-1 font-serif-luxe font-bold text-4xl sm:text-6xl leading-none tracking-wide">
              <span
                className="motion-safe:animate-cs-foil"
                style={{
                  backgroundImage:
                    'linear-gradient(100deg, #a9812f 0%, #f8e7b0 25%, #fff7e0 38%, #f8e7b0 52%, #e7c267 70%, #a9812f 100%)',
                  backgroundSize: '250% 100%',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {formatPrizeHeadline(data.prizePool)}
              </span>{' '}
              <span className="text-cream">Prize Pool</span>
            </h2>

            {/* Diamond rule */}
            <div className="flex items-center justify-center gap-3.5 mx-auto mt-3.5 max-w-[320px]">
              <span
                className="h-px flex-1"
                style={{
                  background: 'linear-gradient(90deg,transparent,#a9812f)',
                }}
              />
              <span
                className="w-1.5 h-1.5 rotate-45 bg-gold"
                style={{ boxShadow: '0 0 10px rgba(231,194,103,0.7)' }}
              />
              <span
                className="h-px flex-1"
                style={{
                  background: 'linear-gradient(90deg,#a9812f,transparent)',
                }}
              />
            </div>

            <div className="mt-3 text-[11px] tracking-eyebrow-sm uppercase font-mono text-cream/60">
              Join code <span className="text-gold">{data.referralCode}</span>{' '}
              on <span className="text-gold">{data.brand}</span>
            </div>

            {/* Countdown — engraved tiles */}
            {remaining.isOver ? (
              <div className="mt-6 font-serif-luxe font-bold text-3xl sm:text-4xl uppercase text-red-destructive">
                Leaderboard Over
              </div>
            ) : (
              <div className="mt-6 flex justify-center gap-3.5">
                {[
                  ['Days', remaining.days],
                  ['Hrs', remaining.hours],
                  ['Min', remaining.minutes],
                  ['Sec', remaining.seconds],
                ].map(([label, value]) => (
                  <div key={label} className="text-center">
                    <FlipTile
                      value={pad2(value)}
                      widthClass="w-14 sm:w-20 py-3.5"
                      className="border border-gold-deep"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(30,22,10,0.9), rgba(12,9,5,0.9))',
                        boxShadow:
                          'inset 0 1px 0 rgba(231,194,103,0.25), inset 0 -10px 20px rgba(0,0,0,0.5)',
                      }}
                      textClass="font-serif-luxe font-bold text-3xl sm:text-5xl tabular-nums text-gold-lite"
                      seamColor="rgba(0,0,0,0.6)"
                    />
                    <div className="mt-2 text-[10px] tracking-eyebrow-md text-cream/45 uppercase font-mono">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Podium — order 2nd · 1st · 3rd */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.15fr_1fr] gap-4 items-end px-4 sm:px-6 py-8">
            <div className="sm:order-1">
              <PodiumCard player={second} />
            </div>
            <div className="sm:order-2">
              <PodiumCard
                player={first}
                first
                animatedWagered={animatedWagered}
              />
            </div>
            <div className="sm:order-3">
              <PodiumCard player={third} />
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[80px_minmax(0,1fr)_auto_auto] gap-3 px-5 sm:px-6 pb-3 text-[11px] tracking-eyebrow uppercase text-cream/45 font-mono">
            <span>Rank</span>
            <span>Player</span>
            <span className="text-right">Wagered</span>
            <span className="w-24 text-right">Prize</span>
          </div>

          {/* Table (4–20) — zebra, hover lift, gap-to-climb */}
          <div className="border-t border-gold/15">
            {list.map((p, idx) => {
              // idx in `list` maps to overall players index idx + 3.
              const overallIndex = idx + 3;
              const climb = gapToClimb(data.players, overallIndex);
              const d = deltaInfo(p);
              return (
                <div
                  key={p.id}
                  className={`group grid grid-cols-[80px_minmax(0,1fr)_auto_auto] gap-3 items-center px-5 sm:px-6 py-4 border-b border-gold/8 transition-colors ${
                    idx % 2 === 0 ? 'bg-gold/[0.022]' : ''
                  } hover:bg-gold/[0.07]`}
                >
                  <span className="flex items-center gap-2 font-serif-luxe font-bold text-xl text-gold">
                    {p.position}
                    <span className={`text-[9px] ${d.cls}`} aria-hidden="true">
                      {d.glyph}
                    </span>
                  </span>
                  <span className="min-w-0 truncate text-base text-cream">
                    {p.maskedUsername}
                    {climb > 0 && (
                      <span className="ml-2.5 text-[11px] text-gold opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        +{formatUSD(climb)} to climb
                      </span>
                    )}
                  </span>
                  <span className="text-right text-base sm:text-lg font-semibold tabular-nums text-cream">
                    {formatUSD(p.wagered)}
                  </span>
                  <span className="w-24 text-right text-base font-semibold tabular-nums text-gold">
                    {p.prize > 0 ? formatUSD(p.prize) : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Last-updated */}
          <div className="px-4 sm:px-6 py-4 border-t border-gold/15 text-center text-[10px] tracking-eyebrow-md uppercase font-mono text-cream/40 tabular-nums">
            Standings updated {freshness(now, data.lastUpdatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}
