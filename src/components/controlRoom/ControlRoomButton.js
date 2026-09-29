import { MonitorPlay } from 'lucide-react';

const STATUS_LABEL = { open: 'Live', rolling: 'Rolling', playing: 'Playing', closed: 'Closed' };

// Nav shortcut into the control room. Shows the running giveaway's entry
// count so the operator can see it's live without opening anything.
export default function ControlRoomButton({ giveaway, onClick }) {
  const label = giveaway ? STATUS_LABEL[giveaway.status] || 'Live' : null;
  return (
    <button
      type="button"
      onClick={onClick}
      data-control-room-button=""
      aria-keyshortcuts="`"
      title={giveaway ? `Giveaway ${label.toLowerCase()}: ${giveaway.prize}` : 'Open the control room'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border transition-colors duration-150 whitespace-nowrap ${
        giveaway
          ? 'border-emerald-signal/50 bg-emerald-signal/10 text-emerald-signal hover:bg-emerald-signal/20'
          : 'border-orange-admin/30 text-orange-admin/90 hover:bg-orange-admin/10 hover:text-orange-admin'
      }`}
    >
      <MonitorPlay size={12} aria-hidden="true" />
      <span className="sr-only lg:not-sr-only text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
        Control room
      </span>
      {giveaway && (
        <span className="inline-flex items-center gap-1 pl-1.5 ml-0.5 border-l border-emerald-signal/30 text-[0.625rem] font-bold font-mono tabular-nums">
          <span className="relative flex w-1.5 h-1.5" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-60" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
          </span>
          {giveaway.entryCount ?? 0}
          <span className="sr-only"> entries, {label}</span>
        </span>
      )}
    </button>
  );
}
