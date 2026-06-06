import { Plus, X, Radio } from 'lucide-react';
import PanelLabel from './PanelLabel';

// Pending viewer slot-calls, grouped by caller. Only 'open' slots show.
export default function ViewerCalls({ suggestions, onAdd, onSkip, onSkipAll, onOpenLog, intakeControls }) {
  const groups = (suggestions ?? [])
    .map((p) => ({ caller: p.person, items: (p.slots || []).filter((s) => s.status === 'open') }))
    .filter((g) => g.items.length > 0);
  const pendingCount = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <PanelLabel icon={Radio} label="Viewer calls" accent="purple" quiet />
        <span className="text-[10px] font-bold uppercase tracking-eyebrow-lg text-white/45 font-mono tabular-nums">
          {pendingCount} pending
        </span>
      </div>
      {intakeControls}
      {groups.length === 0 ? (
        <p className="text-center text-white/55 py-4 text-[12px] font-mono">No pending calls.</p>
      ) : (
        <div className="border border-white/8 bg-zinc-broadcast/40 divide-y divide-white/5">
          {groups.map((g) => (
            <div key={g.caller} className="px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <button type="button" onClick={() => onOpenLog && onOpenLog(g.caller)}
                  className="font-bold text-purple-bright text-sm hover:underline">
                  {g.caller}
                </button>
                {g.items.length > 1 && onSkipAll && (
                  <button type="button" onClick={() => onSkipAll(g.caller, g.items)}
                    className="text-[10px] font-bold uppercase tracking-eyebrow-md font-mono text-white/45 hover:text-red-destructive">
                    Skip all
                  </button>
                )}
              </div>
              {g.items.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-[13px] text-white-body truncate">{s.name}</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" onClick={() => onSkip(g.caller, s)}
                      title="Didn't make the hunt — counts against this caller"
                      className="inline-flex items-center gap-1 px-2 py-1 border border-white/10 text-white/55 hover:text-red-destructive hover:border-red-destructive/40 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
                      <X size={11} aria-hidden="true" /> Skip
                    </button>
                    <button type="button" onClick={() => onAdd(g.caller, s)}
                      className="inline-flex items-center gap-1 px-2 py-1 border border-emerald-signal/50 text-emerald-signal hover:bg-emerald-signal/10 text-[10px] font-bold uppercase tracking-eyebrow-md font-mono">
                      <Plus size={11} aria-hidden="true" /> Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
