import { Timer } from 'lucide-react';
import { useRevealState } from '../../giveaway/RevealScreen';
import { REVEAL_MS, formatClock, tsMillis } from '../../../utils/giveaway';

export default function ClaimTimer({ giveaway, firstMessageAt }) {
  // Counts from when the name lands on stream (after the reveal), freezes on
  // the winner's first chat message.
  const reveal = useRevealState(giveaway);
  const landedAt = tsMillis(giveaway.rolledAt) + REVEAL_MS;
  const answeredAt = tsMillis(firstMessageAt);

  if (!reveal.landed && !answeredAt) {
    const left = Math.max(0, Math.ceil((landedAt - reveal.now) / 1000));
    return (
      <div className="flex items-center gap-3 px-3 py-2 border border-white/15 bg-zinc-broadcast/40">
        <Timer size={13} className="text-white/40" aria-hidden="true" />
        <div className="leading-none">
          <p className="text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-0.5 font-mono">
            On stream in
          </p>
          <p className="text-2xl font-black tabular-nums text-white/55 font-mono leading-none">{left}s</p>
        </div>
      </div>
    );
  }

  const elapsed = answeredAt ? Math.max(0, (answeredAt - landedAt) / 1000) : reveal.sinceLanded;
  let tone;
  if (answeredAt) {
    tone = { box: 'border-emerald-signal/50 bg-emerald-signal/5', text: 'text-emerald-signal', label: 'Responded in' };
  } else if (elapsed >= 90) {
    tone = { box: 'border-red-destructive/50 bg-red-destructive/5', text: 'text-red-destructive', label: 'Waiting' };
  } else if (elapsed >= 30) {
    tone = { box: 'border-orange-admin/50 bg-orange-admin/5', text: 'text-orange-admin', label: 'Waiting' };
  } else {
    tone = { box: 'border-white/15 bg-zinc-broadcast/40', text: 'text-white-body', label: 'Waiting' };
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2 border transition-colors duration-300 ${tone.box}`}>
      <Timer size={13} className={tone.text} aria-hidden="true" />
      <div className="leading-none">
        <p className="text-[0.5625rem] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-0.5 font-mono">
          {tone.label}
        </p>
        <p className={`text-2xl font-black tabular-nums font-mono leading-none ${tone.text}`}>
          {formatClock(elapsed)}
        </p>
      </div>
    </div>
  );
}
