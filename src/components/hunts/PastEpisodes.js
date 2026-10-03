import { useId } from 'react';
import Panel from '../onAir/Panel';
import { FOCUS, MONO } from '../onAir/classes';
import { huntTypeLabel, profitLoss } from '../../utils/huntFormat';
import { formatEpisodeDate } from './huntTime';
import { signedMoney } from './huntStats';

// Recent communityhunts hunts. Selecting one swaps the recap card to it;
// selecting it again goes back to tonight.
export default function PastEpisodes({ hunts, activeId, onSelect }) {
  const headingId = useId();
  const list = Array.isArray(hunts) ? hunts : [];
  if (!list.length) return null;
  return (
    <Panel as="section" aria-labelledby={headingId} className="flex flex-col gap-0.5 p-2.5">
      <h2 id={headingId} className={`${MONO} flex justify-between px-3 pb-1.5 pt-2.5 text-[0.625rem] tracking-[0.24em] text-onair-ink-5`}>
        <span>Past episodes</span>
        <span aria-hidden="true">{String(list.length).padStart(3, '0')}</span>
      </h2>
      <ul className="flex flex-col gap-0.5">
        {list.map((h) => {
          const result = profitLoss(h);
          const active = h.id === activeId;
          const tone = result == null ? 'text-onair-ink-5' : result < 0 ? 'text-onair-loss' : 'text-onair-signal';
          return (
            <li key={h.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : h.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-onair-control p-3 text-left hover:bg-white/[0.04] ${active ? 'bg-white/[0.06]' : ''} ${FOCUS}`}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[0.9375rem] font-semibold">{huntTypeLabel(h.huntType)} hunt</span>
                  <span className={`${MONO} text-[0.625rem] tracking-[0.12em] text-onair-ink-5`}>
                    {formatEpisodeDate(h.endedAt || h.startedAt)}
                  </span>
                </span>
                <span className={`text-sm font-bold tabular-nums ${tone}`}>{signedMoney(result, h.currency || null)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
