import ChannelSet from './ChannelSet';
import BallFace from './BallFace';
import { formatMulti, prizeText, who } from '../../utils/ball';

const WINNER_FINE = 'Results certified by the Goofer Gaming Commission (one guy). Drawn nightly at 4:20.';

// "Tonight's winning ball": played WINNER_HOLD_MS from settledAt.
export default function WinnerCard({ round }) {
  const w = round.winner;
  return (
    <div className="fixed inset-0" role="presentation">
      <ChannelSet title={false} bug={false} fine={WINNER_FINE}>
        <p className="gb-title absolute inset-x-0 top-[7%] text-center font-display text-[clamp(2rem,5vw,5.5rem)] uppercase leading-none">
          Tonight's winning ball
        </p>
        <BallFace entry={w} spinning className="absolute left-[13%] top-[22%] w-[26%]" />
        <div className="absolute left-[45%] right-[5%] top-[24%]">
          <p className="font-display text-[clamp(4rem,12vw,13rem)] leading-[0.9] text-onair-winner-warm">{formatMulti(w.multiplier)}</p>
          <p className="mt-2 font-display text-[clamp(1.25rem,3vw,3.5rem)] uppercase text-onair-wgoof-title">{w.slotName}</p>
          <p className="mt-3 inline-block bg-onair-paper px-3 py-1.5 font-onair-mono text-[clamp(0.75rem,1.2vw,1.25rem)] font-bold uppercase tracking-[0.15em] text-onair-paper-ink">
            {`@${who(w)} wins ${prizeText(round.prize)}`}
          </p>
        </div>
      </ChannelSet>
      <p className="sr-only" aria-live="polite">
        {`Tonight's winning ball: ${w.slotName} at ${formatMulti(w.multiplier)}, called in by ${who(w)}`}
      </p>
    </div>
  );
}
