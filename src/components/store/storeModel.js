import { toMs } from '../hunts/huntTime';
import { WATCH_TICKETS_PER_HOUR } from '../../utils/earnRates';

// Pure helpers for the GSN store. Items arrive from Firestore; lineup()
// normalises them once (numeric cost, channel number) for everything below.

export const FEED_WINDOW_MS = 48 * 60 * 60 * 1000;
export const LOW_STOCK = 5;

const num = (v) => (typeof v === 'number' ? v : Number(v));

export const formatTickets = (n) => (Number(n) || 0).toLocaleString('en-US');

export const isUnlimited = (item) => item.stock === null || item.stock === undefined;
export const isSoldOut = (item) => !isUnlimited(item) && num(item.stock) <= 0;

export function lineup(items) {
  return [...(items || [])]
    .sort(
      (a, b) =>
        (num(a.sortOrder) || 0) - (num(b.sortOrder) || 0) ||
        (num(a.cost) || 0) - (num(b.cost) || 0) ||
        String(a.name || '').localeCompare(String(b.name || ''))
    )
    .map((item, i) => ({ ...item, cost: num(item.cost) || 0, channel: `CH ${String(i + 1).padStart(2, '0')}` }));
}

// balance null = signed out or the wallet hasn't loaded.
export function affordability(balance, item) {
  const cost = num(item.cost) || 0;
  if (balance == null) return { canOrder: false, short: null, pct: 0 };
  const short = Math.max(0, cost - balance);
  return {
    canOrder: short === 0 && !isSoldOut(item),
    short,
    pct: cost > 0 ? Math.min(1, Math.round((balance / cost) * 100) / 100) : 1,
  };
}

export function stockLabel(item) {
  if (isUnlimited(item)) return 'Unlimited';
  if (isSoldOut(item)) return 'Sold out';
  return `${num(item.stock)} left`;
}

export const kindLabel = (kind) => (kind === 'stream' ? 'Played on stream' : 'Instant');

export function orderStatus(r) {
  if (r.status === 'pending') return { label: 'Called in', tone: 'signal' };
  if (r.status === 'cancelled') return { label: 'Refunded', tone: 'loss' };
  if (r.status === 'fulfilled') return { label: r.kind === 'stream' ? 'Aired' : 'Granted', tone: 'neutral' };
  return { label: 'Unknown', tone: 'neutral' };
}

export function hoursToEarn(short) {
  if (!short || short <= 0) return 0;
  return Math.ceil(short / WATCH_TICKETS_PER_HOUR);
}

export function earnHint(short) {
  if (short < WATCH_TICKETS_PER_HOUR) return 'Under an hour of hanging out in chat';
  return `About ${hoursToEarn(short)} h of hanging out in chat (less if you talk)`;
}

export const orderNumber = (id) => `#${String(id || '').slice(-4).toUpperCase()}`;

export function walletState({ viewer, user, userLoading, item }) {
  if (!viewer) return 'signin';
  if (userLoading) return 'loading';
  if (!user) return 'missing';
  if (!item) return 'none';
  if (isSoldOut(item)) return 'soldout';
  return affordability(num(user.tickets) || 0, item).canOrder ? 'order' : 'short';
}

// The monitor's chyron: recent orders (the viewer's own as "you"), low-stock
// lines, the live line, then the standby line.
export function chyronItems({ feed = [], items = [], isLive = false, myOrderIds = [], now = Date.now() }) {
  const mine = new Set(myOrderIds);
  const orders = (feed || [])
    .filter((o) => o && o.id && o.itemName && now - toMs(num(o.at)) <= FEED_WINDOW_MS)
    .slice(0, 5)
    .map((o) =>
      mine.has(o.id)
        ? { key: `order-${o.id}`, you: true, who: null, what: o.itemName }
        : { key: `order-${o.id}`, you: false, who: o.name || 'someone', what: o.itemName }
    );
  const stock = (items || [])
    .filter((i) => !isUnlimited(i) && !isSoldOut(i) && num(i.stock) <= LOW_STOCK)
    .map((i) => ({ key: `stock-${i.id}`, text: `${i.name} · ${num(i.stock)} left` }));
  return [
    ...orders,
    ...stock,
    { key: 'live', text: isLive ? 'Goofer is live, orders get played tonight' : 'Orders queue for the next stream' },
    { key: 'standby', text: 'Operators are standing by' },
  ];
}
