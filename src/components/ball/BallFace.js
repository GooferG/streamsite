import { pad2, who } from '../../utils/ball';
import './ball.css';

// The drawn ball in close-up: "BALL 03", the slot art as a round decal (the
// slot name until art exists), and the caller stamped on the band.
export default function BallFace({ entry, spinning = false, className = '' }) {
  return (
    <div className={`gb-ball relative aspect-square rounded-full ${spinning ? 'gb-spin-in' : ''} ${className}`}>
      <p className="absolute inset-x-0 top-[5%] text-center font-onair-mono text-[clamp(0.625rem,1.1vw,1.125rem)] font-bold uppercase tracking-[0.15em] text-onair-paper-ink/75">
        Ball {pad2(entry.drawNo)}
      </p>
      <div className="gb-decal absolute left-1/2 top-[16%] aspect-square w-1/2 -translate-x-1/2 overflow-hidden rounded-full">
        {entry.thumb ? (
          <img src={entry.thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center p-[12%] text-center font-onair text-[clamp(0.625rem,1.2vw,1.25rem)] font-extrabold uppercase leading-tight text-white">
            {entry.slotName}
          </span>
        )}
      </div>
      <p className="gb-band absolute inset-x-[8%] top-[68%] -rotate-[5deg] py-[3%] text-center font-onair-mono text-[clamp(0.75rem,1.6vw,1.75rem)] font-bold uppercase text-onair-paper-ink">
        @{who(entry)}
      </p>
    </div>
  );
}
