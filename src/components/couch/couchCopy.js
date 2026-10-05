import { formatMultiplier } from '../../utils/huntFormat';
import { formatMoney, formatMoneyCompact } from '../../utils/money';
import { calendarDay } from '../../utils/scheduleTime';
import { formatUSD } from '../Leaderboard/format';

// Every sentence the couch says (spec: Sentences). Station-break voice: plain
// full sentences with live data in them, under PRODUCT.md's voice rules (no
// em dashes, no "X, not Y", sentence case). Each builder returns
// { kicker, teaser, sentence }: the label's mono kicker, its short teaser and
// the sentence it opens up to.

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// A head count, grouped like the nav's: "1,204".
const count = (n) => Number(n).toLocaleString('en-US');
const stop = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);
// A show title with more sentence after it drops its "!" ("Bonus Hunt Time!
// should be on" reads as two sentences).
const mid = (s) => s.replace(/!+$/, '');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clip = (s, max = 18) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const shortDay = (day) => (day === 'today' || day === 'tomorrow' ? day : day.slice(0, 3));
const onDay = (day) => (day === 'today' || day === 'tomorrow' ? day : `on ${day}`);

// "1 day 1 hour", "3 hours 5 minutes", "12 minutes", "under a minute".
export function untilWords(ms) {
  const total = Math.floor(ms / 60000);
  if (total < 1) return 'under a minute';
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (d) return h ? `${plural(d, 'day')} ${plural(h, 'hour')}` : plural(d, 'day');
  if (h) return m ? `${plural(h, 'hour')} ${plural(m, 'minute')}` : plural(h, 'hour');
  return plural(m, 'minute');
}

