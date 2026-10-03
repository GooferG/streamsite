import { useState } from 'react';
import { FOCUS, MONO } from '../onAir/classes';
import { formatMoney } from '../../utils/money';
import { formatMultiplier } from '../../utils/huntFormat';

// Slot-by-slot table. Full layout from sm up; on phones the # column and the
// bar drop and the bet moves under the slot name.
const LIMIT = 10;
// Per-slot tile tints for the initials fallback: the one raw-colour exception
// in hunts/ (DESIGN.md §7). None of them is a role colour, so no slot reads as
// a winner or the signal.
const HUES = ['#ffcf5c', '#b48cff', '#ff6b8a', '#6ec3ff', '#c8e06b']; // contract-exempt
const COLS =
  'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 px-3 sm:grid-cols-[44px_minmax(0,1fr)_90px_110px_200px] sm:gap-4 sm:px-[18px]';
const TAGS = {
  best: { label: 'Best hit', className: 'bg-onair-winner/20 text-onair-winner-light' },
  'up-first': { label: 'Up first', className: 'bg-onair-signal/[0.15] text-onair-signal' },
  'up-next': { label: 'Up next', className: 'bg-onair-signal/[0.15] text-onair-signal' },
};

const finite = (v) => v != null && v !== '' && Number.isFinite(Number(v));
const isOpened = (b) => finite(b && b.win);
const pad2 = (n) => String(n).padStart(2, '0');

