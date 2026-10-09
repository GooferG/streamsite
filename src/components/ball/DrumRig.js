import DrumCanvas from './DrumCanvas';
import './ball.css';

// The air-mix drum: glass over the ball canvas, on a chrome stand and a red
// blower base. `tube` adds the draw tube on top; `riding` sends a ball up it.
export default function DrumRig({ balls = [], count, blowing = false, still = false, tube = false, riding = false, base = true, className = '' }) {
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      {tube && (
        <div className="gb-tube absolute -top-[24%] left-1/2 h-[24%] w-[7%] -translate-x-1/2 rounded-t-[6px]">
          {riding && <div className="gb-ball gb-rise absolute bottom-0 left-0 aspect-square w-full rounded-full" />}
        </div>
      )}
      <div className="relative aspect-square">
        <DrumCanvas balls={balls} count={count} blowing={blowing} still={still} className="absolute inset-[3%] overflow-hidden rounded-full" />
        <div className="gb-glass absolute inset-0 rounded-full" />
      </div>
      {base && (
        <>
          <div className="gb-stand mx-auto -mt-[2%] h-[16%] w-[40%]" />
          <div className="gb-base mx-auto h-[9%] w-[74%] rounded-[4px]" />
        </>
      )}
    </div>
  );
}
