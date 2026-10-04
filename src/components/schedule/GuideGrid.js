import Chip from '../onAir/Chip';
import Panel from '../onAir/Panel';
import { MONO } from '../onAir/classes';

const SMALL = `${MONO} text-[0.625rem] tracking-[0.2em]`;
const COLUMNS = 'md:grid md:grid-cols-[132px_minmax(0,1fr)] md:gap-1.5';

// From md the guide is a grid: a day tile beside a time track with the show
// placed on it. Below md each day is a row of its own (day, time, show) with a
// thin time bar, so the same markup reads in both.
const ROW_PHONE = 'p-3.5 md:rounded-none md:bg-transparent md:bg-none md:p-0 md:shadow-none';
const TRACK =
  'relative mt-2 md:mt-0 md:h-[76px] md:overflow-hidden md:rounded-onair-tile md:bg-black/[0.28] md:shadow-onair-well';

const isLit = (row) => row.state === 'next' || row.state === 'live';

function Tags({ row }) {
  if (row.badge === 'Aired') return <span className={`${SMALL} flex-none text-onair-ink-5`}>Aired</span>;
  if (!row.badge && !row.special) return null;
  return (
    <span className="flex flex-none gap-1.5">
      {/* Running late keeps the off-air neutral, like the promo's "Any minute". */}
      {row.badge && (
        <Chip size="sm" tone={row.badge === 'Running late' ? 'neutral' : 'signal'}>
          {row.badge}
        </Chip>
      )}
      {row.special && <Chip size="sm">Special</Chip>}
    </span>
  );
}

function blockSurface(row) {
  if (isLit(row)) {
    return 'bg-gradient-to-r from-onair-signal-deep/[0.3] to-onair-signal-deep/[0.12] shadow-onair-lit-signal';
  }
  if (row.state === 'aired') return 'bg-white/[0.04]';
  return 'bg-white/[0.09] shadow-onair-row';
}

// The show. On the grid it sits at its start and runs its length; an open
// end fades its surface out (never the text). Text longer than the block runs
// on into the empty track: rightward, or leftward for a block in the right
// half, so it never runs off the track's edge. A time that doesn't read fills
// the track.
function Block({ row, block }) {
  const lit = isLit(row);
  const place = block ? 'md:left-[var(--l)] md:w-[var(--w)]' : 'md:inset-x-1.5';
  const anchor = block && block.left > 50 ? 'md:items-end' : '';
  const fade = block && block.openEnd ? '[mask-image:linear-gradient(90deg,#000_55%,transparent)]' : '';
  // Small labels on a lit (washed) row step up an ink (Readable Labels).
  const small = lit ? 'text-onair-ink-3' : 'text-onair-ink-5';
  return (
    <div
      data-lit={lit ? 'signal' : undefined}
      className={`flex min-w-0 flex-col gap-0.5 md:absolute md:inset-y-1.5 md:justify-center md:px-3.5 ${place} ${anchor}`}
    >
      <span className={`absolute inset-0 hidden rounded-onair-tile md:block ${blockSurface(row)} ${fade}`} aria-hidden="true" />
      <p className="relative order-2 flex min-w-0 items-center gap-2 md:order-1">
        <span className={`truncate text-[0.9375rem] font-bold md:overflow-visible ${row.state === 'aired' ? 'text-onair-ink-4' : ''}`}>
          {row.title || 'Stream'}
        </span>
        <Tags row={row} />
      </p>
      <p className="relative order-1 flex flex-wrap items-baseline gap-x-2 md:order-2 md:flex-nowrap md:whitespace-nowrap">
        <span className="text-[1.0625rem] font-bold tabular-nums md:font-onair-mono md:text-[0.6875rem] md:uppercase md:tracking-[0.15em] md:text-onair-ink-3">
          {row.time.primary}
        </span>
        {row.time.secondary && <span className={`${SMALL} ${small}`}>{row.time.secondary}</span>}
        {row.category && <span className={`${SMALL} ${lit ? 'text-onair-ink-3' : 'text-onair-ink-4'}`}>{row.category}</span>}
      </p>
    </div>
  );
}

