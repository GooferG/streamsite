// Dev fixtures for the couch (/?fixture=…) and the tests' inputs. Loaded by
// HomePage only outside production builds. Sunday 10:00 AM in Arizona.
const NOW = Date.parse('2026-10-04T17:00:00Z');
const DAY = 86400000;
const HOUR = 3600000;

const SCHEDULE = [
  { day: 'MONDAY', time: '11:00 AM AZ', content: 'Slots', gameName: 'Bonus Hunt Time!', status: 'on' },
  { day: 'TUESDAY', time: '5:00 PM AZ', content: 'Slots', gameName: 'Freestyle Chilling', status: 'regular' },
];

const VIDEOS = [
  {
    id: '2585950001',
    title: 'Win Wednesdays 💥 Games and Gamba? 💥communityhunts.gg / goofer.tv',
    created_at: '2026-10-02T03:00:00Z',
    duration: '4h37m20s',
    thumbnail_url: 'https://static-cdn.jtvnw.net/cf_vods/d1m7jfoe9zdc1j/thumb/thumb0-%{width}x%{height}.jpg',
  },
];

const CLIPS = [
  { id: 'c1', title: 'chat called it', thumbnail_url: 'https://clips-media-assets2.twitch.tv/c1-preview-480x272.jpg' },
  { id: 'c2', title: 'the 1,240x', thumbnail_url: 'https://clips-media-assets2.twitch.tv/c2-preview-480x272.jpg' },
];

const LAST_HUNT = {
  id: 'h9',
  status: 'finished',
  totalWon: 412,
  pot: 600,
  currency: null,
  bonusCount: 3,
  bonuses: [
    { slot: 'Sugar Rush 1000', bet: 0.5, win: 620, multiplier: 1240 },
    { slot: 'Wanted Dead or a Wild', bet: 0.5, win: 244, multiplier: 488 },
    { slot: "Groovin' Gems", bet: 0.5, win: null, multiplier: null },
  ],
};

const LIVE_HUNT = {
  id: 'h10',
  status: 'live',
  pot: 600,
  currency: null,
  bonusCount: 23,
  bonuses: Array.from({ length: 23 }, (_, i) => {
    if (i >= 14) return { slot: `Slot ${i + 1}`, bet: 1, win: null, multiplier: null };
    const win = i === 13 ? 48 : 28;
    return { slot: `Slot ${i + 1}`, bet: 1, win, multiplier: win };
  }),
};

const BASE = {
  now: NOW,
  timeZone: 'America/Phoenix',
  statusReady: true,
  isLive: false,
  stream: null,
  schedule: SCHEDULE,
  videos: VIDEOS,
  clips: CLIPS,
  category: 'Slots',
  hunts: { live: null, recent: [{ id: 'h9', status: 'finished', totalWon: 412, pot: 600 }], loading: false, error: null },
  round: null,
  lastHunt: LAST_HUNT,
  leaderboardEndsAt: NOW + 3 * DAY + 4 * HOUR,
  giveaway: null,
  games: [
    { appid: 2694490, name: 'Path of Exile 2', playtime_2weeks: 14 },
    { appid: 2379780, name: 'Balatro', playtime_2weeks: 6 },
    { appid: 294100, name: 'RimWorld', playtime_2weeks: 3 },
    { appid: 1145360, name: 'Hades', playtime_2weeks: 1 },
  ],
  lastVisit: Date.parse('2026-09-30T00:00:00Z'),
  reel: null,
};

const LIVE = {
  ...BASE,
  isLive: true,
  stream: {
    title: 'Bonus hunt night, chat picks the last slot',
    viewers: 214,
    game: 'Slots',
    thumbnailUrl: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_gooferg-{width}x{height}.jpg',
  },
};

export const COUCH_FIXTURES = {
  offair: { input: BASE },
  live: { input: LIVE },
  giveaway: { input: { ...LIVE, giveaway: { keyword: '!goof', prize: '$25.00 bonus buy', status: 'open' } } },
  hunt: { input: { ...LIVE, hunts: { live: LIVE_HUNT, recent: [], loading: false, error: null } } },
  round: { input: { ...BASE, round: { id: 'r1', acceptPredictions: true, status: 'open', entryCount: 37, source: 'manual' } } },
  late: {
    input: {
      ...BASE,
      schedule: [{ day: 'SUNDAY', time: '9:00 AM AZ', content: 'Slots', gameName: 'Sunday Slots', status: 'on' }, ...SCHEDULE],
    },
  },
  loading: {
    input: {
      ...BASE,
      statusReady: false,
      schedule: null,
      videos: [],
      clips: [],
      category: null,
      hunts: { live: null, recent: [], loading: true, error: null },
      round: undefined,
      lastHunt: null,
      leaderboardEndsAt: null,
      games: null,
      lastVisit: null,
    },
  },
  noart: { input: BASE, noArt: true },
  empty: {
    input: {
      ...BASE,
      schedule: [],
      videos: [],
      clips: [],
      category: null,
      hunts: { live: null, recent: [], loading: false, error: null },
      lastHunt: null,
      leaderboardEndsAt: null,
      games: [],
      lastVisit: null,
    },
  },
};
