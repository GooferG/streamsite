import { useId, useState } from 'react';
import Panel from '../onAir/Panel';
import OnAirButton from '../onAir/OnAirButton';
import { MONO } from '../onAir/classes';
import { formatMoney } from '../../utils/money';
import { formatMultiplier } from '../../utils/huntFormat';
import { formatAvg, signedMoney } from './huntStats';
import BonusTable from './BonusTable';
import MoneyFigure, { fitTextFor } from './MoneyFigure';
import { fitFontSize } from '../../utils/fitText';

// "On the docket" / "Opening now" / "Hunt recap": four stats and the bonus
// table. `kind` picks the stats; past episodes reuse the 'final' kind.
const TONE = { signal: 'text-onair-signal', loss: 'text-onair-loss' };

function cells(kind, stats, currency) {
  const money = (v) => formatMoney(v, currency);
  if (kind === 'docket') {
    return [
      { label: 'Start cost', value: money(stats.startCost) },
      { label: 'Total bet', value: money(stats.totalBet) },
      { label: 'Bonuses', value: stats.bonusCount || '—' },
      { label: 'Required avg', value: formatAvg(stats.requiredAvg), tone: 'signal' },
    ];
  }
  if (kind === 'opening') {
    return [
      { label: 'Start cost', value: money(stats.startCost) },
      { label: 'Won so far', value: money(stats.wonSoFar) },
      { label: 'Opened', value: stats.bonusCount ? `${stats.openedCount}/${stats.bonusCount}` : '—' },
      { label: 'Still need avg', value: formatAvg(stats.stillNeedAvg), tone: 'signal' },
    ];
  }
  return [
    { label: 'Start cost', value: money(stats.startCost) },
    { label: 'Won', value: money(stats.won) },
    { label: 'Avg multi', value: formatMultiplier(stats.avgMulti) },
    {
      label: 'Result',
      value: signedMoney(stats.result, currency),
      tone: stats.result == null ? null : stats.result < 0 ? 'loss' : 'signal',
    },
  ];
}

export default function HuntRecap({ kind, title, stats, currency, loading = false, error = null, onBack = null, headingRef = null }) {
  const [open, setOpen] = useState(true);
  const headingId = useId();
  const tableId = useId();
  const hasBonuses = stats.bonuses.length > 0;
  return (
    <Panel as="section" aria-labelledby={headingId} className="flex flex-col gap-4 p-4 sm:px-6 sm:py-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className="truncate text-xl font-extrabold outline-none">
            {title}
          </h2>
          {stats.bonusCount ? (
            <span className={`${MONO} flex-none text-[0.6875rem] tracking-[0.15em] text-onair-ink-5`}>{stats.bonusCount} bonuses</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          {onBack && (
            <OnAirButton variant="ghost" size="sm" onClick={onBack}>
              Back to tonight
            </OnAirButton>
          )}
          {hasBonuses && (
            <OnAirButton variant="ghost" size="sm" aria-expanded={open} aria-controls={tableId} onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide bonuses' : 'Show bonuses'}
              <span aria-hidden="true">{open ? '↑' : '↓'}</span>
            </OnAirButton>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-onair-inner bg-white/5 sm:grid-cols-4">
        {cells(kind, stats, currency).map((c) => (
          <div key={c.label} className="flex min-w-0 flex-col gap-1 bg-onair-surface-2 px-4 py-3.5" style={{ containerType: 'inline-size' }}>
            <dt className="text-xs text-onair-ink-5">{c.label}</dt>
            {/* Fitted to the cell: long currency figures shrink instead of clipping. */}
            <dd
              className={`whitespace-nowrap text-xl font-extrabold tabular-nums ${TONE[c.tone] || 'text-onair-ink-1'}`}
              style={{ fontSize: fitFontSize(fitTextFor(String(c.value)), { min: 0.875, max: 1.25 }) }}
            >
              <MoneyFigure text={String(c.value)} />
            </dd>
          </div>
        ))}
      </dl>
      {loading && !hasBonuses && <p className={`${MONO} text-[0.625rem] tracking-[0.3em] text-onair-ink-5`}>Loading bonuses…</p>}
      {error && !hasBonuses && <p className="text-sm text-onair-loss">{error}</p>}
      {hasBonuses && open && (
        <div id={tableId}>
          <BonusTable
            bonuses={stats.bonuses}
            currency={currency}
            bestIndex={stats.bestIndex}
            nextIndex={kind === 'final' ? -1 : stats.nextIndex}
            openedCount={stats.openedCount}
          />
        </div>
      )}
    </Panel>
  );
}
