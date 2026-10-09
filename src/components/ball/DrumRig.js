import DrumCanvas from './DrumCanvas';
import './ball.css';

// The air-mix drum: glass over the ball canvas, on a chrome stand and a red
// blower base. `tube` adds the draw tube on top; `riding` sends a ball up it.
// className is the caller's positioning and width only (the root has none).
export default function DrumRig({ balls = [], count, blowing = false, still = false, tube = false, riding = false, base = true, className = '' }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="relative">
        <div className="relative aspect-square">
          {tube && (
            <div className="gb-tube absolute bottom-full left-1/2 h-[22%] w-[7%] -translate-x-1/2 rounded-t-[6px]">
              {riding && <div className="gb-ball gb-rise absolute bottom-0 left-0 aspect-square w-full rounded-full" />}
            </div>
          )}
          <div className="absolute inset-[3%] overflow-hidden rounded-full">
            <DrumCanvas balls={balls} count={count} blowing={blowing} still={still} className="h-full w-full" />
          </div>
          <div className="gb-glass absolute inset-0 rounded-full" />
        </div>
        {base && (
          <>
            <div className="gb-stand mx-auto -mt-[2%] aspect-[5/2] w-[40%]" />
            <div className="gb-base mx-auto aspect-[74/9] w-[74%] rounded-[4px]" />
          </>
        )}
      </div>
    </div>
  );
}
