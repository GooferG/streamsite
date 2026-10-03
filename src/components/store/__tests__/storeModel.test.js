import {
  affordability,
  chyronItems,
  earnHint,
  formatTickets,
  hoursToEarn,
  kindLabel,
  lineup,
  orderNumber,
  orderStatus,
  stockLabel,
  walletState,
} from '../storeModel';

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

test('lineup sorts by sortOrder then cost, numbers the channels and coerces cost', () => {
  const out = lineup([
    { id: 'slot', cost: 1500, sortOrder: 0 },
    { id: 'blunt', cost: '420', sortOrder: 0 },
    { id: 'late', cost: 10, sortOrder: 1 },
  ]);
  expect(out.map((i) => i.id)).toEqual(['blunt', 'slot', 'late']);
  expect(out.map((i) => i.channel)).toEqual(['CH 01', 'CH 02', 'CH 03']);
  expect(out[0].cost).toBe(420);
  expect(lineup(undefined)).toEqual([]);
});

test('affordability covers signed out, exact, short and sold out', () => {
  expect(affordability(null, { cost: 420 })).toEqual({ canOrder: false, short: null, pct: 0 });
  expect(affordability(420, { cost: 420, stock: null })).toEqual({ canOrder: true, short: 0, pct: 1 });
  expect(affordability(1080, { cost: 1500 })).toEqual({ canOrder: false, short: 420, pct: 0.72 });
  expect(affordability(5000, { cost: 420, stock: 0 }).canOrder).toBe(false);
});

test('stock and kind labels', () => {
  expect(stockLabel({ stock: null })).toBe('Unlimited');
  expect(stockLabel({})).toBe('Unlimited');
  expect(stockLabel({ stock: 5 })).toBe('5 left');
  expect(stockLabel({ stock: 0 })).toBe('Sold out');
  expect(kindLabel('stream')).toBe('Played on stream');
  expect(kindLabel('virtual')).toBe('Instant');
});

test('order status maps redemption states to viewer words', () => {
  expect(orderStatus({ status: 'pending', kind: 'stream' })).toEqual({ label: 'Called in', tone: 'signal' });
  expect(orderStatus({ status: 'fulfilled', kind: 'stream' })).toEqual({ label: 'Aired', tone: 'neutral' });
  expect(orderStatus({ status: 'fulfilled', kind: 'virtual' })).toEqual({ label: 'Granted', tone: 'neutral' });
  expect(orderStatus({ status: 'cancelled', kind: 'stream' })).toEqual({ label: 'Refunded', tone: 'loss' });
});

test('hours to earn rounds up at 12 tickets an hour', () => {
  expect(hoursToEarn(0)).toBe(0);
  expect(hoursToEarn(420)).toBe(35);
  expect(hoursToEarn(13)).toBe(2);
  expect(earnHint(420)).toBe('About 35 h of hanging out in chat (less if you talk)');
  expect(earnHint(5)).toBe('Under an hour of hanging out in chat');
});

test('formatting', () => {
  expect(formatTickets(10000)).toBe('10,000');
  expect(formatTickets('420')).toBe('420');
  expect(orderNumber('abcdR7q2')).toBe('#R7Q2');
});

describe('walletState', () => {
  const viewer = { twitchId: 'v1' };
  const item = { cost: 420, stock: null };
  test.each([
    [{ viewer: null }, 'signin'],
    [{ viewer, userLoading: true, user: null }, 'loading'],
    [{ viewer, user: null }, 'missing'],
    [{ viewer, user: { tickets: 9000 }, item: null }, 'none'],
    [{ viewer, user: { tickets: 9000 }, item: { cost: 420, stock: 0 } }, 'soldout'],
    [{ viewer, user: { tickets: 100 }, item }, 'short'],
    [{ viewer, user: {}, item }, 'short'],
    [{ viewer, user: { tickets: 420 }, item }, 'order'],
  ])('%p → %p', (input, out) => {
    expect(walletState({ item, ...input })).toBe(out);
  });
});

describe('chyronItems', () => {
  const items = [
    { id: 'blunt', name: 'Roll a blunt', stock: null },
    { id: 'bonus', name: 'Bonus buy', stock: 5 },
    { id: 'gone', name: 'Gone', stock: 0 },
    { id: 'lots', name: 'Lots', stock: 6 },
  ];

  test('orders, then low stock, then the live line, then standby', () => {
    const feed = [
      { id: 'a', name: 'nightowl_77', itemName: 'Pick a Slot', at: NOW - HOUR },
      { id: 'mine', name: 'GooferFan', itemName: 'Roll a blunt', at: NOW - 2 * HOUR },
    ];
    const out = chyronItems({ feed, items, isLive: true, myOrderIds: ['mine'], now: NOW });
    expect(out).toEqual([
      { key: 'order-a', you: false, who: 'nightowl_77', what: 'Pick a Slot' },
      { key: 'order-mine', you: true, who: null, what: 'Roll a blunt' },
      { key: 'stock-bonus', text: 'Bonus buy · 5 left' },
      { key: 'live', text: 'Goofer is live, orders get played tonight' },
      { key: 'standby', text: 'Operators are standing by' },
    ]);
  });

  test('offline line, the 48 h cutoff and at most five orders', () => {
    const feed = Array.from({ length: 7 }, (_, i) => ({ id: `o${i}`, name: 'x', itemName: 'y', at: NOW - i * HOUR }));
    feed.push({ id: 'old', name: 'x', itemName: 'y', at: NOW - 49 * HOUR });
    const out = chyronItems({ feed, items: [], isLive: false, now: NOW });
    expect(out.filter((t) => t.key.startsWith('order-'))).toHaveLength(5);
    expect(out.find((t) => t.key === 'order-old')).toBeUndefined();
    expect(out.find((t) => t.key === 'live').text).toBe('Orders queue for the next stream');
  });

  // Review Focus 5: old or malformed feed docs never print "undefined".
  test('malformed entries are skipped or named "someone"', () => {
    const feed = [
      { id: 'noitem', name: 'x', at: NOW },
      { id: 'noname', itemName: 'Pick a Slot', at: NOW },
      { id: 'noat', name: 'x', itemName: 'y' },
      { id: 'strat', name: 'z', itemName: 'Roll a blunt', at: String(NOW - HOUR) },
      { name: 'noid', itemName: 'y', at: NOW },
      null,
    ];
    const out = chyronItems({ feed, items: [], isLive: false, now: NOW });
    const orders = out.filter((t) => t.key.startsWith('order-'));
    expect(orders.map((t) => t.key)).toEqual(['order-noname', 'order-strat']);
    expect(orders[0].who).toBe('someone');
    expect(JSON.stringify(out)).not.toContain('undefined');
  });
});
