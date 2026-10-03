// Dev-only fixtures for /store?fixture=… (StorePage strips them from
// production builds). Items mirror the live catalogue; art is left out so the
// fallbacks show until the generated art lands.

const NOW = Date.now();
const MIN = 60 * 1000;

const ITEMS = [
  {
    id: 'blunt',
    name: 'Roll a blunt',
    description: 'Wanna get lit together and watch Goofer roll a perfect one?',
    cost: 420,
    kind: 'stream',
    stock: null,
    imageUrl: null,
    sortOrder: 0,
    active: true,
  },
  {
    id: 'slot',
    name: 'Pick a Slot',
    description: 'Pick the slot we play next. If I win, you win.',
    cost: 1500,
    kind: 'stream',
    stock: null,
    imageUrl: null,
    sortOrder: 0,
    active: true,
  },
  {
    id: 'bonus',
    name: '$ARS 10,000 Bonus Buy',
    description: 'A $ARS 10,000 bonus buy, half me half you.',
    cost: 10000,
    kind: 'stream',
    stock: 5,
    imageUrl: null,
    sortOrder: 0,
    active: true,
  },
];

const VIEWER = { twitchId: 'v1', displayName: 'GooferFan', profileImageUrl: null };
const user = (tickets, extra = {}) => ({ id: 'v1', tickets, watchMinutes: 845, discordId: null, lastDailyClaimAt: null, ...extra });

const FEED = [
  { id: 'f1', name: 'nightowl_77', itemName: 'Pick a Slot', at: NOW - 40 * MIN },
  { id: 'o1', name: 'GooferFan', itemName: 'Roll a blunt', at: NOW - 8 * MIN },
  { id: 'f2', name: 'couchpotato', itemName: 'Roll a blunt', at: NOW - 3 * 60 * MIN },
];

const ORDERS = [
  { id: 'o1', itemName: 'Roll a blunt', kind: 'stream', status: 'pending', createdAt: new Date(NOW - 8 * MIN) },
  { id: 'o2', itemName: 'Pick a Slot', kind: 'stream', status: 'fulfilled', createdAt: new Date(NOW - 5 * 24 * 60 * MIN) },
  { id: 'o3', itemName: 'Pick a Slot', kind: 'stream', status: 'cancelled', createdAt: new Date(NOW - 12 * 24 * 60 * MIN) },
];

const READY = { ready: true, nextAt: null, remainingMs: 0, claiming: false, error: null };

const BASE = {
  items: ITEMS,
  itemsError: null,
  viewer: VIEWER,
  user: user(1080),
  userLoading: false,
  orders: ORDERS,
  feed: FEED,
  isLive: true,
  order: { phase: 'idle' },
  daily: READY,
  discordUrl: 'https://discord.com/oauth2/authorize?fixture=1',
  initialItemId: null,
};

export const STORE_FIXTURES = {
  rich: { ...BASE, user: user(12000) },
  short: { ...BASE, initialItemId: 'slot' },
  signedout: { ...BASE, viewer: null, user: null, orders: [], daily: null, isLive: false },
  loading: { ...BASE, items: undefined },
  empty: { ...BASE, items: [] },
  soldout: {
    ...BASE,
    user: user(12000),
    items: ITEMS.map((i) => (i.id === 'bonus' ? { ...i, stock: 0 } : i)),
    initialItemId: 'bonus',
  },
  received: { ...BASE, user: user(660), order: { phase: 'received', item: ITEMS[0], orderId: 'xYz9R7Q2', status: 'pending' } },
  busy: { ...BASE, initialItemId: 'slot', order: { phase: 'busy', item: ITEMS[1], message: 'Lines are busy. Try again in a sec.' } },
};
