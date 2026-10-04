import { calendarDay } from '../../utils/scheduleTime';

// Goofer Video's floor, worked out from raw Helix data (DESIGN.md §7, Video
// store). Pure: VideoStoreFront renders what buildStore returns.

// Twitch keeps past broadcasts this long on GooferG's tier (the oldest VOD was
// 48 days old on 2026-10-04).
export const ARCHIVE_DAYS = 60;
const DAY_MS = 86400000;
const HOUR = 3600;
// Every stream title ends in a 💥 tail of links; labels cut it.
const TAIL_MARK = '💥';

const pad = (n) => String(n).padStart(2, '0');
const clamp01 = (n) => Math.min(1, Math.max(0, n));

const formats = new Map();
function format(ms, timeZone, options) {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  if (!formats.has(key)) formats.set(key, new Intl.DateTimeFormat('en-US', { timeZone, ...options }));
  return formats.get(key).format(new Date(ms));
}
const shortDate = (ms, tz) => format(ms, tz, { month: 'short', day: 'numeric' });
const longDate = (ms, tz) => format(ms, tz, { weekday: 'short', month: 'short', day: 'numeric' });
const fullDate = (ms, tz) => format(ms, tz, { month: 'short', day: 'numeric', year: 'numeric' });

// Helix lengths: '4h37m20s', '12m10s', '45s'.
export function parseDuration(text) {
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(String(text || ''));
  if (!m) return 0;
  return (Number(m[1]) || 0) * HOUR + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
}

// 4:37:20, 12:10, 0:30.
export function formatLength(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / HOUR);
  const m = Math.floor((s % HOUR) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// The tape counter always shows hours: 0:00:00, 3:57:20.
export function formatCounter(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / HOUR)}:${pad(Math.floor((s % HOUR) / 60))}:${pad(s % 60)}`;
}

// The Twitch player's start time: 3h57m20s.
export function toTwitchTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / HOUR)}h${Math.floor((s % HOUR) / 60)}m${s % 60}s`;
}

// Counts on signs and the sign-off: 027.
export const padCount = (n) => String(n).padStart(3, '0');

export function formatViews(n) {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v);
}

// "Win Wednesdays 💥 Games and Gamba? 💥communityhunts.gg / …" → "Win Wednesdays".
// "[EN/PT-BR] Zed Aint Dead.  🔥 | !trees | …" → "Zed Aint Dead. 🔥".
export function cleanTitle(raw, fallback = 'Untitled stream') {
  let t = String(raw || '').replace(/^\s*\[[^\]]*\]\s*/, '');
  const cut = t.search(/💥| \| /);
  if (cut >= 0) t = t.slice(0, cut);
  t = t.replace(/\s+/g, ' ').replace(/[\s|·:-]+$/, '').trim();
  return t || fallback;
}

// The VHS tape a stream this long needs: a T-120 holds 2h SP, 4h LP or 6h EP;
// a T-160 holds 8h EP.
export function tapeStock(seconds) {
  if (seconds <= 2 * HOUR) return 'T-120 · SP';
  if (seconds <= 4 * HOUR) return 'T-120 · LP';
  if (seconds <= 6 * HOUR) return 'T-120 · EP';
  if (seconds <= 8 * HOUR) return 'T-160 · EP';
  return 'T-160 · EP ×2';
}

// The last 4 digits of the VOD id: stable while older tapes expire around it.
export function catalogueNo(id) {
  return String(id).slice(-4);
}

// The cover at width×height (440×248 on the shelf), or null for a VOD with no
// picture yet (an empty URL, or Twitch's /_404/ processing image).
export function coverUrl(video, width = 440, height = 248) {
  const url = video && video.thumbnail_url;
  if (!url || url.includes('/_404/')) return null;
  return url.replace('%{width}', String(width)).replace('%{height}', String(height));
}

