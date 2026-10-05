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

// The last finished hunt: its wins add up to its total, its best hit leads.
const LAST_HUNT = {
  id: 'h9',
  status: 'finished',
  totalWon: 412,
  pot: 600,
  currency: null,
  bonusCount: 9,
  startedAt: '2026-10-02T03:05:00Z',
  endedAt: '2026-10-02T06:40:00Z',
  bonuses: [
    { slot: 'Gates of Olympus 1000', bet: 0.4, win: 38.4, multiplier: 96 },
    { slot: 'Le Bandit', bet: 0.2, win: 17.6, multiplier: 88 },
    { slot: 'Sugar Rush 1000', bet: 0.2, win: 248, multiplier: 1240 },
    { slot: 'Big Bass Splash', bet: 0.4, win: 20.8, multiplier: 52 },
    { slot: "Groovin' Gems", bet: 0.3, win: 0, multiplier: 0 },
    { slot: 'Wanted Dead or a Wild', bet: 0.2, win: 62, multiplier: 310 },
    { slot: 'Hand of Anubis', bet: 0.3, win: 12.3, multiplier: 41 },
    { slot: 'Fire in the Hole 3', bet: 0.2, win: 6.8, multiplier: 34 },
    { slot: 'The Dog House Megaways', bet: 0.4, win: 6.1, multiplier: 15.25 },
  ],
};

// The overview's recent hunts, newest first (summaries carry no bonuses).
const RECENT = [
  { id: 'h9', status: 'finished', currency: null, endedAt: '2026-10-02T06:40:00Z', totalWon: 412, pot: 600 },
  { id: 'h8', status: 'finished', currency: null, endedAt: '2026-09-30T05:10:00Z', totalWon: 1130, pot: 800 },
  { id: 'h7', status: 'finished', currency: null, endedAt: '2026-09-28T04:55:00Z', totalWon: 518, pot: 700 },
  { id: 'h6', status: 'finished', currency: null, endedAt: '2026-09-26T06:20:00Z', totalWon: 1476, pot: 750 },
  { id: 'h5', status: 'finished', currency: null, endedAt: '2026-09-24T05:45:00Z', totalWon: 612, pot: 600 },
  { id: 'h4', status: 'finished', currency: null, endedAt: '2026-09-22T05:30:00Z', totalWon: 290, pot: 500 },
];

// The BEAN board's top five, handles masked upstream the way bean sends them.
const LEADERS = [
  { rank: 1, handle: 'Go***r', wagered: 1284310 },
  { rank: 2, handle: 'Be***n', wagered: 906452 },
  { rank: 3, handle: 'Sl***z', wagered: 512078 },
  { rank: 4, handle: 'Wi***7', wagered: 233940 },
  { rank: 5, handle: 'Lu***y', wagered: 118605 },
];

// A hunt 14 bonuses in at 25 cents a spin: $412 back on $600, Densho up next.
const LIVE_SLOTS = [
  'Sweet Bonanza 1000', 'Gates of Olympus 1000', 'Big Bass Splash', 'Le Bandit', 'Wanted Dead or a Wild', 'Hand of Anubis',
  'Fire in the Hole 3', 'The Dog House Megaways', 'Starlight Princess 1000', 'Zeus vs Hades', 'Mental 2', 'Rip City',
  'Chaos Crew 3', 'Sugar Rush 1000', 'Densho', 'Duel at Dawn', 'Toshi Video Club', 'Bloodthirst', 'Pray for Three',
  'Tombstone RIP', 'Fruit Party', 'Madame Destiny Megaways', 'Book of Time',
];
const LIVE_MULTIS = [48, 220, 0, 124, 32, 416, 88, 68, 0, 184, 36, 252, 84, 96];
const LIVE_HUNT = {
  id: 'h10',
  status: 'live',
  pot: 600,
  currency: null,
  bonusCount: LIVE_SLOTS.length,
  bonuses: LIVE_SLOTS.map((slot, i) =>
    i < LIVE_MULTIS.length
      ? { slot, bet: 0.25, win: LIVE_MULTIS[i] * 0.25, multiplier: LIVE_MULTIS[i] }
      : { slot, bet: 0.25, win: null, multiplier: null }
  ),
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
  hunts: { live: null, recent: RECENT, loading: false, error: null },
  round: null,
  lastHunt: LAST_HUNT,
  leaders: LEADERS,
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
  theme: null,
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
  halloween: { input: { ...BASE, theme: 'halloween' } },
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
      leaders: [],
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
      leaders: [],
      leaderboardEndsAt: null,
      games: [],
      lastVisit: null,
    },
  },
};
