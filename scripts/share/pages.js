// Pages that get their own link-preview card (Discord, X, iMessage, Slack).
// write-pages.js stamps each one's og:/twitter: tags into build/<path>/index.html,
// and each needs a screenshot at public/share/<id>.jpg (npm run share:shots).
// Adding a page: list it here, add its vercel.json rewrite above the catch-all,
// then shoot it. Removing or renaming one: remove or rename its rewrite too
// (the build fails on a mismatch). Unlisted routes get the home card.
// settleMs / waitFor are capture hints for shoot.js.
const SHARE_PAGES = [
  {
    id: 'home',
    path: '/',
    title: 'GooferG',
    description: 'Late-night variety streams, bonus hunts, clips and more.',
  },
  {
    id: 'schedule',
    path: '/schedule',
    title: 'Schedule · GooferG',
    description: "When the tube's on. The weekly stream schedule.",
  },
  {
    id: 'vods',
    path: '/vods',
    title: 'Vods · GooferG',
    description: 'Goofer Video. Every stream from the last 60 days on the shelf, and the clips chat kept.',
  },
  {
    id: 'about',
    path: '/about',
    title: 'About · GooferG',
    description: "Who's behind the glasses.",
  },
  {
    id: 'gaming',
    path: '/gaming',
    title: 'Gaming · GooferG',
    description: "What's being played and what's in the library.",
  },
  {
    id: 'gear',
    path: '/gear',
    title: 'Gear · GooferG',
    description: 'The setup: every piece of kit you see on stream.',
  },
  {
    id: 'gamba',
    path: '/gamba',
    title: 'Gamba · GooferG',
    description: 'Leaderboard, bonus hunts, battles and the slot picker. Pick a channel.',
  },
  {
    id: 'leaderboard',
    path: '/gamba/leaderboard',
    title: 'Leaderboard · GooferG',
    description: 'Live wager race standings for code BEAN on Rainbet.',
    settleMs: 4000,
  },
  {
    id: 'hunts',
    path: '/gamba/hunts',
    title: 'Hunts · GooferG',
    description: 'Live bonus hunts and the prediction round. Call the total.',
    settleMs: 4000,
  },
  {
    id: 'bonus-battle',
    path: '/gamba/bonus-battle',
    title: 'Bonus Battle · GooferG',
    description: 'Bonus buys, head to head.',
  },
  {
    id: 'wheel',
    path: '/gamba/wheel',
    title: 'Slot Picker · GooferG',
    description: "Can't pick a slot? Spin for one.",
    settleMs: 10000,
  },
  {
    id: 'store',
    path: '/store',
    title: 'Store · GooferG',
    description: 'Spend your watch-time tickets.',
  },
  {
    id: 'giveaway',
    path: '/giveaway',
    title: 'Giveaway · GooferG',
    description: 'Live giveaways. Type the keyword in chat to enter.',
  },
  {
    id: 'suggest',
    path: '/suggest',
    title: 'Suggest · GooferG',
    description: 'Pitch a game or slot for the stream.',
  },
];

module.exports = { SHARE_PAGES };
