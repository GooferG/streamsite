import { useEffect, useRef } from 'react';
import ChannelSet from './ChannelSet';
import DrumRig from './DrumRig';
import BallFace from './BallFace';
import LowerThird from './LowerThird';
import { drawPhase, pad2, who } from '../../utils/ball';

export const NO_SOUND = { tick() {}, burst() {}, land() {} };

function usePhaseSound(phase, sound) {
  const last = useRef(null);
  useEffect(() => {
    if (phase === last.current) return;
    last.current = phase;
    if (phase === 'blower') sound.burst(1600);
    else if (phase === 'tube') sound.tick();
    else if (phase === 'spin') sound.land();
  }, [phase, sound]);
}

// The full-screen draw (spec: Draw takeover, DRAW_REVEAL_MS from drawnAt):
// static cut in, the blower roars, the ball rides the tube, the close-up spins
// to the slot art and the caller, the lower third holds, cut back out.
export default function DrawTakeover({ entry, rack = [], balls = [], left = null, elapsed, sound = NO_SOUND }) {
  const phase = drawPhase(elapsed);
  usePhaseSound(phase, sound);
  if (!phase) return null;
  const blowing = phase === 'blower' || phase === 'tube';
  const shown = phase === 'spin' || phase === 'hold' || phase === 'out';
  const lower = phase === 'hold' || phase === 'out';
  const earlier = rack.filter((e) => !e.scratched && e.drawNo < entry.drawNo).slice(-12);
  const onRack = (lower ? [...earlier, entry] : earlier).slice(-12);

  return (
    <div className={`fixed inset-0 ${phase === 'out' ? 'gb-cut-out' : ''}`} role="presentation">
      <ChannelSet>
        <DrumRig
          balls={balls}
          count={left == null && balls.length === 0 ? 24 : balls.length}
          blowing={blowing}
          tube
          riding={phase === 'tube'}
          className="absolute left-[7%] top-[12%] w-[28%]"
        />
        {shown && <BallFace entry={entry} spinning={phase === 'spin'} className="absolute left-[46%] top-[16%] w-[28%]" />}
        {onRack.length > 0 && (
          <ol className="absolute bottom-[27%] left-[5%] flex gap-1.5" aria-hidden="true">
            {onRack.map((e) => (
              <li
                key={e.drawNo}
                className="gb-ball flex aspect-square w-[clamp(1.25rem,2vw,2.25rem)] items-center justify-center rounded-full font-onair-mono text-[0.625rem] font-bold text-onair-paper-ink"
              >
                {pad2(e.drawNo)}
              </li>
            ))}
          </ol>
        )}
        {lower && <LowerThird entry={entry} left={left} />}
      </ChannelSet>
      {phase === 'cut' && <div className="gb-static absolute inset-0" aria-hidden="true" />}
      <p className="sr-only" aria-live="polite">
        {`Ball ${entry.drawNo}: ${entry.slotName}, called in by ${who(entry)}`}
      </p>
    </div>
  );
}
