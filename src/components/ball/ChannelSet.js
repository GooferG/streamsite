import './ball.css';

export const FINE_PRINT = 'Drawn nightly at 4:20. Supervised by the Goofer Gaming Commission. Odds are odds. Not a real lottery.';

// WGOOF Channel 42: a cheap 90s local-TV lottery set (spec decision 1). Fills
// its positioned parent; the drum, ball and lower third go in as children.
export default function ChannelSet({ children, fine = FINE_PRINT, title = true, bug = true, live = true, className = '' }) {
  return (
    <div className={`gb-set absolute inset-0 overflow-hidden font-onair ${className}`}>
      <div className="gb-burst absolute inset-0" aria-hidden="true" />
      <div className="gb-desk absolute inset-x-0 bottom-0 h-[24%]" aria-hidden="true" />
      {title && (
        <div className="absolute right-[4%] top-[4%] text-right" aria-hidden="true">
          <p className="gb-title font-display text-[clamp(1.5rem,4.2vw,4.5rem)] uppercase leading-none">Goofer Ball</p>
          <p className="mt-1 font-onair-mono text-[clamp(0.625rem,1vw,1rem)] font-bold uppercase tracking-[0.3em] text-onair-wgoof-title-dim">
            WGOOF · Channel 42 · Nightly draw
          </p>
        </div>
      )}
      {live && (
        <p
          className="absolute left-[4%] top-[5%] rounded-[3px] bg-onair-live px-2 py-0.5 font-onair-mono text-[clamp(0.625rem,0.9vw,0.875rem)] font-bold uppercase tracking-[0.2em] text-white"
          aria-hidden="true"
        >
          ● Live 4:20
        </p>
      )}
      {bug && (
        <span
          className="absolute bottom-[24%] right-[3.2%] flex aspect-square w-[7%] items-center justify-center rounded-full border-2 border-onair-wgoof-title/55 bg-black/20 font-display text-[clamp(1rem,2.4vw,2.75rem)] text-onair-wgoof-title/70"
          aria-hidden="true"
        >
          42
        </span>
      )}
      {children}
      {fine && (
        <p className="absolute bottom-[2%] left-[4%] right-[4%] font-onair-mono text-[clamp(0.625rem,0.75vw,0.75rem)] uppercase tracking-[0.15em] text-onair-wgoof-title/60">
          {fine}
        </p>
      )}
      <div className="gb-scan pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="gb-vig pointer-events-none absolute inset-0" aria-hidden="true" />
    </div>
  );
}
