import { SOCIAL_LINKS } from '../../constants';
import { formatClock, upNext } from '../../utils/scheduleTime';
import { huntFeature } from '../gamba/guide';
import { huntMode, huntStats, isOpened } from '../hunts/huntStats';
import { toDate } from '../hunts/huntTime';
import { showTitle } from '../schedule/scheduleModel';
import { cleanTitle, parseDuration } from '../vods/videoStoreModel';
import { COMMERCIALS, commercials } from './commercials';
import { COPY, dayWord, lengthWords, listingDay, untilWords, whenAired } from './couchCopy';
import { ROOM } from './couchLayout';
import { THEMES, isTheme } from './themes';

// The couch's state from one plain input (spec: Model). Pure.
//
// input: { now, timeZone, statusReady, isLive,
//   stream: { title, viewers, game, thumbnailUrl } | null,
//   schedule: array | null (null while loading), videos, clips, category,
//   hunts: { live, recent, loading, error }, round, lastHunt (with bonuses),
//   leaders: [{ rank, handle, wagered }] (the board's top five, handles as
//   masked upstream), leaderboardEndsAt, giveaway: { keyword, prize, status } | null,
//   games: [{ appid, name, playtime_2weeks }] | null,
//   theme: id | null (a seasonal theme, see themes.js),
//   lastVisit: ms | null (first visit) | undefined (storage unreadable), reel }

export const DOOR_ORDER = ['tv', 'note', 'laptop', 'tapes', 'guide', 'games', 'remote', 'photo'];
export const DESTINATION = {
  tv: 'Vods',
  note: 'Giveaway',
  laptop: 'Gamba',
  tapes: 'Vods',
  guide: 'Schedule',
  games: 'Gaming',
  remote: 'Store',
  photo: 'About',
};
// How the camera cuts through a door (Ruling R23): screens cut to static,
// things (the photo, the TV guide, the game cases) close a cartoon iris.
export const DOOR_CUT = { guide: 'iris', games: 'iris', photo: 'iris' };
const NEW_TAPE_MS = 72 * 3600000;
const POLL_MS = 120000;
const STEAM_COVER = (appid) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;

export function tvState({ statusReady, isLive }) {
  if (isLive) return 'live';
  return statusReady ? 'offair' : 'waiting';
}

export const latestFinished = (hunts) =>
  ((hunts && hunts.recent) || []).find((h) => h && h.status !== 'live') || null;

function bestHit(hunt) {
  if (!hunt || !Array.isArray(hunt.bonuses)) return null;
  const s = huntStats(hunt, null);
  const b = s.bestIndex >= 0 ? s.bonuses[s.bestIndex] : null;
  return b ? { multi: Number(b.multiplier), slot: b.slot || 'a slot' } : null;
}

// The laptop (spec: The laptop; Task 22d). A live hunt or an open or locked
// round takes the screen over; otherwise it is a little desktop cycling
// windows, each with its own door. The screen gets plain numbers and strings,
// and money builders get real numbers only (a missing one would print an em dash).
const BOARD_ROWS = 5;
const HISTORY_HUNTS = 5;
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const slotName = (b) => b.slot || 'A slot';
const multiOf = (b) => num(b.multiplier) ?? (num(b.bet) > 0 && num(b.win) != null ? num(b.win) / num(b.bet) : null);
const doorCopy = ({ teaser, sentence }, destination) => ({ teaser, sentence, destination });

function huntTracker(feature) {
  const s = feature.stats;
  const next = s.nextIndex >= 0 ? s.bonuses[s.nextIndex] : null;
  return {
    mode: 'hunt',
    opened: s.openedCount,
    total: s.bonusCount,
    back: s.wonSoFar ?? 0,
    cost: s.startCost,
    currency: feature.currency,
    next: next ? { slot: slotName(next), bet: num(next.bet) } : null,
    // Opened in running order, so the newest is the last one opened.
    recent: s.bonuses.filter(isOpened).slice(-3).reverse().map((b) => ({ slot: slotName(b), multi: multiOf(b) })),
  };
}

