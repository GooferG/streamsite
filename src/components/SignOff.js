// End-of-transmission strip that closes the home page, the way a late-night
// channel signs off: a short run of color bars, then the sign-off line.
// Bar colors mirror the off-air TestPattern in HomeHero.

const BARS = [
  { color: '#fafafa', opacity: 0.85 },
  { color: '#f97316', opacity: 0.9 },
  { color: '#a855f7', opacity: 0.9 },
  { color: '#10b981', opacity: 0.9 },
  { color: '#ef4444', opacity: 0.9 },
  { color: '#27272a', opacity: 1 },
  { color: '#fafafa', opacity: 0.6 },
];

export default function SignOff({ onSchedule }) {
  return (
    <section aria-label="End of transmission" className="px-6 sm:px-10 pt-16 pb-12">
      <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto">
        <div className="flex h-8 sm:h-10 overflow-hidden rounded-sm border border-white/10">
          {BARS.map((bar, i) => (
            <div
              key={i}
              className="flex-1"
              style={{ backgroundColor: bar.color, opacity: bar.opacity }}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div className="text-[0.625rem] sm:text-xs font-bold tracking-eyebrow-lg uppercase font-mono text-white/45">
            End of transmission
            <span className="text-white/25 mx-2">·</span>
            <span className="text-white/35">CH GG signs off</span>
          </div>
          {onSchedule && (
            <button
              type="button"
              onClick={onSchedule}
              className="group text-[0.625rem] sm:text-xs font-bold tracking-eyebrow-sm uppercase font-mono text-emerald-bright hover:text-emerald-signal transition-colors duration-200 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-signal"
            >
              Broadcast resumes on schedule
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
