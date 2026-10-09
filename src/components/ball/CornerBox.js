import DrumRig from './DrumRig';
import { drawnEntries, drumBalls, pad2, prizeText } from '../../utils/ball';
import './ball.css';

function Toast({ toast }) {
  return (
    <p key={toast.id} className="gb-toast-in mb-2 flex items-center gap-2 border-l-4 border-onair-winner bg-onair-winner-ink px-3 py-1.5 font-onair-mono text-[0.6875rem] font-bold uppercase tracking-[0.15em] text-onair-wgoof-title">
      <span aria-hidden="true">🎱</span>
      {toast.more ? (
        <span>{`+${toast.more} more called in`}</span>
      ) : (
        <>
          <span>{toast.kind === 'swap' ? `@${toast.name} swapped to` : `@${toast.name} called`}</span>
          <span className="text-onair-winner-warm">{toast.slotName}</span>
        </>
      )}
    </p>
  );
}

// The resting overlay (spec: OBS overlay, state 1): the mini drum, the count,
// the !slot command, the prize and the rack so far, plus arrival toasts.
export default function CornerBox({ round, balls = [], toast = null, position = 'left-8 bottom-8', still = false }) {
  const drum = drumBalls(balls);
  const drawn = drawnEntries(round);
  return (
    <div className={`absolute ${position} w-[min(30rem,40vw)] font-onair`}>
      {toast && <Toast toast={toast} />}
      <div className="shadow-onair-card">
        <div className="flex items-stretch">
          <span className="bg-onair-winner px-2.5 py-1 font-display text-[1.125rem] uppercase tracking-wide text-onair-winner-ink">Goofer Ball</span>
          <span className="min-w-0 flex-1 truncate bg-onair-wgoof-deep px-2.5 font-onair-mono text-[0.625rem] font-bold uppercase leading-[2.6] tracking-[0.16em] text-onair-wgoof-title">
            {`CH 42 · Top multi wins ${prizeText(round.prize)}`}
          </span>
        </div>
        <div className="flex items-center gap-3 bg-onair-paper p-2.5 text-onair-paper-ink">
          <div className="gb-set w-[30%] shrink-0 rounded-full">
            <DrumRig balls={drum} still={still} base={false} />
          </div>
          <div className="min-w-0 flex-1 font-onair-mono text-[0.6875rem] font-bold uppercase tracking-[0.15em]">
            <p className="font-display text-[2rem] normal-case leading-none tracking-normal">{`${drum.length} ${drum.length === 1 ? 'ball' : 'balls'}`}</p>
            <p>In the drum</p>
            {round.status === 'open' ? (
              <p className="mt-1">
                Type <span className="whitespace-nowrap bg-onair-paper-ink px-1 normal-case text-onair-paper">!slot &lt;slot name&gt;</span>
              </p>
            ) : (
              <p className="mt-1">Drum closed · results after the hunt</p>
            )}
            {drawn.length > 0 && (
              <ol className="mt-1.5 flex flex-wrap gap-1" aria-label="Drawn">
                {drawn.map((e) => (
                  <li key={e.drawNo} className="gb-ball flex h-5 w-5 items-center justify-center rounded-full text-[0.625rem]">
                    {pad2(e.drawNo)}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