// When Twitch deletes the VOD, in calendar days on the viewer's clock.
export function dueBack(createdAt, now, timeZone) {
  const date = Date.parse(createdAt) + ARCHIVE_DAYS * DAY_MS;
  return { date, daysLeft: Math.max(0, calendarDay(date, timeZone) - calendarDay(now, timeZone)) };
}

// A clip nobody named carries its stream's title: the 💥 tail, or the VOD's
// title exactly.
export function isUnlabeled(rawClipTitle, rawVodTitle) {
  const t = String(rawClipTitle || '');
  return t.includes(TAIL_MARK) || (!!rawVodTitle && t === rawVodTitle);
}

// App falls back to the raw game id (or 'Various') when Helix has no name.
export function aisleName(gameName) {
  const name = String(gameName || '').trim();
  return !name || name === 'Various' || /^\d+$/.test(name) ? 'Misc.' : name;
}

export function pickedBy(clip, viewerName) {
  const you = !!viewerName && clip.picker.toLowerCase() === String(viewerName).toLowerCase();
  return { you, text: you ? 'Picked by you' : `Picked by ${clip.picker}` };
}

export function playerSrc(item, at, host) {
  if (item.kind === 'clip') {
    return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(item.id)}&parent=${host}&autoplay=true`;
  }
  const time = at != null ? `&time=${toTwitchTime(at)}` : '';
  return `https://player.twitch.tv/?video=${encodeURIComponent(item.id)}&parent=${host}&autoplay=true${time}`;
}

// The Monday starting the week a calendarDay falls in (day 0, 1970-01-01, was a Thursday).
const mondayOf = (day) => day - ((((day + 3) % 7) + 7) % 7);

function weekLabel(monday, thisMonday) {
  if (monday === thisMonday) return 'This week';
  if (monday === thisMonday - 7) return 'Last week';
  const a = monday * DAY_MS;
  const b = (monday + 6) * DAY_MS;
  const month = (ms) => format(ms, 'UTC', { month: 'short' });
  const day = (ms) => format(ms, 'UTC', { day: 'numeric' });
  return month(a) === month(b) ? `${month(a)} ${day(a)}–${day(b)}` : `${month(a)} ${day(a)}–${month(b)} ${day(b)}`;
}

// One shelf per Monday-to-Sunday week on the viewer's calendar, newest first.
export function weekShelves(tapes, now, timeZone) {
  const thisMonday = mondayOf(calendarDay(now, timeZone));
  const weeks = new Map();
  for (const tape of tapes) {
    const monday = mondayOf(calendarDay(tape.createdMs, timeZone));
    if (!weeks.has(monday)) weeks.set(monday, []);
    weeks.get(monday).push(tape);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => b - a)
    .map(([monday, list]) => ({
      key: `week-${monday}`,
      label: weekLabel(monday, thisMonday),
      tapes: [...list].sort((x, y) => y.createdMs - x.createdMs),
    }));
}

function toTape(video, now, timeZone) {
  const seconds = parseDuration(video.duration);
  const createdMs = Date.parse(video.created_at);
  const due = dueBack(video.created_at, now, timeZone);
  return {
    kind: 'vod',
    id: String(video.id),
    rawTitle: video.title || '',
    // Set on the broadcast still recording while Goofer is live.
    streamId: video.stream_id ? String(video.stream_id) : null,
    title: cleanTitle(video.title),
    no: catalogueNo(video.id),
    createdMs,
    weekday: format(createdMs, timeZone, { weekday: 'short' }).toUpperCase(),
    dateLabel: longDate(createdMs, timeZone),
    seconds,
    length: formatLength(seconds),
    stock: tapeStock(seconds),
    views: formatViews(video.view_count),
    cover: coverUrl(video),
    wideCover: coverUrl(video, 1280, 720),
    url: video.url,
    daysLeft: due.daysLeft,
    dueDate: due.daysLeft === 0 ? 'Today' : shortDate(due.date, timeZone),
    dueLabel: due.daysLeft === 0 ? 'Due back today' : `Due back ${shortDate(due.date, timeZone)}`,
    muted:
      seconds > 0
        ? (video.muted_segments || []).map((m) => ({
            start: clamp01(m.offset / seconds),
            width: clamp01(m.duration / seconds),
            from: formatCounter(m.offset),
            to: formatCounter(m.offset + m.duration),
          }))
        : [],
    marks: [],
    stickers: [],
  };
}

