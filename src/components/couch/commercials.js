import { OPERATOR } from '../store/storeArt';

// The couch TV's commercials for the site's own channels. Off air, reel.js
// runs one after every two clips; while one is on, the TV door goes to its
// channel (couchModel's withCommercial). Pure: TvCommercial.js draws them.

// A commercial's slot, the length of a reel loop. TvCommercial's beats fit it.
export const AD_MS = 8000;

export const COMMERCIALS = {
  gsn: {
    name: 'GSN',
    href: '/store',
    destination: 'Store',
    teaser: 'GSN commercial',
    sentence: 'A Goofer Shopping Network commercial.',
    url: 'goofer.tv/store',
    // TV-size copies of the store's art (public/tv/ads); the operator is the store's own.
    art: {
      ident: '/tv/ads/gsn-ident.webp',
      key: OPERATOR.call,
      items: ['/tv/ads/bonus-buy.webp', '/tv/ads/pick-a-slot.webp', '/tv/ads/smoke-break.webp'],
    },
    lines: { hook: 'Operators are standing by.', pitch: 'Spend your tickets.', cta: 'Call now' },
  },
  video: {
    name: 'Goofer Video',
    href: '/vods',
    destination: 'Vods',
    teaser: 'Goofer Video commercial',
    sentence: 'A Goofer Video commercial.',
    url: 'goofer.tv/vods',
    art: { key: '/gsn/video/clerk-restock.webp', tag: '/gsn/video/clerk-asleep.webp' },
    lines: { hook: 'New tapes on the shelf.', tag: 'Be kind, rewind.' },
  },
  guide: {
    name: 'Goofer Guide',
    href: '/schedule',
    destination: 'Schedule',
    teaser: 'Goofer Guide commercial',
    sentence: 'A Goofer Guide commercial.',
    url: 'goofer.tv/schedule',
    lines: { kicker: 'Coming up' },
  },
};

const ROTATION = ['gsn', 'video', 'guide'];

// The commercials in rotation order, as reel items. The Guide runs only with
// shows to list: [{ day, time, show }], soonest first.
export function commercials({ listings = [] } = {}) {
  return ROTATION.filter((id) => id !== 'guide' || listings.length).map((id) => ({
    kind: 'ad',
    id: `ad-${id}`,
    ad: id,
    ms: AD_MS,
    ...(id === 'guide' ? { listings } : {}),
  }));
}
