import { SOCIAL_LINKS } from '../../constants';
import { formatClock, upNext } from '../../utils/scheduleTime';
import { huntFeature } from '../gamba/guide';
import { huntMode, huntStats } from '../hunts/huntStats';
import { showTitle } from '../schedule/scheduleModel';
import { cleanTitle, parseDuration } from '../vods/videoStoreModel';
import { COPY, dayWord, lengthWords, untilWords, whenAired } from './couchCopy';
import { ROOM } from './couchLayout';
import { THEMES, isTheme } from './themes';

// The couch's state from one plain input (spec: Model). Pure.
//
// input: { now, timeZone, statusReady, isLive,
//   stream: { title, viewers, game, thumbnailUrl } | null,
//   schedule: array | null (null while loading), videos, clips, category,
//   hunts: { live, recent, loading, error }, round, lastHunt (with bonuses),
//   leaderboardEndsAt, giveaway: { keyword, prize, status } | null,
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

export function laptopState({ hunts, round, lastHunt, leaderboardEndsAt, now }) {
  const feature = huntFeature({ hunts, round });
  if (feature.kind === 'live' && feature.hunt) {
    const s = feature.stats;
    // Money builders get real numbers only (a missing one would print an em dash).
    return { mode: 'hunt', opened: s.openedCount, total: s.bonusCount, back: s.wonSoFar ?? 0, currency: feature.currency };
  }
  const mode = huntMode(round);
  if (mode === 'open' || mode === 'locked') return { mode, guesses: feature.guessCount };
  const resetsIn = leaderboardEndsAt != null && leaderboardEndsAt > now ? leaderboardEndsAt - now : null;
  const last = lastHunt && Number.isFinite(Number(lastHunt.totalWon))
    ? { paid: lastHunt.totalWon, start: lastHunt.pot, currency: lastHunt.currency || null, best: bestHit(lastHunt) }
    : null;
  return { mode: 'idle', resetsIn, last };
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
      label: `${kicker}: ${copy[id].sentence} Opens ${destination}.`,
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

  return {
    theme,
    tv: {
      state,
      preview: state === 'live' ? preview(input.stream, input.now) : null,
      viewers: input.stream ? input.stream.viewers : null,
      cards,
    },
    laptop,
    giveaway,
    covers,
    doors,
  };
}