function toClip(clip, tapesById, timeZone) {
  const createdMs = Date.parse(clip.created_at);
  const seconds = Math.round(Number(clip.duration) || 0);
  const offset = Number.isFinite(clip.vod_offset) ? clip.vod_offset : null;
  const tape = clip.video_id ? tapesById.get(String(clip.video_id)) : null;
  const unlabeled = isUnlabeled(clip.title, tape && tape.rawTitle);
  const label = unlabeled
    ? `No label · ${offset != null ? `at ${formatCounter(offset)}` : shortDate(createdMs, timeZone)}`
    : cleanTitle(clip.title, 'Untitled clip');
  return {
    kind: 'clip',
    id: String(clip.id),
    label,
    unlabeled,
    picker: clip.creator_name || 'someone in chat',
    createdMs,
    dateLabel: fullDate(createdMs, timeZone),
    year: `© ${format(createdMs, timeZone, { year: 'numeric' })}`,
    seconds,
    length: formatLength(seconds),
    views: formatViews(clip.view_count),
    viewCount: Number(clip.view_count) || 0,
    cover: clip.thumbnail_url || null,
    url: clip.url,
    game: aisleName(clip.game_name),
    foundOn: tape
      ? {
          id: tape.id,
          title: tape.title,
          dateLabel: shortDate(tape.createdMs, timeZone),
          offset,
          at: offset != null ? formatCounter(offset) : null,
        }
      : null,
  };
}

// Clip marks on a tape, in tape order. `position` runs 0 to 1 along it.
export function clipMarks(tape, clips) {
  return clips
    .filter((c) => c.foundOn && c.foundOn.id === tape.id && c.foundOn.offset != null)
    .sort((a, b) => a.foundOn.offset - b.foundOn.offset)
    .map((c) => ({
      clip: c,
      offset: c.foundOn.offset,
      at: c.foundOn.at,
      position: tape.seconds > 0 ? clamp01(c.foundOn.offset / tape.seconds) : 0,
    }));
}

// At most two stickers per box, in this order.
export function tapeStickers(tape, isNewest) {
  const out = [];
  if (isNewest) out.push({ kind: 'new', text: 'New release' });
  if (tape.daysLeft <= 7) out.push({ kind: 'due', text: tape.dueLabel });
  const n = tape.marks.length;
  if (n > 0) out.push({ kind: 'clips', text: `${n} ${n === 1 ? 'clip' : 'clips'} inside` });
  return out.slice(0, 2);
}

// Fresh picks: every clip from the last ARCHIVE_DAYS, newest first. Cult
// classics: the rest of the all-time top clips, in their views order.
export function splitClips(topClips, recentClips, now) {
  const cutoff = now - ARCHIVE_DAYS * DAY_MS;
  const seen = new Set();
  const fresh = [];
  for (const c of [...recentClips, ...topClips]) {
    if (seen.has(c.id) || c.createdMs < cutoff) continue;
    seen.add(c.id);
    fresh.push(c);
  }
  fresh.sort((a, b) => b.createdMs - a.createdMs);
  const classics = [];
  for (const c of topClips) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    classics.push(c);
  }
  return { fresh, classics };
}