function boardWindow(leaders, resetsIn) {
  const rows = (Array.isArray(leaders) ? leaders : [])
    .filter(Boolean)
    .slice(0, BOARD_ROWS)
    .map((p, i) => ({ rank: p.rank || i + 1, handle: p.handle || '', wagered: num(p.wagered) ?? 0 }));
  if (!rows.length) return null;
  return {
    id: 'leaderboard',
    href: '/gamba/leaderboard',
    title: 'BEAN board',
    rows,
    resetsIn,
    ...doorCopy(COPY.laptopBoard({ leader: rows[0], resetsIn }), 'Leaderboard'),
  };
}

// The hunt's day on the viewer's calendar: "Oct 1".
function huntDay(hunt, timeZone) {
  const d = toDate(hunt.endedAt || hunt.startedAt);
  return d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone }).format(d) : null;
}

function recapWindow(hunt, timeZone) {
  const s = huntStats(hunt, null);
  if (s.won == null) return null;
  const currency = hunt.currency || null;
  const best = bestHit(hunt);
  const day = huntDay(hunt, timeZone);
  const top = s.bonuses
    .filter(isOpened)
    .map((b) => ({ slot: slotName(b), bet: num(b.bet), multi: num(b.multiplier) }))
    .filter((b) => b.multi != null)
    .sort((a, b) => b.multi - a.multi)
    .slice(0, 3);
  return {
    id: 'recap',
    href: '/gamba/hunts',
    title: day ? `Hunt · ${day}` : 'Last hunt',
    start: s.startCost,
    won: s.won,
    result: s.result,
    currency,
    best,
    top,
    ...doorCopy(COPY.laptopLastHunt({ paid: s.won, start: s.startCost, currency, best }), 'Hunts'),
  };
}

// The return of the last few finished hunts, oldest first, scaled so the
// tallest fills the chart (between 150% and 300%, taller ones clip).
function historyWindow(hunts) {
  const done = ((hunts && hunts.recent) || [])
    .filter((h) => h && h.status !== 'live')
    .map((h) => ({ id: h.id, s: huntStats(h, null) }))
    .filter(({ s }) => s.won != null && s.startCost != null)
    .slice(0, HISTORY_HUNTS)
    .reverse();
  if (done.length < 2) return null;
  const ratios = done.map(({ s }) => (s.won / s.startCost) * 100);
  const ceiling = Math.min(300, Math.max(150, ...ratios));
  const bars = done.map(({ id }, i) => ({
    id,
    pct: Math.round(ratios[i]),
    up: ratios[i] >= 100,
    height: Math.min(ratios[i], ceiling) / ceiling,
  }));
  const latest = bars[bars.length - 1];
  return {
    id: 'history',
    href: '/gamba/hunts',
    title: `Last ${bars.length} hunts`,
    bars,
    latest: latest.pct,
    up: latest.up,
    line: 100 / ceiling,
    ...doorCopy(COPY.laptopHistory({ count: bars.length, paidBack: bars.filter((b) => b.up).length, latest: latest.pct }), 'Hunts'),
  };
}

const screensaverWindow = (resetsIn) => ({
  id: 'screensaver',
  href: '/gamba',
  title: 'Screensaver',
  resetsIn,
  ...doorCopy(COPY.laptopIdle({ resetsIn }), 'Gamba'),
});

export function laptopState({ hunts, round, lastHunt, leaders, leaderboardEndsAt, now, timeZone }) {
  const feature = huntFeature({ hunts, round });
  if (feature.kind === 'live' && feature.hunt) return huntTracker(feature);
  const mode = huntMode(round);
  if (mode === 'open' || mode === 'locked') return { mode, guesses: feature.guessCount };
  const resetsIn = leaderboardEndsAt != null && leaderboardEndsAt > now ? leaderboardEndsAt - now : null;
  const recap = lastHunt ? recapWindow(lastHunt, timeZone) : null;
  const last = recap ? { paid: recap.won, start: recap.start, currency: recap.currency, best: recap.best } : null;
  const windows = [boardWindow(leaders, resetsIn), recap, historyWindow(hunts), screensaverWindow(resetsIn)].filter(Boolean);
  return { mode: 'idle', resetsIn, last, windows };
}

