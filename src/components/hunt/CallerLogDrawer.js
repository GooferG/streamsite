// src/components/hunt/CallerLogDrawer.js
import { X } from 'lucide-react';
import Modal from '../Modal';
import { fmtX, computeCallerStats } from '../../utils/huntCalc';
import FormStrip from './FormStrip';
import StatusBadge from './StatusBadge';

// Per-caller call record: this hunt's called slots + prior-hunt summary.
export default function CallerLogDrawer({ name, bonuses, history, skippedCalls, onClose }) {
  const s = computeCallerStats(bonuses, history, skippedCalls);
  const row = s.leaderboard.find((r) => r.name === name) ||
    { calls: 0, gotIn: 0, missed: 0, avgX: null, best: null, form: [], status: 'steady', acceptRate: 0 };
  const huntCalls = (bonuses ?? []).filter((b) => (b.caller || '').trim() === name);
  // Prior-hunt rollup from history.
  let priorIn = 0, priorPlayed = 0, priorXsum = 0;
  for (const h of history ?? []) {
    for (const b of h.bonuses ?? []) {
      if ((b.caller || '').trim() !== name) continue;
      priorIn += 1;
      const stake = Number(b.stake) || 0, win = Number(b.win) || 0;
      if (stake > 0 && win > 0) { priorPlayed += 1; priorXsum += win / stake; }
    }
  }
  const priorAvg = priorPlayed ? priorXsum / priorPlayed : null;
  const Stat = ({ k, children }) => (
    <div className="px-3 py-2 bg-zinc-broadcast/50 border border-white/8 text-center">
      <div className="text-[9px] font-bold uppercase tracking-eyebrow-md text-white/45 font-mono mb-1">{k}</div>
      <div className="text-sm font-bold text-white-body tabular-nums">{children}</div>
    </div>
  );
  return (
    <Modal onClose={onClose} label={`Caller — ${name}`}
      panelClassName="w-full max-w-md border border-purple-gamba/40 bg-zinc-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-black text-white-body text-lg leading-tight flex items-center gap-2">
            {name} <StatusBadge status={row.status} />
          </div>
          <div className="text-[11px] font-mono text-white/50 mt-0.5">
            {row.gotIn} of {row.calls} calls made the hunt · {Math.round(row.acceptRate * 100)}% accept
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 border border-white/10 text-white/50 hover:text-white-body">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Stat k="Avg X">{row.avgX == null ? '—' : fmtX(row.avgX)}</Stat>
        <Stat k="Best X">{row.best == null ? '—' : fmtX(row.best)}</Stat>
        <Stat k="Skipped">{row.missed}</Stat>
        <Stat k="Form"><FormStrip form={row.form} /></Stat>
      </div>
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-purple-bright font-mono">
          This hunt · {huntCalls.length} in
        </div>
        {huntCalls.length === 0 && <p className="text-[11px] font-mono text-white/40">No calls in the hunt yet.</p>}
        {huntCalls.map((b) => {
          const stake = Number(b.stake) || 0, win = Number(b.win) || 0;
          const x = stake > 0 && win > 0 ? win / stake : null;
          return (
            <div key={b.id} className="flex items-center justify-between text-[12px] font-mono">
              <span className="text-white-body">{b.slot}</span>
              <span className={x == null ? 'text-white/40' : 'text-white/70'}>{x == null ? 'opening…' : fmtX(x)}</span>
            </div>
          );
        })}
      </div>
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 font-mono">Prior hunts</div>
        <p className="text-[11px] font-mono text-white/55 tabular-nums">
          {priorIn} slots in · {priorPlayed} played{priorAvg != null ? ` · avg ${fmtX(priorAvg)}` : ''}
        </p>
      </div>
    </Modal>
  );
}
