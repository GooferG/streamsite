import { formatUSD, formatPosition } from '../format';

// Top-3 cards for the Neon theme. Each card layers a skewed purple gradient
// panel + a blurred glow clone behind frosted content — arcade/neon styling in
// the purple-gamba palette, carrying real leaderboard data. Hover straightens
// the skew and lifts the card; all motion is motion-reduce safe.
const RANKS = [
  {
    label: '1ST',
    from: '#c084fc',
    to: '#a855f7',
    accent: 'text-purple-bright',
    order: 'sm:order-2',
    lift: 'sm:-translate-y-3',
  },
  {
    label: '2ND',
    from: '#a855f7',
    to: '#7c3aed',
    accent: 'text-purple-bright',
    order: 'sm:order-1',
    lift: '',
  },
  {
    label: '3RD',
    from: '#9333ea',
    to: '#6d28d9',
    accent: 'text-purple-bright',
    order: 'sm:order-3',
    lift: '',
  },
];

function PodiumCard({ player, rank }) {
  if (!player) return null;
  const cfg = RANKS[rank];
  const gradient = `linear-gradient(315deg, ${cfg.from}, ${cfg.to})`;

  return (
    <div
      className={`group relative h-44 ${cfg.order} ${cfg.lift} transition-transform duration-500 motion-reduce:transition-none`}
    >
      {/* Skewed gradient panel */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-6 right-6 rounded-lg skew-x-[12deg] transition-all duration-500 motion-reduce:transition-none group-hover:skew-x-0 group-hover:left-3 group-hover:right-3"
        style={{ background: gradient }}
      />
      {/* Blurred glow clone behind */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-6 right-6 rounded-lg skew-x-[12deg] blur-2xl opacity-70 transition-all duration-500 motion-reduce:transition-none group-hover:skew-x-0 group-hover:left-3 group-hover:right-3"
        style={{ background: gradient }}
      />

      {/* Frosted content */}
      <div className="relative z-10 h-full flex flex-col justify-between p-4 rounded-lg bg-zinc-broadcast/70 backdrop-blur-md border border-white/10 transition-transform duration-500 motion-reduce:transition-none group-hover:-translate-y-1">
        <div className="flex items-center justify-between">
          <span className="font-display text-2xl tracking-tight text-white-body leading-none">
            {cfg.label}
          </span>
          <span className={`text-[11px] font-bold tracking-eyebrow-sm font-mono ${cfg.accent}`}>
            {formatPosition(player.position)}
          </span>
        </div>

        <div className="min-w-0">
          <div className="truncate text-base font-extrabold uppercase tracking-tight text-white-body">
            {player.maskedUsername}
          </div>
          <div className="mt-1 text-xl font-extrabold tabular-nums font-mono text-white-body">
            {formatUSD(player.wagered)}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-bold tracking-eyebrow-sm uppercase font-mono">
          <span className="text-white/55">PRIZE</span>
          <span className={cfg.accent}>{formatUSD(player.prize)}</span>
        </div>
      </div>
    </div>
  );
}

export default function NeonPodium({ players }) {
  const [first, second, third] = players;
  if (!first) return null;

  return (
    <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 sm:px-6 py-7 border-b border-purple-gamba/25">
      <PodiumCard player={first} rank={0} />
      <PodiumCard player={second} rank={1} />
      <PodiumCard player={third} rank={2} />
    </div>
  );
}
