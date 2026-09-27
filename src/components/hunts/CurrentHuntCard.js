import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatMoney } from '../../utils/money';
import { huntTypeLabel, profitLoss, formatHuntDate, formatMultiplier } from '../../utils/huntFormat';
import ProfitBadge from './ProfitBadge';
import BonusReel from './BonusReel';
import HuntBonuses from './HuntBonuses';
import useHuntDetail from './useHuntDetail';

function Stat({ label, children }) {
  return (
    <div>
      <p className="text-[0.625rem] font-bold tracking-eyebrow-md uppercase text-white/65 mb-0.5 font-mono">{label}</p>
      <div className="font-bold text-white-body text-sm tabular-nums">{children}</div>
    </div>
  );
}

// GooferG's live hunt (with its bonus reel), or his most recent one. A
// finished hunt's bonuses load on demand: off-stream this card is the only
// place the latest hunt appears (the archive skips it).
export default function CurrentHuntCard({ hunt, isLive }) {
  const bonuses = useHuntDetail(hunt && hunt.id);
  if (!hunt) return null;
  const currency = hunt.currency || null;
  const pot = Number(hunt.pot) > 0 ? hunt.pot : null;
  return (
    <section className="border border-white/8 bg-zinc-card/30" aria-label={isLive ? 'Live hunt' : 'Latest hunt'}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
        <span className={`inline-flex items-center gap-2 ${isLive ? 'text-emerald-signal' : 'text-white/70'}`}>
          <span className="relative flex w-1.5 h-1.5">
            {isLive && <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />}
            <span className={`relative w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-signal' : 'bg-white/50'}`} />
          </span>
          <span>{isLive ? 'Live hunt' : 'Latest hunt'}</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/65">{huntTypeLabel(hunt.huntType)}</span>
        <span className="text-white/15">·</span>
        <span className="text-white/45">{formatHuntDate(isLive ? hunt.startedAt : hunt.endedAt || hunt.startedAt)}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 px-4 sm:px-5 py-4">
        <Stat label="Bonuses">{hunt.bonusCount ?? '—'}</Stat>
        <Stat label="Start cost">{pot == null ? '—' : formatMoney(pot, currency)}</Stat>
        <Stat label="Won">{formatMoney(hunt.totalWon, currency)}</Stat>
        <Stat label="Avg multi">{formatMultiplier(hunt.averageMultiple)}</Stat>
        <Stat label="Result">
          <ProfitBadge value={profitLoss(hunt)} currency={currency} />
        </Stat>
      </div>
      {isLive && Array.isArray(hunt.bonuses) && hunt.bonuses.length > 0 && (
        <div className="border-t border-white/8 px-4 sm:px-5 pb-5 pt-4">
          <BonusReel bonuses={hunt.bonuses} currency={currency} />
        </div>
      )}
      {!isLive && (
        <div className="border-t border-white/8">
          <button
            type="button"
            onClick={bonuses.toggle}
            aria-expanded={bonuses.open}
            className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono text-white/65 hover:text-white-body transition-colors duration-150"
          >
            <span>{bonuses.open ? 'Hide bonuses' : 'Show bonuses'}</span>
            {bonuses.open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          </button>
          {bonuses.open && (
            <div className="px-4 sm:px-5 pb-5">
              <HuntBonuses detail={bonuses.detail} loadError={bonuses.loadError} currency={currency} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
