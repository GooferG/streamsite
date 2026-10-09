import { pad2, who } from '../../utils/ball';

// "BALL 03 · GATES OF OLYMPUS · CALLED IN BY @X · 61 BALLS LEFT IN THE DRUM".
// `left` is null when the drum count isn't known (Stage has no ball list).
export default function LowerThird({ entry, left = null }) {
  const tail = left == null ? '' : ` · ${left} ${left === 1 ? 'ball' : 'balls'} left in the drum`;
  return (
    <div className="absolute inset-x-[4%] bottom-[7%] flex h-[14%] items-stretch shadow-onair-card">
      <div className="flex items-center bg-onair-winner px-[3%] font-display text-[clamp(1rem,2.6vw,3rem)] uppercase tracking-wide text-onair-winner-ink">
        Ball {pad2(entry.drawNo)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center bg-onair-paper px-[3%] text-onair-paper-ink">
        <p className="truncate font-display text-[clamp(1.1rem,2.8vw,3.25rem)] uppercase leading-none tracking-wide">{entry.slotName}</p>
        <p className="mt-1 truncate font-onair-mono text-[clamp(0.625rem,1vw,1rem)] font-bold uppercase tracking-[0.15em]">
          {`Called in by @${who(entry)}${tail}`}
        </p>
      </div>
    </div>
  );
}
