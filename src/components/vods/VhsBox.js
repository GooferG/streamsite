import { FOCUS, MONO } from '../onAir/classes';

const STICKER = {
  new: 'bg-onair-signal text-onair-paper-ink',
  due: 'bg-onair-loss text-onair-paper-ink',
  clips: 'bg-onair-paper text-onair-paper-ink',
};

export function Sticker({ sticker }) {
  return (
    <span
      className={`${MONO} inline-block rounded-onair-label px-1.5 py-0.5 text-[0.625rem] font-bold tracking-[0.15em] shadow-onair-raised ${STICKER[sticker.kind]}`}
    >
      {sticker.text}
    </span>
  );
}

// A VOD on the shelf: a portrait clamshell. The sleeve has the 16:9 thumbnail
// in a photo window, the title on a marker label, the catalogue number and
// weekday down the spine, and the tape stock and length along the bottom.
export default function VhsBox({ tape, onOpen }) {
  const name = [tape.title, tape.dateLabel, tape.length, ...tape.stickers.map((s) => s.text)].join(', ');
  return (
    <button
      type="button"
      onClick={() => onOpen(tape.id)}
      aria-label={name}
      className={`group block w-full rounded-onair-case text-left ${FOCUS}`}
    >
      <div className="relative flex aspect-[2/3] rounded-onair-case bg-gradient-to-b from-onair-surface-1 to-onair-surface-4 shadow-onair-card transition-transform duration-200 motion-safe:group-hover:-translate-y-1 motion-safe:group-focus-visible:-translate-y-1">
        <div aria-hidden="true" className="flex w-6 shrink-0 flex-col items-center rounded-l-onair-case justify-between bg-onair-surface-4 py-2 shadow-onair-row">
          <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-4 [writing-mode:vertical-rl]`}>No. {tape.no}</span>
          <span className={`${MONO} text-[0.625rem] font-bold tracking-[0.15em] text-onair-ink-3 [writing-mode:vertical-rl]`}>{tape.weekday}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-2">
          <div className="relative aspect-video overflow-hidden rounded-onair-label bg-onair-surface-4 shadow-onair-well">
            {tape.cover ? (
              <img src={tape.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div data-testid="no-picture" className="flex h-full items-center justify-center bg-onair-track">
                <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-4`}>No picture</span>
              </div>
            )}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-onair-scanlines" />
          </div>
          <p className="mt-2 line-clamp-3 break-words rounded-onair-label bg-onair-paper px-2 py-1 font-onair-marker text-[0.9375rem] leading-tight text-onair-paper-ink">
            {tape.title}
          </p>
          {tape.stickers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tape.stickers.map((s) => (
                <Sticker key={s.kind} sticker={s} />
              ))}
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 border-t border-white/10 pt-1.5">
            <span className={`${MONO} text-[0.625rem] font-bold tracking-[0.15em] text-onair-ink-3`}>{tape.stock}</span>
            <span className={`${MONO} text-[0.625rem] tracking-[0.15em] text-onair-ink-4`}>{tape.length}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
