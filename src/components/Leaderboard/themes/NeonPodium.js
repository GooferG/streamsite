import { formatUSD, formatPosition } from '../format';

// Top-3 cards for the Neon theme — synthwave pink/cyan glass. Order 2nd · 1st ·
// 3rd; 1st is taller with a gradient pink→cyan border (mask technique) and a
// stronger glow. Carries real top-3 data + an optional animated wager for 1st.
const RANKS = {
  1: { label: '1ST', order: 'sm:order-2' },
  2: { label: '2ND', order: 'sm:order-1' },
  3: { label: '3RD', order: 'sm:order-3' },
};

function PodiumCard({ player, animatedWagered }) {
  if (!player) return null;
  const cfg = RANKS[player.position] || { label: formatPosition(player.position), order: '' };
  const first = player.position === 1;
  const wag = first && animatedWagered != null ? animatedWagered : player.wagered;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden ${cfg.order} ${
        first ? 'p-7 sm:-translate-y-2' : 'p-5'
      }`}
      style={{
        border: first ? '1px solid #ff2d95' : '1px solid rgba(177,77,255,0.4)',
        background: first
          ? 'linear-gradient(165deg, rgba(120,30,110,0.55), rgba(30,10,60,0.5))'
          : 'linear-gradient(165deg, rgba(60,20,90,0.5), rgba(20,8,48,0.4))',
        boxShadow: first
          ? '0 0 46px rgba(255,45,149,0.35), inset 0 0 30px rgba(255,45,149,0.12)'
          : '0 10px 40px -18px rgba(122,61,255,0.7)',
      }}
    >
      {/* Gradient pink→cyan border on 1st (mask technique) */}
      {first && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-80"
          style={{
            padding: '1px',
            background: 'linear-gradient(120deg, #ff2d95, #21e6ff)',
            WebkitMask:
              'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}

      <div className="relative flex items-center justify-between mb-3.5">
        <span
          className={`font-orbitron font-extrabold text-2xl sm:text-3xl tracking-wide ${
            first ? '' : 'text-white-body'
          }`}
          style={
            first
              ? {
                  backgroundImage: 'linear-gradient(90deg, #ff7ac4, #8af6ff)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }
              : { textShadow: '0 0 14px rgba(255,122,196,0.7)' }
          }
        >
          {cfg.label}
        </span>
        <span
          className="text-[12px] tracking-eyebrow text-nn-cyan"
          style={{ textShadow: '0 0 8px rgba(33,230,255,0.5)' }}
        >
          {formatPosition(player.position)}
        </span>
      </div>

      <div className="relative font-orbitron font-bold text-base sm:text-lg tracking-wide text-white truncate">
        {player.maskedUsername}
      </div>
      <div
        className="relative mt-1.5 text-2xl sm:text-[36px] font-bold tabular-nums text-nn-cyan-lite leading-none"
        style={{ textShadow: '0 0 14px rgba(33,230,255,0.5)' }}
      >
        {formatUSD(wag)}
      </div>

      <div className="relative flex items-center justify-between mt-4 pt-3 border-t border-nn-purple/25 text-[13px] tracking-eyebrow-sm uppercase text-white/55">
        <span>Prize</span>
        <span
          className="text-nn-pink-lite font-bold"
          style={{ textShadow: '0 0 10px rgba(255,45,149,0.5)' }}
        >
          {formatUSD(player.prize)}
        </span>
      </div>
    </div>
  );
}

export default function NeonPodium({ players, animatedWagered }) {
  const [first, second, third] = players;
  if (!first) return null;

  return (
    <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_1.12fr_1fr] gap-4 items-end px-4 sm:px-6 py-8 border-b border-nn-purple/25">
      <PodiumCard player={first} animatedWagered={animatedWagered} />
      <PodiumCard player={second} />
      <PodiumCard player={third} />
    </div>
  );
}
