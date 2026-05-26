import { formatUSD, formatPosition } from './format';
import TrendArrow from './TrendArrow';
import WagerDropChip from './WagerDropChip';

function pad2(n) {
  return String(n).padStart(2, '0');
}

export default function RosterTable({ players }) {
  if (!players.length) return null;
  const firstPos = players[0].position;
  const lastPos = players[players.length - 1].position;
  const label =
    firstPos === lastPos ? `ROSTER ${pad2(firstPos)}` : `ROSTER ${pad2(firstPos)}–${pad2(lastPos)}`;

  return (
    <div className="border-t border-white/8">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-3 text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
        <span className="w-20 sm:w-24">{label}</span>
        <span aria-hidden="true" />
        <span className="text-right">WAGERED</span>
        <span className="text-right w-20 sm:w-24">PRIZE</span>
      </div>
      <div className="divide-y divide-white/6">
        {players.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 sm:px-6 py-2.5 hover:bg-white/3 transition-colors motion-reduce:transition-none"
          >
            <div className="flex items-center gap-3 w-20 sm:w-24">
              <span className="text-[10px] font-bold tracking-eyebrow-md text-white/55 tabular-nums font-mono">
                {formatPosition(p.position)}
              </span>
              <TrendArrow current={p.position} previous={p.previousPosition} />
            </div>

            <div className="flex items-center min-w-0 text-sm text-white/85 truncate">
              <span className="truncate">{p.maskedUsername}</span>
              <WagerDropChip delta={p.delta} />
            </div>

            <div className="text-sm tabular-nums font-mono text-white/85 text-right">
              {formatUSD(p.wagered)}
            </div>

            <div className="text-right w-20 sm:w-24 text-sm tabular-nums font-mono text-emerald-signal">
              {p.prize > 0 ? formatUSD(p.prize) : <span className="text-white/25">—</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
