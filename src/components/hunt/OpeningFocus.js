// src/components/hunt/OpeningFocus.js
import { useEffect, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Check } from 'lucide-react';
import ScatterPill from '../ScatterPill';
import { fmt, fmtX } from '../../utils/huntCalc';

function Avatar({ name, size = 48 }) {
  const initials = (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="flex items-center justify-center border border-purple-gamba/40 bg-purple-gamba/10 text-purple-bright font-mono font-bold"
      style={{ width: size, height: size }}>
      {initials || '?'}
    </div>
  );
}

// Centered opening focus card. Parent owns the order + the openingIndex; this
// component renders the current bonus and fires granular callbacks.
export default function OpeningFocus({
  order, idx, openedCount, onWin, onNote, onPrev, onNext, onDefer, onExit, onFinish,
}) {
  const bonus = order[idx] || null;
  const next = order[idx + 1] || null;
  const last = idx >= order.length - 1;
  const payoutRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => payoutRef.current && payoutRef.current.focus(), 30);
    return () => clearTimeout(id);
  }, [idx]);

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Enter') { e.preventDefault(); last ? onFinish() : onNext(); }
      else if (e.key === 'ArrowRight' && !last) onNext();
      else if (e.key === 'ArrowLeft' && idx > 0) onPrev();
      else if (e.key === 'Escape') onExit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!bonus) return null;
  const stake = Number(bonus.stake) || 0;
  const win = Number(bonus.win) || 0;
  const mult = stake > 0 && win > 0 ? win / stake : null;
  const multTone = mult == null ? 'text-white/40'
    : mult >= 100 ? 'text-emerald-bright'
    : mult >= 20 ? 'text-emerald-signal'
    : mult < 1 ? 'text-red-destructive'
    : 'text-white/70';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onExit}
          className="inline-flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-eyebrow-lg font-mono text-white/60 hover:text-white-body">
          <ArrowLeft size={12} aria-hidden="true" /> Back to hunt
        </button>
        <span className="text-[0.625rem] font-bold uppercase tracking-eyebrow-lg font-mono text-purple-bright tabular-nums">
          Opening · {openedCount}/{order.length} done
        </span>
        <span className="text-[0.625rem] font-mono text-white/35 hidden sm:inline">↵ next · ←/→ nav · esc exit</span>
      </div>

      <div className="mx-auto max-w-[1040px] border border-purple-gamba/40 bg-purple-gamba/5 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={bonus.slot} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ScatterPill bonus={bonus} size="md" />
              <p className="font-black text-white-body text-2xl leading-tight truncate">{bonus.slot}</p>
            </div>
            <p className="text-[0.6875rem] font-mono text-white/50 mt-0.5 tabular-nums">
              called by {bonus.caller || '—'} · bonus {idx + 1} of {order.length}
            </p>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={onPrev} disabled={idx === 0}
              className="p-2 border border-white/15 text-white/60 hover:text-white-body disabled:opacity-30" aria-label="Previous bonus">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={onNext} disabled={last}
              className="p-2 border border-white/15 text-white/60 hover:text-white-body disabled:opacity-30" aria-label="Next bonus">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/55 mb-1.5 font-mono">Bet size</span>
            <div className="bg-zinc-broadcast/40 border border-white/10 px-3 py-2 text-white/70 tabular-nums">{fmt(stake)}</div>
          </label>
          <label className="block">
            <span className="block text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/55 mb-1.5 font-mono">Payout</span>
            <input ref={payoutRef} type="number" inputMode="decimal" aria-label="Payout"
              value={bonus.win || ''} onChange={(e) => onWin(bonus.id, e.target.value)}
              placeholder="0.00"
              className="w-full bg-zinc-broadcast/70 border border-purple-gamba/50 px-3 py-2 text-right text-white-body focus:border-purple-bright focus:outline-none tabular-nums" />
          </label>
          <label className="block">
            <span className="block text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/55 mb-1.5 font-mono">Multiplier</span>
            <div className={`px-3 py-2 text-right font-bold tabular-nums border border-white/10 bg-zinc-broadcast/40 ${multTone}`}>
              {mult == null ? '—' : fmtX(mult)}
            </div>
          </label>
        </div>

        <label className="block mt-3">
          <span className="block text-[0.625rem] font-bold uppercase tracking-eyebrow-md text-white/55 mb-1.5 font-mono">Notes</span>
          <textarea value={bonus.note || ''} onChange={(e) => onNote(bonus.id, e.target.value)}
            placeholder="Bonus story, retrigger, big tile…" rows={2}
            className="w-full bg-zinc-broadcast/60 border border-white/10 px-3 py-2 text-sm text-white-body focus:border-emerald-signal/70 focus:outline-none resize-none" />
        </label>

        <div className="flex items-center justify-between gap-2 mt-4">
          <button type="button" onClick={() => onDefer(bonus.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-[0.625rem] font-bold uppercase tracking-eyebrow-lg font-mono ${
              bonus.deferred ? 'border-orange-admin bg-orange-admin/10 text-orange-admin' : 'border-white/15 text-white/60 hover:text-white-body'
            }`}>
            <Clock size={12} aria-hidden="true" /> Later
          </button>
          {next && (
            <span className="text-[0.625rem] font-mono text-white/40 truncate">Next · {next.slot}</span>
          )}
          <button type="button" onClick={last ? onFinish : onNext}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-gamba text-white-body hover:bg-purple-bright transition-colors">
            <span className="text-[0.625rem] font-bold uppercase tracking-eyebrow-lg font-mono">
              {last ? 'Finish opening' : 'Save & continue'}
            </span>
            {last ? <Check size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
