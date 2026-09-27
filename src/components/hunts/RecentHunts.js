import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatMoney } from '../../utils/money';
import { huntTypeLabel, profitLoss, formatHuntDate } from '../../utils/huntFormat';
import ProfitBadge from './ProfitBadge';
import HuntBonuses from './HuntBonuses';
import useHuntDetail from './useHuntDetail';

function HuntRow({ hunt, index }) {
  const { open, toggle, detail, loadError } = useHuntDetail(hunt.id);
  const currency = hunt.currency || null;
  const pot = Number(hunt.pot) > 0 ? hunt.pot : null;
  const tape = String(index + 1).padStart(3, '0');

  return (
    <div className={`border bg-zinc-card/40 transition-colors duration-200 ${open ? 'border-emerald-signal/30' : 'border-white/8 hover:border-emerald-signal/25'}`}>
      <button type="button" onClick={toggle} aria-expanded={open} className="w-full text-left px-4 sm:px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="mt-1 text-[0.625rem] font-bold tracking-eyebrow-md tabular-nums text-emerald-signal/80 font-mono">#{tape}</span>
            <div className="min-w-0">
              <p className="font-bold text-white-body text-base leading-tight tracking-tight truncate">
                {huntTypeLabel(hunt.huntType)} hunt
              </p>
              <p className="mt-1 text-[0.6875rem] tracking-eyebrow-sm uppercase text-white/65 truncate font-mono">
                {formatHuntDate(hunt.endedAt || hunt.startedAt)} · {hunt.bonusCount ?? '—'} bonuses{hunt.status === 'live' ? ' · live' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono">Cost</p>
              <p className="font-bold text-white-body text-sm tabular-nums">{pot == null ? '—' : formatMoney(pot, currency)}</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono">Won</p>
              <p className="font-bold text-white-body text-sm tabular-nums">{formatMoney(hunt.totalWon, currency)}</p>
            </div>
            <div className="text-right">
              <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono">Result</p>
              <ProfitBadge value={profitLoss(hunt)} currency={currency} />
            </div>
            <span className="text-white/60">{open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}</span>
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-white/8 px-4 sm:px-5 pb-5 pt-4">
          <HuntBonuses detail={detail} loadError={loadError} currency={currency} />
        </div>
      )}
    </div>
  );
}

export default function RecentHunts({ hunts }) {
  const list = Array.isArray(hunts) ? hunts : [];
  if (list.length === 0) return null;
  return (
    <div className="border border-white/8 bg-zinc-card/30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-signal" />
          <span>Hunt archive</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/70 tabular-nums">{String(list.length).padStart(3, '0')}</span>
      </div>
      <div className="p-3 space-y-2">
        {list.map((h, i) => (
          <HuntRow key={h.id} hunt={h} index={i} />
        ))}
      </div>
    </div>
  );
}
