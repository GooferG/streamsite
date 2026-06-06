// src/components/hunt/StatusBadge.js
import { Flame, Zap } from 'lucide-react';
export default function StatusBadge({ status }) {
  if (status === 'hot') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono text-emerald-signal">
        <Flame size={11} aria-hidden="true" /> Hot
      </span>
    );
  }
  if (status === 'cold') {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-eyebrow-md uppercase font-mono text-red-destructive">
        <Zap size={11} aria-hidden="true" /> Cold
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold tracking-eyebrow-md uppercase font-mono text-white/40">
      Steady
    </span>
  );
}
