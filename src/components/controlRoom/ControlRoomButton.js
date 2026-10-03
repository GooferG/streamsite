import { MonitorPlay } from 'lucide-react';
import { FOCUS, MONO } from '../onAir/classes';

const STATUS_LABEL = { open: 'Live', rolling: 'Rolling', playing: 'Playing', closed: 'Closed' };

// Nav shortcut into the control room. Shows the running giveaway's entry
// count so the operator can see it's live without opening anything. On Air:
// neutral when idle, signal (open) while a giveaway runs, never orange.
export default function ControlRoomButton({ giveaway, onClick }) {
  const label = giveaway ? STATUS_LABEL[giveaway.status] || 'Live' : null;
  return (
    <button
      type="button"
      onClick={onClick}
      data-control-room-button=""
      aria-keyshortcuts="`"
      title={giveaway ? `Giveaway ${label.toLowerCase()}: ${giveaway.prize}` : 'Open the control room'}
      className={`${MONO} inline-flex h-[34px] items-center gap-2 whitespace-nowrap rounded-onair-control px-3 text-[0.625rem] font-bold tracking-[0.2em] transition-colors duration-150 motion-reduce:transition-none ${FOCUS} ${
        giveaway
          ? 'bg-onair-signal/[0.14] text-onair-signal-light hover:bg-onair-signal/20'
          : 'bg-white/[0.07] text-onair-ink-2 hover:bg-white/[0.12]'
      }`}
    >
      <MonitorPlay size={14} aria-hidden="true" />
      <span className="sr-only xl:not-sr-only">Control room</span>
      {giveaway && (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <span className="h-1.5 w-1.5 rounded-full bg-onair-signal" aria-hidden="true" />
          {giveaway.entryCount ?? 0}
          <span className="sr-only"> entries, {label}</span>
        </span>
      )}
    </button>
  );
}
