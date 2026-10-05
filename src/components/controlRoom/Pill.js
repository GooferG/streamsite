import { useClock } from '../../hooks/useClock';
import { pillCounter, pillState } from './panelStatus';

// The minimized panel: one line of live state, a redemption counter when
// anything is pending, and a click brings it back.
export default function Pill({ giveaway, round, warnings, dataLost, redeem, anchor, onOpen }) {
  const ticking = giveaway?.status === 'open' && !!giveaway.closesAt;
  const now = useClock({ intervalMs: 1000, active: ticking });
  const { label, tone } = pillState({ giveaway, round, warnings, dataLost, now });
  const counter = pillCounter(redeem);
  const pending = counter ? `. ${redeem.pending} redemption${redeem.pending === 1 ? '' : 's'} pending` : '';
  return (
    <button
      type="button"
      data-control-room=""
      onClick={onOpen}
      aria-label={`Open control room. ${label}${pending}`}
      className={`cr-pill cr-pill-in tone-${tone} fixed z-[65]`}
      style={anchor}
    >
      <span className="cr-pill-dot" aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
      {counter && (
        <span className={`cr-pill-count ${counter.pulse ? 'is-pulse' : ''}`} aria-hidden="true">
          {counter.label}
        </span>
      )}
    </button>
  );
}