function OffBand() {
  return (
    <div className="md:absolute md:inset-1.5 md:flex md:items-center md:justify-center md:overflow-hidden md:rounded-onair-tile">
      <span className="absolute inset-0 hidden bg-onair-track opacity-[0.12] md:block" aria-hidden="true" />
      <span className={`${SMALL} relative text-onair-ink-5`}>Off air</span>
    </div>
  );
}

// Phones: where the show sits in the day, as a thin bar.
function TimeBar({ block, lit, now }) {
  return (
    <div className="relative mt-2.5 h-1.5 rounded-full bg-black/[0.35] md:hidden" aria-hidden="true">
      {block && (
        <span
          className={`absolute inset-y-0 rounded-full ${lit ? 'bg-onair-signal' : 'bg-onair-ink-5'}`}
          style={{ left: `${block.left}%`, width: `${block.width}%` }}
        />
      )}
      {now != null && <span className="absolute -inset-y-1 w-0.5 rounded-full bg-onair-ink-2" style={{ left: `${now}%` }} />}
    </div>
  );
}

function GuideRow({ row, layout }) {
  const block = layout.blocks[row.key];
  const lit = isLit(row);
  const off = row.state === 'off';
  const now = row.isToday ? layout.now : null;
  const vars = block ? { '--l': `${block.left}%`, '--w': `${block.width}%` } : undefined;
  // "MON Monday" says the day twice; the code only adds something to Today and Tomorrow.
  const codeHidden = row.label !== 'Today' && row.label !== 'Tomorrow';
  return (
    <Panel as="li" radius="row" lit={lit ? 'signal' : null} className={`${ROW_PHONE} ${COLUMNS}`} style={vars}>
      <div className="flex items-baseline gap-2 md:block md:rounded-onair-tile md:bg-white/[0.05] md:px-3.5 md:py-3 md:shadow-onair-row">
        <span className={`${SMALL} ${lit ? 'text-onair-signal' : 'text-onair-ink-5'}`} aria-hidden={codeHidden || undefined}>
          {row.code}
        </span>
        <span
          className={`text-[0.9375rem] font-bold leading-tight md:mt-0.5 md:block md:text-[1.0625rem] ${off ? 'text-onair-ink-4' : ''}`}
        >
          {row.label}
        </span>
      </div>
      <div className={TRACK}>
        <div className="absolute inset-0 hidden md:block" aria-hidden="true">
          {layout.ticks.slice(1).map((t) => (
            <span key={t.at} className="absolute inset-y-0 w-px bg-white/[0.05]" style={{ left: `${t.left}%` }} />
          ))}
        </div>
        {/* Behind the show, so it never runs through the text. */}
        {now != null && (
          <span
            data-now
            aria-hidden="true"
            className="absolute inset-y-0 hidden w-0.5 bg-onair-signal md:block"
            style={{ left: `${now}%` }}
          />
        )}
        {off ? <OffBand /> : <Block row={row} block={block} />}
        <TimeBar block={block} lit={lit} now={now} />
      </div>
    </Panel>
  );
}

// The week as a cable guide grid, today first, hours across on the viewer's
// clock. The lit block is the slot in the promo; the line on today is now.
export default function GuideGrid({ rows, layout, zone, className = '' }) {
  const thin = layout.ticks.length > 8;
  return (
    <section aria-labelledby="schedule-grid-title" className={className}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>The grid</p>
          <h2 id="schedule-grid-title" className="mt-1 text-[1.5rem] font-extrabold tracking-[-0.02em]">
            The week ahead
          </h2>
        </div>
        {zone && <p className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>Times on your clock · {zone}</p>}
      </div>
      <div className="md:rounded-onair-card md:bg-gradient-to-b md:from-onair-surface-1 md:to-onair-surface-3 md:p-4 md:shadow-onair-card">
        <div className={`mb-1.5 hidden ${COLUMNS}`} aria-hidden="true">
          <span />
          <div className="relative h-5">
            {layout.ticks.map((t, i) => (
              <span
                key={t.at}
                className={`${SMALL} absolute bottom-0 whitespace-nowrap pl-1.5 text-onair-ink-4 ${thin && i % 2 ? 'hidden lg:inline' : ''}`}
                style={{ left: `${t.left}%` }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <ol aria-label="This week" className="grid gap-2.5 md:gap-1.5">
          {rows.map((row) => (
            <GuideRow key={row.key} row={row} layout={layout} />
          ))}
        </ol>
      </div>
    </section>
  );
}