// "3d 4h", "5h 12m", "12m": label-sized.
export function shortUntil(ms) {
  const total = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${total % 60}m`;
  return `${total % 60}m`;
}

// A stream's length: "4 hours 37", "2 hours", "52 minutes".
export function lengthWords(seconds) {
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return plural(m, 'minute');
  return m ? `${plural(h, 'hour')} ${m}` : plural(h, 'hour');
}

// A listing's day, from dayWord: "Today", "Tomorrow", "Mon".
export const listingDay = (day) => cap(shortDay(day));

// The day a moment falls on, on the viewer's calendar: "today", "tomorrow",
// "yesterday" or the weekday.
export function dayWord(ms, now, timeZone) {
  const diff = calendarDay(ms, timeZone) - calendarDay(now, timeZone);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(ms);
}

// "night" from 6 PM to 5 AM, "afternoon" from noon, otherwise "morning".
export function partOfDay(ms, timeZone) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(ms));
  if (hour >= 18 || hour < 5) return 'night';
  return hour >= 12 ? 'afternoon' : 'morning';
}

// When a stream aired: "Tonight", "Last night", "Yesterday afternoon", "Thursday night".
export function whenAired(ms, now, timeZone) {
  const day = dayWord(ms, now, timeZone);
  const part = partOfDay(ms, timeZone);
  if (day === 'today') return part === 'night' ? 'Tonight' : `This ${part}`;
  if (day === 'yesterday') return part === 'night' ? 'Last night' : `Yesterday ${part}`;
  return `${cap(day)} ${part}`;
}

export const money = (value, currency) => formatMoney(value, currency || null, { decimals: 0 });

// Screen-sized money: whole units, and a big figure (an ARS hunt) compact.
export const shortMoney = (value, currency) =>
  Math.abs(value) >= 100000 ? formatMoneyCompact(value, currency || null) : money(value, currency);

// A spin's bet: cents under ten, whole units above.
export const betMoney = (value, currency) => formatMoney(value, currency || null, { decimals: Math.abs(value) < 10 ? 2 : 0 });

// A leaderboard wager, formatted the way the leaderboard page does.
export const wager = (value) => formatUSD(value);

// A hit's multiplier the way the Hunts tab prints it (formatMultiplier: "96.0x",
// "1240x"). Nothing to print is null, never the Hunts tab's dash, so no
// sentence on the couch carries one.
export function multiplier(x) {
  if (x == null || x === '' || !Number.isFinite(Number(x))) return null;
  return formatMultiplier(x);
}

export const COPY = {
  tvWaiting: () => ({ kicker: 'TV', teaser: 'Tuning in', sentence: "Checking whether Goofer's on." }),
  tvLive: ({ viewers }) => ({
    kicker: 'TV',
    teaser: viewers != null ? `On now · ${count(viewers)}` : 'On now',
    sentence: `Goofer's live right now.${viewers != null ? ` ${count(viewers)} watching.` : ''} Lean in to watch.`,
  }),
  tvNext: ({ title, day, clock }) => ({
    kicker: 'TV',
    teaser: `Back ${shortDay(day)} ${clock}`,
    sentence: `Off the air. Back ${day} at ${clock} for ${stop(title)}`,
  }),
  tvDay: ({ title, day }) => ({ kicker: 'TV', teaser: `Back ${shortDay(day)}`, sentence: `Off the air. Back ${day} for ${stop(title)}` }),
  tvLate: ({ title }) => ({ kicker: 'TV', teaser: 'Running late', sentence: `${mid(title)} should be on by now. Give him a minute.` }),
  tvNothing: () => ({ kicker: 'TV', teaser: 'Off air', sentence: 'Off the air. Nothing on the books yet.' }),

  noteOpen: ({ keyword, prize }) => ({
    kicker: 'Note',
    teaser: `Type ${keyword}`,
    sentence: `Giveaway's open. Type ${keyword} in chat${prize ? ` for a ${prize}` : ''}.`,
  }),

  laptopHunt: ({ opened, total, back, currency }) => ({
    kicker: 'Laptop',
    teaser: total ? `Hunt ${opened}/${total}` : 'Hunt live',
    sentence: total
      ? `A hunt is running. ${opened} of ${plural(total, 'bonus', 'bonuses')} opened, ${money(back, currency)} back so far.`
      : 'A hunt is running.',
  }),
  laptopOpen: ({ guesses }) => ({
    kicker: 'Laptop',
    teaser: 'Predictions open',
    sentence: `Predictions are open. ${guesses ? `${plural(guesses, 'guess', 'guesses')} in so far. ` : ''}Guess the payout before it locks.`,
  }),
  laptopLocked: () => ({ kicker: 'Laptop', teaser: 'Predictions locked', sentence: 'Predictions are locked. The hunt decides it now.' }),
  laptopLastHunt: ({ paid, start, currency, best }) => ({
    kicker: 'Laptop',
    teaser: best ? `Best hit ${multiplier(best.multi)}` : 'Last hunt',
    sentence: `Last hunt paid ${money(paid, currency)}${start ? ` on ${money(start, currency)}` : ''}.${
      best ? ` Best hit: ${multiplier(best.multi)} on ${best.slot}.` : ''
    }`,
  }),
  laptopIdle: ({ resetsIn }) => ({
    kicker: 'Laptop',
    teaser: resetsIn ? `Resets in ${shortUntil(resetsIn)}` : 'Gamba',
    sentence: resetsIn ? `The leaderboard resets in ${untilWords(resetsIn)}.` : 'The gamba tools live here.',
  }),
  laptopBoard: ({ leader, resetsIn }) => ({
    kicker: 'Laptop',
    teaser: 'BEAN board',
    sentence: `${leader.handle || 'The leader'} leads the BEAN board with ${wager(leader.wagered)} wagered.${
      resetsIn ? ` It resets in ${untilWords(resetsIn)}.` : ''
    }`,
  }),
  laptopHistory: ({ count, paidBack, latest }) => ({
    kicker: 'Laptop',
    teaser: `Last ${count} hunts`,
    sentence: `${paidBack || 'None'} of the last ${count} hunts paid back their cost. The latest paid back ${latest}%.`,
  }),

  tapes: ({ title, when, length }) => ({
    kicker: 'Tapes',
    teaser: clip(title, 22),
    sentence: `You missed ${stop(title)} ${when}${length ? `, ${length}` : ''}.`,
  }),
  tapesNone: () => ({ kicker: 'Tapes', teaser: 'Nothing new', sentence: 'No tapes yet. Check back after the next stream.' }),

  guide: ({ title, day, clock, until }) => ({
    kicker: 'TV guide',
    teaser: `${cap(shortDay(day))} ${clock}`,
    sentence: `Next up: ${title} ${onDay(day)} at ${clock}, in ${until}.`,
  }),
  guideDay: ({ title, day }) => ({ kicker: 'TV guide', teaser: cap(shortDay(day)), sentence: `Next up: ${title} ${onDay(day)}.` }),
  guideLate: ({ title }) => ({ kicker: 'TV guide', teaser: 'Running late', sentence: `Next up: ${mid(title)}, due now.` }),
  guideLoading: () => ({ kicker: 'TV guide', teaser: 'Tuning in', sentence: 'Checking the guide.' }),
  guideNone: () => ({ kicker: 'TV guide', teaser: 'This week', sentence: 'Nothing on the books yet. The guide has the week.' }),

  games: ({ name, hours, category }) => ({
    kicker: 'Games',
    teaser: hours ? `${clip(name)} · ${hours}h` : clip(name),
    sentence: `Lately: ${name}${hours ? `, ${plural(hours, 'hour')} in two weeks` : ''}.${category ? ` Last streamed: ${stop(category)}` : ''}`,
  }),
  gamesNone: ({ category }) => ({
    kicker: 'Games',
    teaser: 'Gaming',
    sentence: `His game library and the wheel.${category ? ` Last streamed: ${stop(category)}` : ''}`,
  }),

  remote: () => ({ kicker: 'Remote', teaser: 'GSN', sentence: 'Flip to the Goofer Shopping Network. Spend your tickets.' }),
  photo: () => ({ kicker: 'Photo', teaser: 'The host', sentence: 'Who is this guy?' }),
};