export function isNewTape(vod, lastVisit, now) {
  const aired = vod ? Date.parse(vod.created_at) : NaN;
  if (!Number.isFinite(aired) || lastVisit === undefined) return false;
  if (lastVisit === null) return now - aired <= NEW_TAPE_MS;
  return aired > lastVisit;
}

export function steamCovers(games) {
  return (Array.isArray(games) ? games : [])
    .filter((g) => g && g.appid)
    .slice(0, 3)
    .map((g) => ({
      appid: g.appid,
      name: g.name,
      hours: Math.max(0, Math.floor(g.playtime_2weeks || 0)),
      cover: STEAM_COVER(g.appid),
    }));
}

function tvCopy(state, input, next, show) {
  if (state === 'waiting') return COPY.tvWaiting();
  if (state === 'live') return COPY.tvLive({ viewers: input.stream ? input.stream.viewers : null });
  if (!next) return COPY.tvNothing();
  if (next.phase === 'late') return COPY.tvLate({ title: show });
  const day = dayWord(next.start.getTime(), input.now, input.timeZone);
  if (!next.timeKnown) return COPY.tvDay({ title: show, day });
  return COPY.tvNext({ title: show, day, clock: formatClock(next.start, input.timeZone) });
}

function guideCopy(input, next, show) {
  if (input.schedule == null) return COPY.guideLoading();
  if (!next) return COPY.guideNone();
  if (next.phase === 'late') return COPY.guideLate({ title: show });
  const day = dayWord(next.start.getTime(), input.now, input.timeZone);
  if (!next.timeKnown) return COPY.guideDay({ title: show, day });
  return COPY.guide({
    title: show,
    day,
    clock: formatClock(next.start, input.timeZone),
    until: untilWords(next.start.getTime() - input.now),
  });
}

function laptopCopy(laptop) {
  if (laptop.mode === 'hunt') return COPY.laptopHunt(laptop);
  if (laptop.mode === 'open') return COPY.laptopOpen(laptop);
  if (laptop.mode === 'locked') return COPY.laptopLocked();
  if (laptop.last) return COPY.laptopLastHunt(laptop.last);
  return COPY.laptopIdle(laptop);
}

function tapesCopy(vod, input) {
  if (!vod) return COPY.tapesNone();
  const seconds = parseDuration(vod.duration);
  return COPY.tapes({
    title: cleanTitle(vod.title),
    when: whenAired(Date.parse(vod.created_at), input.now, input.timeZone),
    length: seconds ? lengthWords(seconds) : null,
  });
}

// The next `count` shows for the Goofer Guide commercial, soonest first, on
// the viewer's calendar and clock (the TV's "Back tomorrow" card reads the same
// way): [{ day, time, show }]. A time that doesn't read is listed as typed.
export function guideListings(schedule, now, timeZone, count = 3) {
  const out = [];
  let rest = Array.isArray(schedule) ? schedule.filter(Boolean) : [];
  while (out.length < count) {
    const next = upNext(rest, now);
    if (!next) break;
    rest = rest.filter((e) => e !== next.entry);
    out.push({
      day: listingDay(dayWord(next.start.getTime(), now, timeZone)),
      time: next.timeKnown ? formatClock(next.start, timeZone) : (next.entry.time || '').trim() || 'Time TBA',
      show: showTitle(next.entry).title || 'Stream',
    });
  }
  return out;
}

export const doorLabel = (kicker, sentence, destination) => `${kicker}: ${sentence} Opens ${destination}.`;

// A screen's door follows what the screen shows ({ href, teaser, sentence,
// destination }): the TV's commercial, the laptop's window. Everything else
// is the couch as built.
function followScreen(couch, id, shows) {
  return {
    ...couch,
    doors: couch.doors.map((d) =>
      d.id === id
        ? {
            ...d,
            href: shows.href,
            teaser: shows.teaser,
            sentence: shows.sentence,
            destination: shows.destination,
            label: doorLabel(d.kicker, shows.sentence, shows.destination),
          }
        : d
    ),
  };
}

