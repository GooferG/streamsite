import { useClock } from '../../hooks/useClock';
import { pillState } from './panelStatus';

// The minimized panel: one line of live state, and a click brings it back.
export default function Pill({ giveaway, round, warnings, dataLost, anchor, onOpen }) {
  const ticking = giveaway?.status === 'open' && !!giveaway.closesAt;
  const now = useClock({ intervalMs: 1000, active: ticking });
  const { label, tone } = pillState({ giveaway, round, warnings, dataLost, now });
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open control room. ${label}`}
      className={`cr-pill cr-pill-in tone-${tone} fixed z-[65]`}
      style={anchor}
    >
      <span className="cr-pill-dot" aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
    </button>
  );
}
