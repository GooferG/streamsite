// The site's channels, in nav order. Codes show on the desktop bar from xl and
// in the side sheet; Gamba (04) carries the 4-0 … 4-4 subchannels.
export const NAV_ITEMS = [
  { id: 'home', label: 'Home', code: '01', path: '/' },
  { id: 'schedule', label: 'Schedule', code: '02', path: '/schedule' },
  { id: 'vods', label: 'Vods', code: '03', path: '/vods' },
  { id: 'gamba', label: 'Gamba', code: '04', path: '/gamba' },
  { id: 'gaming', label: 'Gaming', code: '05', path: '/gaming' },
  { id: 'store', label: 'Store', code: '06', path: '/store' },
  { id: 'giveaway', label: 'Giveaway', code: '07', path: '/giveaway' },
  { id: 'about', label: 'About', code: '08', path: '/about' },
];

export const GAMBA_ITEM = NAV_ITEMS.find((i) => i.id === 'gamba');

// The first path segment names the active page ('' is home).
export function activePageId(pathname) {
  return pathname.split('/').filter(Boolean)[0] || 'home';
}

// aria-current for a nav link: 'page' on its own path, 'true' elsewhere in its
// section (e.g. Gamba while on /gamba/hunts), undefined otherwise.
export function currentFor(item, pathname) {
  if (activePageId(pathname) !== item.id) return undefined;
  return pathname.replace(/\/+$/, '') === item.path.replace(/\/+$/, '') ? 'page' : 'true';
}
