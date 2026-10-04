import { coverUrl } from '../vods/videoStoreModel';

// The TV's running order off air (spec: The TV). Pure.
export const SEGMENT_MS = 6000;
export const STATIC_MS = 300;

// Loops (or, with no manifest, the newest tape and up to six clip thumbnails)
// alternating with station-break cards.
export function reelItems({ reel, clips = [], videos = [], cards = [] }) {
  const pictures =
    Array.isArray(reel) && reel.length
      ? reel.map((r) => ({ kind: 'video', id: r.id, title: r.title, sources: r.sources, poster: r.poster }))
      : [
          ...videos.slice(0, 1).map((v) => ({ kind: 'still', id: `vod-${v.id}`, src: coverUrl(v, 640, 360) })),
          ...clips.slice(0, 6).map((c) => ({ kind: 'still', id: `clip-${c.id}`, src: c.thumbnail_url || null })),
        ].filter((s) => s.src);
  const out = [];
  for (let i = 0; i < Math.max(pictures.length, cards.length); i += 1) {
    if (pictures[i]) out.push(pictures[i]);
    if (cards[i]) out.push({ kind: 'card', id: `card-${i}`, kicker: cards[i].kicker, text: cards[i].text });
  }
  return out;
}

// 'hold': one still and a card, no advancing (reduced motion). 'stills': no
// video (Save-Data, or the browser refused autoplay). Otherwise 'video'.
export function reelMode({ reducedMotion, saveData, autoplayBlocked }) {
  if (reducedMotion) return 'hold';
  if (saveData || autoplayBlocked) return 'stills';
  return 'video';
}