// One aisle per game, the aisle with the most-watched clip first.
export function cultAisles(classics) {
  const games = new Map();
  for (const c of classics) {
    if (!games.has(c.game)) games.set(c.game, []);
    games.get(c.game).push(c);
  }
  return [...games.entries()]
    .map(([game, clips]) => ({
      game,
      key: `aisle-${game.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      clips: [...clips].sort((a, b) => b.viewCount - a.viewCount),
    }))
    .sort((a, b) => b.clips[0].viewCount - a.clips[0].viewCount);
}

// Everything VideoStoreFront renders, from App's props and the recent clips.
export function buildStore({ videos = [], topClips = [], recentClips = [], now, timeZone }) {
  const tapes = videos.map((v) => toTape(v, now, timeZone)).sort((a, b) => b.createdMs - a.createdMs);
  const tapesById = new Map(tapes.map((t) => [t.id, t]));
  const norm = (list) => list.map((c) => toClip(c, tapesById, timeZone));
  const { fresh, classics } = splitClips(norm(topClips), norm(recentClips), now);
  const clips = [...fresh, ...classics];
  tapes.forEach((tape, i) => {
    tape.marks = clipMarks(tape, clips);
    tape.stickers = tapeStickers(tape, i === 0);
  });
  const byId = Object.create(null);
  for (const item of [...tapes, ...clips]) byId[item.id] = item;
  return {
    shelves: weekShelves(tapes, now, timeZone),
    fresh,
    aisles: cultAisles(classics),
    counts: { tapes: tapes.length, fresh: fresh.length, classics: classics.length, clips: clips.length },
    byId,
  };
}

const byViews = (a, b) => b.viewCount - a.viewCount;

// The in-store TV's trailer reel (DESIGN.md §7, Video store): the stream while
// Goofer is live, then the newest finished tape, the three most-watched Fresh
// picks that have a name ("No label" makes a bad ad), and the most-watched
// named Cult classic. Clip facts leave out "Picked by", which depends on the
// viewer.
export function promoSpots(store, { isLive = false, stream = null } = {}) {
  const spots = [];
  if (isLive) {
    spots.push({
      key: 'live',
      kind: 'live',
      kicker: 'On the air now',
      title: stream && stream.title ? cleanTitle(stream.title) : 'Goofer is live',
      cover:
        stream && stream.thumbnail_url
          ? stream.thumbnail_url.replace('{width}', '1280').replace('{height}', '720')
          : null,
      coverSet: null,
      facts: stream
        ? [stream.game_name, Number.isFinite(stream.viewer_count) ? `${formatViews(stream.viewer_count)} watching` : null].filter(Boolean)
        : [],
      item: null,
    });
  }
  // While live, Helix lists the broadcast still recording as the newest VOD;
  // the live spot already covers it.
  const liveId = isLive && stream && stream.id ? String(stream.id) : null;
  const newest = store.shelves.flatMap((s) => s.tapes).find((t) => !liveId || t.streamId !== liveId) || null;
  if (newest) {
    spots.push({
      key: `vod-${newest.id}`,
      kind: 'vod',
      kicker: 'Now on tape',
      title: newest.title,
      cover: newest.wideCover,
      coverSet: newest.cover && newest.wideCover ? `${newest.cover} 440w, ${newest.wideCover} 1280w` : null,
      facts: [newest.dateLabel, newest.length, newest.stock],
      item: newest,
    });
  }
  const clipSpot = (clip, kicker) => ({
    key: `clip-${clip.id}`,
    kind: 'clip',
    kicker,
    title: clip.label,
    cover: clip.cover,
    coverSet: null,
    facts: [clip.length, `${clip.views} ${clip.viewCount === 1 ? 'view' : 'views'}`],
    item: clip,
  });
  store.fresh
    .filter((c) => !c.unlabeled)
    .sort(byViews)
    .slice(0, 3)
    .forEach((clip) => spots.push(clipSpot(clip, 'Fresh pick')));
  const classic =
    store.aisles
      .flatMap((a) => a.clips)
      .filter((c) => !c.unlabeled)
      .sort(byViews)[0] || null;
  if (classic) spots.push(clipSpot(classic, `Staff pick · ${classic.year.replace('© ', '')}`));
  return spots;
}
