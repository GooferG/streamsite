import Panel from '../onAir/Panel';
import Chip from '../onAir/Chip';
import { FOCUS, MONO } from '../onAir/classes';
import ItemArt from './ItemArt';
import ProgressBar from './ProgressBar';
import { affordability, formatTickets, isSoldOut, isUnlimited, kindLabel, stockLabel } from './storeModel';

const SMALL = `${MONO} text-[0.625rem] tracking-[0.15em]`;

function statusOf(item, balance) {
  if (isSoldOut(item)) return { kind: 'soldout', text: 'sold out' };
  if (balance == null) return { kind: 'none', text: null };
  const a = affordability(balance, item);
  return a.canOrder
    ? { kind: 'can', text: 'you can order' }
    : { kind: 'short', text: `${formatTickets(a.short)} short`, pct: a.pct };
}

function LineupCard({ item, tuned, balance, onTune }) {
  const status = statusOf(item, balance);
  const name = [item.name, `${formatTickets(item.cost)} tickets`, status.text].filter(Boolean).join(', ');
  return (
    <button
      type="button"
      aria-pressed={tuned}
      aria-label={name}
      onClick={() => onTune(item.id)}
      className={`block h-full w-full rounded-onair-row text-left ${FOCUS}`}
    >
      <Panel as="span" radius="row" lit={tuned ? 'signal' : null} className="flex h-full items-center gap-3 p-2.5 sm:flex-col sm:items-stretch">
        <span className="relative block w-20 flex-none sm:w-full">
          <ItemArt key={item.id} item={item} dim={status.kind === 'soldout'} className="aspect-[4/3] rounded-onair-tile sm:aspect-video" />
          {tuned && (
            <span className={`${SMALL} absolute left-1.5 top-1.5 hidden rounded-onair-tile bg-black/60 px-1.5 py-1 text-onair-signal sm:block`}>
              On screen
            </span>
          )}
        </span>
        <span className="block min-w-0 flex-1 sm:px-1.5 sm:pb-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className={`${MONO} text-[0.625rem] tracking-[0.2em] ${tuned ? 'text-onair-signal' : 'text-onair-ink-5'}`}>{item.channel}</span>
            <span className={`${SMALL} hidden text-onair-ink-4 sm:inline`}>{isUnlimited(item) ? kindLabel(item.kind) : stockLabel(item)}</span>
          </span>
          <span className="mt-1 block truncate text-[1.0625rem] font-bold">{item.name}</span>
          <span className="mt-2 flex items-center justify-between gap-2">
            <span className="tabular-nums">
              <span className="text-[1.375rem] font-extrabold">{formatTickets(item.cost)}</span>{' '}
              <span className={`${SMALL} text-onair-ink-4`}>tk</span>
            </span>
            {status.kind === 'can' && (
              <Chip size="sm" tone="signal">
                You can order
              </Chip>
            )}
            {status.kind === 'soldout' && <Chip size="sm">Sold out</Chip>}
            {status.kind === 'short' && <span className={`${SMALL} text-onair-ink-4`}>{status.text}</span>}
          </span>
          {status.kind === 'short' && <ProgressBar pct={status.pct} className="mt-2" />}
        </span>
      </Panel>
    </button>
  );
}

// Every item in one place. Cards tune the monitor; the grid becomes compact
// rows below sm.
export default function Lineup({ items, tunedId, balance, onTune, className = '' }) {
  const count = items.length;
  return (
    <section aria-labelledby="store-lineup-title" className={className}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>Full lineup</p>
          <h2 id="store-lineup-title" className="mt-1 text-[1.5rem] font-extrabold tracking-[-0.02em]">
            Everything on tonight
          </h2>
        </div>
        <p className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-5`}>
          {count} {count === 1 ? 'channel' : 'channels'}
        </p>
      </div>
      <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <LineupCard item={item} tuned={item.id === tunedId} balance={balance} onTune={onTune} />
          </li>
        ))}
      </ul>
    </section>
  );
}