function initials(slot) {
  const words = String(slot || '').split(/\s+/).filter(Boolean);
  const long = words.filter((w) => w.length > 2);
  return (long.length ? long : words).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

function SlotTile({ bonus, index }) {
  const [broken, setBroken] = useState(false);
  if (bonus.thumb && !broken) {
    return (
      <img
        src={bonus.thumb}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-7 w-7 sm:h-[34px] sm:w-[34px] flex-none rounded-onair-tile object-cover"
      />
    );
  }
  const hue = HUES[index % HUES.length];
  return (
    <span
      aria-hidden="true"
      className="grid h-7 w-7 sm:h-[34px] sm:w-[34px] flex-none place-items-center rounded-onair-tile text-xs font-extrabold"
      style={{ background: `linear-gradient(145deg, ${hue}33, ${hue}0d)`, color: hue }}
    >
      {initials(bonus.slot)}
    </span>
  );
}

function Tag({ kind }) {
  const tag = TAGS[kind];
  return (
    <span className={`${MONO} flex-none whitespace-nowrap rounded-full px-2.5 py-[3px] text-[0.625rem] font-bold tracking-[0.15em] ${tag.className}`}>
      {tag.label}
    </span>
  );
}

function BonusRow({ bonus, index, currency, tag, best, maxMulti }) {
  const opened = isOpened(bonus);
  const m = Number(bonus.multiplier);
  const hasMulti = opened && finite(bonus.multiplier);
  const big = hasMulti && m >= 100;
  const dud = hasMulti && m === 0;
  const multiTone = best ? 'text-onair-winner-light' : big ? 'text-onair-winner-pale' : dud ? 'text-onair-loss' : 'text-onair-ink-3';
  const barTone = best ? 'bg-gradient-to-r from-onair-winner to-onair-winner-light' : big ? 'bg-onair-winner-warm' : 'bg-white/[0.28]';
  const barW = hasMulti && maxMulti > 0 ? Math.max(2, Math.sqrt(m / maxMulti) * 100) : 0;
  const wash = best
    ? 'bg-gradient-to-r from-onair-winner/[0.12] to-transparent to-70%'
    : tag === 'up-first' || tag === 'up-next'
      ? 'bg-gradient-to-r from-onair-signal/10 to-transparent to-70%'
      : '';
  return (
    <div role="row" className={`${COLS} border-t border-white/[0.04] py-[11px] hover:bg-white/[0.03] ${wash}`}>
      <span role="cell" className={`${MONO} hidden text-xs text-onair-ink-5 sm:block`}>
        {pad2(index + 1)}
      </span>
      <div role="cell" className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SlotTile bonus={bonus} index={index} />
        <div className="min-w-0">
          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2.5">
            <p className="max-w-full text-sm font-bold leading-tight line-clamp-2 sm:line-clamp-none sm:truncate sm:text-[0.9375rem]">{bonus.slot || `Bonus ${index + 1}`}</p>
            {tag && <Tag kind={tag} />}
          </div>
          <p className="whitespace-nowrap text-xs text-onair-ink-5 sm:hidden">Bet {formatMoney(bonus.bet, currency)}</p>
        </div>
      </div>
      <span role="cell" className="hidden text-right text-[0.9375rem] tabular-nums text-onair-ink-3 sm:block">
        {formatMoney(bonus.bet, currency)}
      </span>
      <span
        role="cell"
        className={`text-right text-[0.9375rem] font-bold tabular-nums ${opened && !dud ? 'text-onair-ink-1' : 'text-onair-ink-5'}`}
      >
        {opened ? formatMoney(bonus.win, currency) : '—'}
      </span>
      <div role="cell" className="flex items-center justify-end gap-2.5">
        <span className="hidden h-1.5 max-w-[110px] flex-1 overflow-hidden rounded-full bg-white/[0.06] sm:block" aria-hidden="true">
          <span className={`block h-full rounded-full ${barTone}`} style={{ width: `${barW}%` }} />
        </span>
        <span
          className={`text-right sm:w-[62px] text-[0.9375rem] font-extrabold tabular-nums ${hasMulti ? multiTone : 'text-onair-ink-5'}`}
        >
          {hasMulti ? formatMultiplier(m) : '—'}
        </span>
      </div>
    </div>
  );
}

// The collapsed table shows LIMIT rows. While bonuses are still opening the
// window follows the next unopened one (two opened rows above it for context),
// so "Up next" never hides behind Show all; a finished hunt shows the top.
function windowStart(count, nextIndex) {
  if (count <= LIMIT || nextIndex < 0) return 0;
  return Math.max(0, Math.min(nextIndex - 2, count - LIMIT));
}

export default function BonusTable({ bonuses, currency, bestIndex = -1, nextIndex = -1, openedCount = 0 }) {
  const [all, setAll] = useState(false);
  const maxMulti = Math.max(0, ...bonuses.filter((b) => isOpened(b) && finite(b.multiplier)).map((b) => Number(b.multiplier)));
  const start = all ? 0 : windowStart(bonuses.length, nextIndex);
  const visible = all ? bonuses : bonuses.slice(start, start + LIMIT);
  const nextTag = openedCount === 0 ? 'up-first' : 'up-next';
  const shown =
    start === 0 ? `Showing ${LIMIT} of ${bonuses.length}` : `Showing ${start + 1}–${start + LIMIT} of ${bonuses.length}`;
  return (
    <div className="flex flex-col overflow-hidden rounded-onair-inner bg-onair-surface-4 shadow-onair-row">
      <div role="table" aria-label="Bonuses" className="flex flex-col">
        <div role="row" className={`${COLS} ${MONO} bg-white/[0.025] py-3 text-[0.625rem] tracking-[0.2em] text-onair-ink-5`}>
          <span role="columnheader" className="hidden sm:block">#</span>
          <span role="columnheader">Slot</span>
          <span role="columnheader" className="hidden text-right sm:block">Bet</span>
          <span role="columnheader" className="text-right">Payout</span>
          <span role="columnheader" className="text-right">Multi</span>
        </div>
        {visible.map((b, i) => {
          const index = start + i;
          return (
            <BonusRow
              key={`${b.slot}-${index}`}
              bonus={b}
              index={index}
              currency={currency}
              best={index === bestIndex}
              maxMulti={maxMulti}
              tag={index === bestIndex ? 'best' : index === nextIndex ? nextTag : null}
            />
          );
        })}
      </div>
      {/* Outside role="table": the footer is not a row. */}
      {bonuses.length > LIMIT && (
        <div className="border-t border-white/[0.04] px-[18px] py-2 text-center text-sm text-onair-ink-4">
          {all ? `Showing all ${bonuses.length}` : shown} ·{' '}
          <button
            type="button"
            aria-expanded={all}
            onClick={() => setAll((v) => !v)}
            className={`inline-flex min-h-11 items-center rounded-onair-tile px-2 font-bold text-onair-signal hover:text-onair-signal-light sm:min-h-0 sm:py-1 ${FOCUS}`}
          >
            {all ? 'Show fewer' : 'Show all'}
          </button>
        </div>
      )}
    </div>
  );
}
