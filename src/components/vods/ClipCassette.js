import { FOCUS, MONO } from '../onAir/classes';
import { pickedBy } from './videoStoreModel';

// A clip: a small landscape camcorder case (the thumbnail fits it uncropped),
// its label line, and the index card crediting whoever clipped it. A viewer's
// own clip says "Picked by you" on a purple card, the On Air "you" role.
export default function ClipCassette({ clip, viewerName, showYear = false, onOpen }) {
  const pick = pickedBy(clip, viewerName);
  const name = [clip.label, pick.text, clip.length, showYear ? clip.year : null].filter(Boolean).join(', ');
  return (
    <button
      type="button"
      onClick={() => onOpen(clip.id)}
      aria-label={name}
      className={`group block w-full rounded-onair-tile text-left ${FOCUS}`}
    >
      <div className="relative rounded-onair-tile bg-gradient-to-b from-onair-surface-1 to-onair-surface-4 p-2 shadow-onair-card transition-transform duration-200 motion-safe:group-hover:-translate-y-1 motion-safe:group-focus-visible:-translate-y-1">
        <div className="relative aspect-video overflow-hidden rounded-onair-label bg-onair-surface-4 shadow-onair-well">
          {clip.cover ? (
            <img src={clip.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div data-testid="no-picture" className="h-full bg-onair-track" />
          )}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-onair-scanlines" />
          {showYear && (
            <span className={`${MONO} absolute right-1.5 top-1.5 rotate-2 rounded-onair-label bg-onair-paper px-1.5 py-0.5 text-[0.625rem] font-bold tracking-[0.15em] text-onair-paper-ink`}>
              {clip.year}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-4`}>{clip.length}</span>
          <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-4`}>{clip.views} {clip.viewCount === 1 ? 'view' : 'views'}</span>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 break-words text-[0.875rem] font-bold leading-snug text-onair-ink-1">{clip.label}</p>
      <p
        data-you={pick.you || undefined}
        className={`mt-1.5 inline-block -rotate-1 rounded-onair-label px-2 py-0.5 font-onair-marker text-[0.9375rem] leading-tight ${pick.you ? 'bg-onair-viewer-deep text-white-body shadow-onair-lit-viewer' : 'bg-onair-paper text-onair-paper-ink'}`}
      >
        {pick.text}
      </p>
    </button>
  );
}
