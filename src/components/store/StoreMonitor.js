import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Monitor from '../onAir/Monitor';
import Chip from '../onAir/Chip';
import OnAirButton from '../onAir/OnAirButton';
import { FOCUS, MONO } from '../onAir/classes';
import GsnBug from './GsnBug';
import ItemArt from './ItemArt';
import Operator from './Operator';
import { IDENT } from './storeArt';
import { formatTickets, isSoldOut, kindLabel, orderNumber, stockLabel } from './storeModel';

const IDENT_LINES = {
  loading: 'Tuning in…',
  empty: 'Off the air. Nothing on the shelf yet.',
  error: 'Signal lost. Try again in a bit.',
};
const STAGE = 'mt-4 flex min-h-[220px] flex-col items-center justify-center gap-3 text-center sm:mt-5 sm:min-h-[280px]';
const CONTROL =
  'inline-flex h-8 w-8 items-center justify-center rounded-onair-tile bg-white/[0.07] text-onair-ink-2 transition-colors duration-150 hover:bg-white/[0.12] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11';

function Ident({ mode }) {
  const [art, setArt] = useState(true);
  return (
    <div className={`relative overflow-hidden rounded-onair-inner ${STAGE}`}>
      {art && (
        <img
          src={IDENT}
          alt=""
          aria-hidden="true"
          onError={() => setArt(false)}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
      )}
      <GsnBug size="lg" className="relative" />
      <p className={`${MONO} relative text-xs tracking-[0.2em] text-onair-ink-2`}>{IDENT_LINES[mode]}</p>
    </div>
  );
}

function ItemChannel({ item }) {
  return (
    <div className="mt-4 grid items-center gap-5 sm:mt-5 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] sm:gap-7">
      <ItemArt key={item.id} item={item} eager dim={isSoldOut(item)} className="aspect-[4/3] rounded-onair-inner" />
      <div className="min-w-0">
        <h2 className="text-[1.875rem] font-extrabold leading-none tracking-[-0.025em]">{item.name}</h2>
        {item.description && (
          <p className="mt-2.5 hidden text-[0.9375rem] leading-relaxed text-onair-ink-4 sm:block">{item.description}</p>
        )}
        <p className="mt-4 flex items-baseline gap-2.5">
          <span className="text-[3.75rem] font-extrabold leading-[0.85] tracking-[-0.03em] text-onair-signal tabular-nums">
            {formatTickets(item.cost)}
          </span>
          <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>tickets</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip size="sm" tone="signal">
            {kindLabel(item.kind)}
          </Chip>
          <Chip size="sm">{stockLabel(item)}</Chip>
        </div>
      </div>
    </div>
  );
}

function Calling({ item }) {
  return (
    <div className={STAGE}>
      <Operator key="call" pose="call" className="h-36 w-28 rounded-onair-tile sm:h-44 sm:w-36" />
      <p className={`${MONO} text-xs tracking-[0.2em] text-onair-ink-2`}>Line 1 · connecting…</p>
      <p className="text-[1.375rem] font-bold">{item.name}</p>
    </div>
  );
}

function Received({ order }) {
  return (
    <div className={`relative ${STAGE}`}>
      <p className={`${MONO} text-xs tracking-[0.2em] text-onair-winner-light`}>Order {orderNumber(order.orderId)}</p>
      <p className="text-[1.875rem] font-extrabold leading-[0.95] tracking-[-0.03em] sm:text-[3.75rem]">
        {order.status === 'fulfilled' ? 'Granted.' : "You're on the list."}
      </p>
      <p className="text-[0.9375rem] text-onair-ink-3">{order.item.name}</p>
      <Operator key="standby" pose="standby" className="absolute bottom-0 right-0 hidden h-28 w-[5.5rem] rounded-onair-tile sm:block" />
    </div>
  );
}

function Busy({ order, onBack }) {
  return (
    <div className={STAGE}>
      <Operator key="shrug" pose="shrug" className="h-32 w-[6.5rem] rounded-onair-tile" />
      <p className="text-[1.375rem] font-bold">{order.message}</p>
      <p className="text-[0.9375rem] text-onair-ink-3">No tickets were spent.</p>
      <OnAirButton variant="ghost" size="sm" className="mt-1" onClick={onBack}>
        Back to the lineup
      </OnAirButton>
    </div>
  );
}

function Tick({ tick }) {
  if (tick.text != null) return tick.text;
  return (
    <>
      Order in · {tick.you ? <span className="text-onair-viewer-light">you</span> : tick.who} · {tick.what}
    </>
  );
}

// The GSN monitor: one item on air, or the order line (calling, received,
// busy), or the station ident while loading / empty / failed.
export default function StoreMonitor({ mode, item, position, order, isLive, ticker = [], onPrev, onNext, onBack }) {
  const onOrderLine = mode === 'calling' || mode === 'received' || mode === 'busy';
  const showsItem = (mode === 'item' || mode === 'busy') && !!item;
  const tint = mode === 'received' ? 'winner' : mode === 'item' || mode === 'calling' ? 'signal' : 'neutral';
  let channelKey = mode;
  if (mode === 'loading') channelKey = null;
  else if (mode === 'item') channelKey = `item:${item.id}`;
  else if (mode === 'received') channelKey = `received:${order.orderId}`;
  else if (onOrderLine) channelKey = `${mode}:${order.item.id}`;

  const controls =
    showsItem && position && position.count > 1 ? (
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Previous item" onClick={onPrev} className={`${CONTROL} ${FOCUS}`}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Next item" onClick={onNext} className={`${CONTROL} ${FOCUS}`}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    ) : null;

  return (
    <Monitor
      label="Store monitor"
      tint={tint}
      status={isLive ? 'live' : null}
      channel={mode === 'item' ? `${item.channel} · Now selling` : onOrderLine ? 'Order line' : 'GSN · Standby'}
      clock={mode === 'item' && position ? { long: `${position.index + 1} of ${position.count}` } : null}
      channelKey={channelKey}
      readout={showsItem ? { channel: item.channel, label: `${formatTickets(item.cost)} TK`, tone: 'signal' } : null}
      controls={controls}
      chyron={
        ticker.length
          ? {
              tag: 'Order line',
              tone: mode === 'received' ? 'winner' : 'signal',
              label: 'Order line ticker',
              items: ticker.map((t) => <Tick key={t.key} tick={t} />),
            }
          : null
      }
    >
      {mode === 'item' && <ItemChannel item={item} />}
      {mode === 'calling' && <Calling item={order.item} />}
      {mode === 'received' && <Received order={order} />}
      {mode === 'busy' && <Busy order={order} onBack={onBack} />}
      {(mode === 'loading' || mode === 'empty' || mode === 'error') && <Ident mode={mode} />}
    </Monitor>
  );
}
