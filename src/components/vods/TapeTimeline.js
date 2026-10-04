import { FOCUS_INSET, MONO } from '../onAir/classes';
import { formatCounter } from './videoStoreModel';

// The tape counter under the TV: a mark at every clip's offset (press one to
// jump there) and static where Twitch muted the audio.
export default function TapeTimeline({ tape, at, onSeek }) {
  return (
    <div>
      <div className={`${MONO} flex justify-between text-[0.6875rem] tracking-[0.2em] text-onair-ink-4`}>
        <span>0:00:00</span>
        <span>{formatCounter(tape.seconds)}</span>
      </div>
      <div className="relative mt-2 h-9 overflow-hidden rounded-onair-tile bg-onair-surface-4 shadow-onair-well">
        {tape.muted.map((m, i) => (
          <div
            key={i}
            data-muted=""
            aria-hidden="true"
            className="absolute inset-y-0 bg-onair-track"
            style={{ left: `${m.start * 100}%`, width: `${m.width * 100}%` }}
          />
        ))}
        {tape.marks.length > 0 && (
          // Tailwind's preflight removes list markers, and Safari then drops the list semantics.
          // eslint-disable-next-line jsx-a11y/no-redundant-roles
          <ul
            role="list"
            aria-label="Clip marks"
          >
            {tape.marks.map((m) => {
              const current = at === m.offset;
              return (
                <li key={m.clip.id}>
                  <button
                    type="button"
                    aria-label={`Jump to ${m.at}, ${m.clip.label}`}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => onSeek(m.offset)}
                    className={`absolute inset-y-0 flex w-6 -translate-x-1/2 justify-center ${FOCUS_INSET}`}
                    style={{ left: `${m.position * 100}%` }}
                  >
                    <span aria-hidden="true" className={`my-1.5 w-[3px] rounded-full ${current ? 'bg-onair-signal' : 'bg-onair-ink-3'}`} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {tape.muted.length > 0 && (
        <p className="sr-only">{`Audio muted ${tape.muted.map((m) => `${m.from} to ${m.to}`).join(', ')}`}</p>
      )}
    </div>
  );
}
