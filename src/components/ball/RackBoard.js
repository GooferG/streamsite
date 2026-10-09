import { formatMulti, leaderRow, pad2, prizeText, who } from '../../utils/ball';
import './ball.css';

export const RACK_ROWS_MAX = 8;

// The latest RACK_ROWS_MAX rows in draw order; a leader who fell off the end
// is pinned first, so the window is the leader plus the latest seven.
function visibleRows(rows, leader) {
  if (rows.length <= RACK_ROWS_MAX) return rows;
  const latest = rows.slice(-RACK_ROWS_MAX);
  if (!leader || latest.some((r) => r.drawNo === leader.drawNo)) return latest;
  return [leader, ...rows.slice(-(RACK_ROWS_MAX - 1))];
}

const ROW = 'grid grid-cols-[1.5rem_1.75rem_1fr_auto] items-center gap-2 border-t border-onair-paper-ink/15 px-2.5 py-1 font-onair-mono text-[0.6875rem] font-bold uppercase tracking-[0.15em]';

// Tonight's rack (spec: OBS overlay, state 3): the drawn balls with their
// multipliers as the bonuses open, the leader highlighted.
export default function RackBoard({ round, rows = [], stale = false, position = 'left-8 top-8' }) {
  const leader = leaderRow(rows);
  const shown = visibleRows(rows, leader);
  const hidden = rows.length - shown.length;
  const footer =
    (round.status === 'open'
      ? 'Type !slot <slot name> to call one in'
      : `Drum closed · top multi wins ${prizeText(round.prize)}`) + (stale ? ' · stale' : '');
  return (
    <div className={`absolute ${position} w-[min(32rem,42vw)] font-onair shadow-onair-card`}>
      <div className="flex items-stretch">
        <span className="bg-onair-winner px-2.5 py-1 font-display text-[1.125rem] uppercase tracking-wide text-onair-winner-ink">Tonight's rack</span>
        <span className="min-w-0 flex-1 truncate bg-onair-wgoof-deep px-2.5 font-onair-mono text-[0.625rem] font-bold uppercase leading-[2.6] tracking-[0.16em] text-onair-wgoof-title">
          {leader ? (
            <>
              {`Leader @${who(leader)} · `}
              <span className="normal-case">{formatMulti(leader.multiplier)}</span>
            </>
          ) : (
            'No results yet'
          )}
        </span>
      </div>
      <ol>
        {shown.map((r) => (
          <li
            key={r.drawNo}
            className={`${ROW} text-onair-paper-ink ${leader && leader.drawNo === r.drawNo ? 'bg-onair-winner-pale' : 'bg-onair-paper'}`}
          >
            <span>{pad2(r.drawNo)}</span>
            {r.thumb ? <img src={r.thumb} alt="" className="h-5 w-7 rounded-[2px] object-cover" /> : <span className="gb-decal h-5 w-7 rounded-[2px]" />}
            <span className="min-w-0 truncate">
              {r.slotName}
              <span className="block text-[0.625rem] opacity-70">@{who(r)}</span>
            </span>
            <span className="font-display text-[1.125rem] normal-case tracking-normal">{formatMulti(r.multiplier)}</span>
          </li>
        ))}
        {hidden > 0 && (
          <li className={`${ROW} bg-onair-paper text-onair-paper-ink opacity-70`}>
            <span className="col-span-4">{`+${hidden} earlier`}</span>
          </li>
        )}
      </ol>
      <p className="bg-onair-wgoof-deep px-2.5 py-1 font-onair-mono text-[0.625rem] font-bold uppercase tracking-[0.16em] text-onair-wgoof-title">{footer}</p>
    </div>
  );
}
