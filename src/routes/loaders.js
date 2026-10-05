// One loader per lazily loaded public page, shared by App's lazy() routes and
// the couch's doors: hovering a door starts the same chunk the route needs.
// Home and Gamba are eager and have no loader.
export const PAGE_LOADERS = {
  schedule: () => import('../pages/SchedulePage'),
  vods: () => import('../pages/VodsPage'),
  about: () => import('../pages/AboutPage'),
  gaming: () => import('../pages/GamingPage'),
  store: () => import('../pages/StorePage'),
  giveaway: () => import('../pages/GiveawayPage'),
};

const started = new Map();

// "/gamba/hunts?x" -> "gamba"; "/" and external links -> null.
export function routeKey(href) {
  if (typeof href !== 'string' || !href.startsWith('/')) return null;
  return href.split(/[?#]/)[0].split('/')[1] || null;
}

// Starts (once) the chunk for `href`'s page. A failed load is forgotten so the
// next hover retries; the returned promise never rejects.
export function prefetchRoute(href) {
  const key = routeKey(href);
  // Own keys only: "/constructor" is no page.
  if (!key || !Object.prototype.hasOwnProperty.call(PAGE_LOADERS, key)) return Promise.resolve();
  if (!started.has(key)) {
    started.set(
      key,
      PAGE_LOADERS[key]().then(
        () => undefined,
        () => {
          started.delete(key);
        }
      )
    );
  }
  return started.get(key);
}

export function __resetPrefetchForTests() {
  started.clear();
}
