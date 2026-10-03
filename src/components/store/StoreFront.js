import { useEffect, useMemo, useRef, useState } from 'react';
import { MONO } from '../onAir/classes';
import useNow from '../hunts/useNow';
import GsnBug from './GsnBug';
import StoreMonitor from './StoreMonitor';
import WalletSlip, { WalletDock } from './WalletSlip';
import Lineup from './Lineup';
import EarnPanel from './EarnPanel';
import OrdersPanel from './OrdersPanel';
import { preloadOperator } from './storeArt';
import { chyronItems, formatTickets, lineup, orderNumber } from './storeModel';

const noop = () => {};
const ORDER_PHASES = ['calling', 'received', 'busy'];

const isDesktop = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// The Goofer Shopping Network, composed from raw data (StorePage wires the
// live sources; fixtures feed it in dev and tests). items === undefined is
// loading. The monitor is the detail view, the lineup the browse view, and
// the wallet slip (a dock below lg) carries the order.
export default function StoreFront({
  items,
  itemsError = null,
  viewer = null,
  user = null,
  userLoading = false,
  orders = [],
  feed = [],
  isLive = false,
  order = { phase: 'idle' },
  onOrder = noop,
  onResetOrder = noop,
  daily = null,
  onClaimDaily = noop,
  discordUrl = null,
  onSignIn = noop,
  initialItemId = null,
  onTuneChange = noop,
}) {
  const list = useMemo(() => lineup(items || []), [items]);
  const [tunedId, setTunedId] = useState(initialItemId);
  const [announcement, setAnnouncement] = useState('');
  const monitorRef = useRef(null);
  const balanceAtOrder = useRef(null);
  const now = useNow(60 * 1000);

  // An unknown or vanished id falls back to the first channel.
  const index = Math.max(0, list.findIndex((i) => i.id === tunedId));
  const item = list[index] || null;
  const balance = user ? Number(user.tickets) || 0 : null;
  const phase = order.phase || 'idle';
  let mode = 'item';
  if (items === undefined) mode = 'loading';
  else if (!list.length) mode = itemsError ? 'error' : 'empty';
  else if (ORDER_PHASES.includes(phase)) mode = phase;

  const ticker = chyronItems({ feed, items: list, isLive, myOrderIds: orders.map((o) => o.id), now });

  useEffect(() => {
    if (phase === 'received' && order.item) {
      const before = balanceAtOrder.current;
      const left = before != null ? ` ${formatTickets(before - order.item.cost)} tickets left.` : '';
      setAnnouncement(`Order in: ${order.item.name}, order ${orderNumber(order.orderId).slice(1)}.${left}`);
    } else if (phase === 'busy') {
      setAnnouncement(`${order.message} No tickets were spent.`);
    }
  }, [phase, order.orderId, order.item, order.message]);

  function tune(id, { fromLineup = false } = {}) {
    if (phase === 'calling') return;
    if (phase !== 'idle') onResetOrder();
    setTunedId(id);
    onTuneChange(id);
    if (fromLineup && !isDesktop() && monitorRef.current && typeof monitorRef.current.scrollIntoView === 'function') {
      monitorRef.current.scrollIntoView({ block: 'nearest' });
    }
  }

  function step(delta) {
    if (list.length) tune(list[(index + delta + list.length) % list.length].id);
  }

  function placeOrder(target) {
    balanceAtOrder.current = balance;
    onOrder(target);
  }

  async function claimDaily() {
    const awarded = await onClaimDaily();
    if (awarded) setAnnouncement(`Daily drop claimed: plus ${awarded} tickets.`);
  }

  function onMonitorKey(e) {
    if (mode !== 'item' && mode !== 'busy') return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    }
  }

  const wallet = {
    viewer,
    user,
    userLoading,
    item,
    balance,
    ordering: phase === 'calling',
    onSignIn,
    onOrder: placeOrder,
    onEarn: () => scrollToId('store-earn'),
    onHoldStart: preloadOperator,
  };
  const tear = phase === 'received' && order.item ? { key: order.orderId, amount: order.item.cost } : null;

  return (
    <div className="pb-28 font-onair text-onair-ink-1 lg:pb-0">
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <GsnBug />
          <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>Goofer shopping network</span>
          <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] ${isLive ? 'text-onair-signal' : 'text-onair-ink-5'}`}>
            {isLive ? 'Lines open · Goofer is live' : 'Orders queue for the next stream'}
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h1 className="text-[1.875rem] font-extrabold leading-[0.92] tracking-[-0.035em] sm:text-[3.75rem]">
            Operators are standing by.
          </h1>
          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-onair-ink-4">
            Spend the tickets you earn hanging out in chat. Anything marked{' '}
            <span className="text-onair-signal-light">played on stream</span> happens live, in order.
          </p>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div ref={monitorRef} className="min-w-0 flex-1 scroll-mt-24" onKeyDown={onMonitorKey}>
          <StoreMonitor
            mode={mode}
            item={item}
            position={{ index, count: list.length }}
            order={order}
            isLive={isLive}
            ticker={ticker}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onBack={onResetOrder}
          />
        </div>
        <div className="hidden lg:block lg:w-[300px] lg:flex-none">
          <WalletSlip {...wallet} tear={tear} />
        </div>
      </div>

      {list.length > 0 && (
        <Lineup
          className="mt-10"
          items={list}
          tunedId={item && item.id}
          balance={balance}
          onTune={(id) => tune(id, { fromLineup: true })}
        />
      )}

      <div className={`mt-8 grid gap-5 ${viewer ? 'md:grid-cols-2' : ''}`}>
        <EarnPanel viewer={viewer} user={user} daily={daily} onClaim={claimDaily} onSignIn={onSignIn} discordUrl={discordUrl} />
        {viewer && <OrdersPanel orders={orders} now={now} />}
      </div>

      <WalletDock {...wallet} />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