// While a commercial is on the TV (off air), the TV door goes to its channel
// and says so.
export function withCommercial(couch, adId) {
  const ad = COMMERCIALS[adId];
  if (!ad || couch.tv.state !== 'offair') return couch;
  return followScreen(couch, 'tv', ad);
}

// While a window is up on the laptop's desktop, the laptop door goes where
// that window points and says so. A live hunt or a round has no windows.
export function withLaptopWindow(couch, windowId) {
  const win = couch.laptop.mode === 'idle' && windowId ? (couch.laptop.windows || []).find((w) => w.id === windowId) : null;
  return win ? followScreen(couch, 'laptop', win) : couch;
}

function preview(stream, now) {
  if (!stream || !stream.thumbnailUrl) return null;
  const url = stream.thumbnailUrl.replace('{width}', '640').replace('{height}', '360');
  return `${url}?p=${Math.floor(now / POLL_MS)}`;
}

export function buildCouch(input) {
  const state = tvState(input);
  const next = Array.isArray(input.schedule) ? upNext(input.schedule, input.now) : null;
  const show = next ? showTitle(next.entry).title || 'the next stream' : null;
  const newest = (input.videos || [])[0] || null;
  const laptop = laptopState(input);
  const covers = steamCovers(input.games);
  const giveaway =
    input.giveaway && input.giveaway.status === 'open' && input.giveaway.keyword ? input.giveaway : null;

  const copy = {
    tv: tvCopy(state, input, next, show),
    note: giveaway ? COPY.noteOpen({ keyword: giveaway.keyword, prize: giveaway.prize }) : null,
    laptop: laptopCopy(laptop),
    tapes: tapesCopy(newest, input),
    guide: guideCopy(input, next, show),
    games: covers.length ? COPY.games({ ...covers[0], category: input.category }) : COPY.gamesNone({ category: input.category }),
    remote: COPY.remote(),
    photo: COPY.photo(),
  };
  const href = {
    tv: state === 'live' ? SOCIAL_LINKS.twitch : '/vods',
    note: '/giveaway',
    laptop: laptop.mode === 'idle' ? '/gamba' : '/gamba/hunts',
    tapes: '/vods',
    guide: '/schedule',
    games: '/gaming',
    remote: '/store',
    photo: '/about',
  };

  const doors = DOOR_ORDER.filter((id) => copy[id]).map((id) => {
    const destination = id === 'tv' && state === 'live' ? 'the stream' : DESTINATION[id];
    // The room names its objects ("Tapes" in the 90s room); COPY's kicker is the fallback.
    const kicker = (ROOM.names && ROOM.names[id]) || copy[id].kicker;
    return {
      id,
      href: href[id],
      ...copy[id],
      kicker,
      destination,
      cut: DOOR_CUT[id] || 'static',
      label: doorLabel(kicker, copy[id].sentence, destination),
      lit: (id === 'tv' && state === 'live') || (id === 'laptop' && laptop.mode !== 'idle') || id === 'note',
      sticker: id === 'tapes' && isNewTape(newest, input.lastVisit, input.now) ? 'new' : null,
    };
  });

  const theme = isTheme(input.theme) ? input.theme : null;
  const cards =
    state === 'offair'
      ? [
          ...(theme ? THEMES[theme].cards : []),
          { kicker: 'Off air', text: copy.tv.sentence },
          { kicker: 'Tapes', text: copy.tapes.sentence },
          { kicker: 'Laptop', text: copy.laptop.sentence },
        ]
      : [];
  // Commercials run off air only; live, the TV shows the stream.
  const ads = state === 'offair' ? commercials({ listings: guideListings(input.schedule, input.now, input.timeZone) }) : [];

  return {
    theme,
    tv: {
      state,
      preview: state === 'live' ? preview(input.stream, input.now) : null,
      viewers: input.stream ? input.stream.viewers : null,
      cards,
      ads,
    },
    laptop,
    giveaway,
    covers,
    doors,
  };
}
