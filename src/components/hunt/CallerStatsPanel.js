// src/components/hunt/CallerStatsPanel.js
import { Flame, Trophy, Ban } from 'lucide-react';
import { fmtX, computeCallerStats, CALLER_WIN_X, CALLER_BRICK_X } from '../../utils/huntCalc';
import PanelLabel from './PanelLabel';
import FormStrip from './FormStrip';
import StatusBadge from './StatusBadge';

export default function CallerStatsPanel({ bonuses, history, skippedCalls, onOpenLog }) {
  const s = computeCallerStats(bonuses, history, skippedCalls);
  if (s.leaderboard.length === 0) {
    return (
      <div className="space-y-3">
        <PanelLabel code="05" label="Caller stats" accent="purple" quiet />
        <p className="text-center text-white/55 py-4 text-[12px] font-mono">No calls tagged yet.</p>
      </div>
    );
  }
  const Tile = ({ tone, icon: Icon, k, primary, sub }) => (
    <div className="px-3 py-2 bg-zinc-broadcast/50 border border-white/8">
      <p className={`text-[10px] font-bold uppercase tracking-eyebrow-lg mb-1 font-mono inline-flex items-center gap-1.5 ${tone}`}>
        <Icon size={11} aria-hidden="true" /> {k}
      </p>
      <p className="text-sm font-bold text-white-body tabular-nums">
        {primary}{sub && <span className="text-white/45 font-normal"> · {sub}</span>}
      </p>
    </div>
  );
  return (
    <div className="space-y-3">
      <PanelLabel code="05" label="Caller stats" accent="purple" quiet />
      <div className="grid grid-cols-1 gap-2">
        <Tile tone="text-emerald-signal" icon={Flame} k="On a heater"
          primary={s.hotCaller ? s.hotCaller.name : '—'}
          sub={s.hotCaller ? `avg ${fmtX(s.hotCaller.avgX)} · ${s.hotCaller.hotStreak} hot` : null} />
        <Tile tone="text-emerald-signal" icon={Trophy} k="Best call"
          primary={s.bestCall ? s.bestCall.slot : '—'}
          sub={s.bestCall ? `${fmtX(s.bestCall.x)} · ${s.bestCall.caller}` : null} />
        <Tile tone="text-red-destructive" icon={Ban} k="Brick of the hunt"
          primary={s.worstCall ? s.worstCall.slot : '—'}
          sub={s.worstCall ? `${fmtX(s.worstCall.x)} · ${s.worstCall.caller}` : null} />
      </div>
      <div className="border border-white/8 bg-zinc-broadcast/40">
        {s.leaderboard.map((r, i) => (
          <div key={r.name} className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5 last:border-b-0">
            <span className="text-[10px] font-bold tabular-nums text-white/30 font-mono w-5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <button type="button" onClick={() => onOpenLog(r.name)}
              className="flex-1 min-w-0 truncate font-bold text-purple-bright text-sm text-left hover:underline">
              {r.name}
            </button>
            <StatusBadge status={r.status} />
            <span className="text-[10px] font-mono tabular-nums text-white/55 w-14 text-right">
              {r.gotIn}/{r.calls}
            </span>
            <span className="w-16 flex justify-end"><FormStrip form={r.form} /></span>
            <span className={`text-[11px] font-bold tabular-nums w-14 text-right ${
              r.avgX == null ? 'text-white/40' : r.avgX >= CALLER_WIN_X ? 'text-emerald-signal' : r.avgX < CALLER_BRICK_X ? 'text-red-destructive' : 'text-white/70'
            }`}>
              {r.avgX == null ? '—' : fmtX(r.avgX)}
            </span>
          </div>
        ))}
      </div>
      {s.coldCaller && (
        <p className="text-[10px] font-mono text-white/50 tracking-eyebrow-md">
          {s.coldCaller.name} on a cold streak · {Math.round(s.coldCaller.acceptRate * 100)}% of calls get in
        </p>
      )}
    </div>
  );
}
