// The browser tab's title per page. The pages with a share card mirror their
// card's title in scripts/share/pages.js (CRA can't import from outside src;
// a test keeps the two in step). Anything unlisted is plain "GooferG".
const SITE = 'GooferG';

const TITLES = {
  '/': SITE,
  '/schedule': 'Schedule · GooferG',
  '/vods': 'Vods · GooferG',
  '/about': 'About · GooferG',
  '/gaming': 'Gaming · GooferG',
  '/gear': 'Gear · GooferG',
  '/gamba': 'Gamba · GooferG',
  '/gamba/leaderboard': 'Leaderboard · GooferG',
  '/gamba/hunts': 'Hunts · GooferG',
  '/gamba/bonus-battle': 'Bonus Battle · GooferG',
  '/gamba/wheel': 'Slot Picker · GooferG',
  '/store': 'Store · GooferG',
  '/giveaway': 'Giveaway · GooferG',
  '/suggest': 'Suggest · GooferG',
  // No share card.
  '/me': 'Account · GooferG',
  '/terms': 'Terms · GooferG',
};

const PREFIXES = [
  ['/admin', 'Admin · GooferG'],
  ['/battle/', 'Bonus Battle · GooferG'],
];

export function titleFor(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (TITLES[path]) return TITLES[path];
  const prefix = PREFIXES.find(([p]) => path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`));
  return prefix ? prefix[1] : SITE;
}
