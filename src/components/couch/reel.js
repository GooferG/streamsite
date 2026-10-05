import { coverUrl } from '../vods/videoStoreModel';

// The TV's running order off air (spec: The TV). Pure.
export const SEGMENT_MS = 6000;
export const STATIC_MS = 300;

// A commercial break after every this many clips.
export const CLIPS_PER_BREAK = 2;

export const isPicture = (item) => item.kind === 'video' || item.kind === 'still';

// Loops (or, with no manifest, the newest tape and up to six clip thumbnails)
// alternating with station-break cards, and a commercial (commercials.js)
// after every two clips, the commercials taking turns.
export function reelItems({ reel, clips = [], videos = [], cards = [], ads = [] }) {
  const pictures =
    Array.isArray(reel) && reel.length
      ? reel.map((r) => ({ kind: 'video', id: r.id, title: r.title, sources: r.sources, poster: r.poster }))
      : [
          ...videos.slice(0, 1).map((v) => ({ kind: 'still', id: `vod-${v.id}`, src: coverUrl(v, 640, 360) })),
          ...clips.slice(0, 6).map((c) => ({ kind: 'still', id: `clip-${c.id}`, src: c.thumbnail_url || null })),
        ].filter((s) => s.src);
  const program = [];
  for (let i = 0; i < Math.max(pictures.length, cards.length); i += 1) {
    if (pictures[i]) program.push(pictures[i]);
    if (cards[i]) program.push({ kind: 'card', id: `card-${i}`, kicker: cards[i].kicker, text: cards[i].text });
  }
  if (!ads.length || !program.length) return program;
  // With fewer than two clips, every segment counts toward a break.
  return withBreaks(program, ads, pictures.length >= CLIPS_PER_BREAK ? isPicture : () => true);
}

// The TV loops its items, so the program repeats until the pattern closes on
// itself: a whole number of breaks and of turns through the commercials.
// Never more than CLIPS_PER_BREAK x ads.length passes.
function withBreaks(program, ads, counts) {
  const units = program.filter(counts).length;
  let passes = 1;
  while ((passes * units) % CLIPS_PER_BREAK || Math.floor((passes * units) / CLIPS_PER_BREAK) % ads.length) passes += 1;
  const out = [];
  let count = 0;
  let breaks = 0;
  for (let p = 0; p < passes; p += 1) {
    for (const item of program) {
      out.push(item);
      if (!counts(item)) continue;
      count += 1;
      if (count % CLIPS_PER_BREAK) continue;
      const ad = ads[breaks % ads.length];
      out.push({ ...ad, id: `${ad.id}-${breaks}` });
      breaks += 1;
    }
  }
  return out;
}

// 'hold': one still and a card, no advancing and no commercials (reduced
// motion). 'lite' (Save-Data): posters, and each commercial as its still frame
// (one image). 'stills': posters with full commercials (the browser refused
// autoplay, which is no data concern). Otherwise 'video'.
export function reelMode({ reducedMotion, saveData, autoplayBlocked }) {
  if (reducedMotion) return 'hold';
  if (saveData) return 'lite';
  if (autoplayBlocked) return 'stills';
  return 'video';
}
