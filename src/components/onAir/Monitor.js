import { MONO } from './classes';
import StatusLight from './StatusLight';
import useChannelSwitch from './useChannelSwitch';
import StaticNoise from './StaticNoise';

// The On Air stage: a bezel around a tinted CRT screen, a chyron ticker along
// the screen's foot and a bezel strip with the channel readout. The knobs,
// LED and wordmark are set dressing (aria-hidden, not interactive).

const TINTS = { signal: '#0f2220', winner: '#2a1810', neutral: '#16131a' };
const TAG = { signal: 'bg-onair-signal', winner: 'bg-onair-winner-hot', muted: 'bg-onair-ink-4' };
const STAR = { signal: 'text-onair-signal', winner: 'text-onair-winner-hot', muted: 'text-onair-ink-4' };
const READOUT = { signal: 'text-onair-signal', muted: 'text-onair-ink-5' };

const SCANLINES = {
  background: 'repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 3px)',
};

function Static() {
  return <StaticNoise className="absolute inset-0 z-[5]" />;
}

function TickerRun({ items, tone, hidden }) {
  return (
    <div className="flex flex-none" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-7 pr-7">
          {item}
          <span className={STAR[tone]} aria-hidden="true">★</span>
        </span>
      ))}
    </div>
  );
}

function Chyron({ tag, tone, items, label = 'Hunt ticker' }) {
  return (
    <div className="relative flex h-10 items-stretch bg-black/[0.55] shadow-onair-row">
      <div
        className={`${MONO} flex flex-none items-center px-4 text-[0.6875rem] font-bold tracking-[0.2em] text-onair-winner-ink ${TAG[tone]}`}
      >
        {tag}
      </div>
      <div
        role="marquee"
        aria-label={label}
        className="relative flex flex-1 items-center overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)]"
      >
        <div className={`${MONO} flex whitespace-nowrap text-xs tracking-[0.18em] text-onair-ink-2 motion-safe:animate-onair-ticker`}>
          <TickerRun items={items} tone={tone} />
          <TickerRun items={items} tone={tone} hidden />
        </div>
      </div>
    </div>
  );
}

function Knob({ label, sizeClass, deg, indicatorClass, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} aria-hidden="true">
      <span className={`${MONO} text-[0.625rem] tracking-[0.2em] text-onair-ink-6`}>{label}</span>
      <span
        className={`relative rounded-full bg-[radial-gradient(circle_at_35%_30%,#4a4650,#1c1a20_70%)] shadow-[0_3px_6px_rgba(0,0,0,.6),inset_0_1px_0_rgba(255,255,255,.15),0_0_0_3px_#17151a] transition-transform duration-[350ms] ease-[cubic-bezier(.3,1.5,.5,1)] motion-reduce:transition-none ${sizeClass}`}
        style={{ transform: `rotate(${deg}deg)` }}
      >
        <span className={`absolute left-1/2 top-1 -ml-px w-[3px] rounded-sm ${indicatorClass}`} />
      </span>
    </div>
  );
}

function BezelStrip({ readout, turns, live, controls }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 pb-4 pt-3.5 sm:gap-5 sm:px-[18px]">
      <div className="flex items-center gap-3" aria-hidden="true">
        {/* The power LED only glows while the channel is live (Glow Means Something). */}
        <span className={`h-2 w-2 rounded-full bg-onair-live ${live ? 'shadow-onair-led' : 'opacity-70'}`} data-led />
        <span className={`${MONO} hidden text-[0.6875rem] font-bold tracking-[0.35em] text-onair-ink-6 sm:inline`}>
          Goofer·vision
        </span>
      </div>
      <div className="flex items-center gap-3 sm:gap-[22px]">
        {controls}
        {readout && (
          <div
            className={`${MONO} flex items-center gap-2 whitespace-nowrap rounded-onair-tile bg-black/[0.35] px-3 py-[7px] text-[0.625rem] font-bold tracking-[0.18em] shadow-onair-well ${READOUT[readout.tone]}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {/* A phone's bezel strip has no room for the channel prefix. */}
            {readout.channel && <span className="hidden sm:inline">{readout.channel} · </span>}
            {readout.label}
          </div>
        )}
        <Knob
          label="CH"
          deg={turns * 60}
          sizeClass="h-[30px] w-[30px] sm:h-[38px] sm:w-[38px]"
          indicatorClass="h-2 bg-onair-winner-hot sm:h-[11px]"
        />
        <Knob
          label="VOL"
          deg={-40}
          sizeClass="h-[30px] w-[30px]"
          indicatorClass="h-2 bg-onair-ink-3"
          className="hidden sm:flex"
        />
      </div>
    </div>
  );
}

export default function Monitor({
  tint = 'neutral',
  status = null,
  channel,
  clock = null,
  channelKey = null,
  readout = null,
  chyron = null,
  label = 'Hunt monitor',
  controls = null,
  children,
}) {
  const { switching, turns } = useChannelSwitch(channelKey);
  return (
    <section
      aria-label={label}
      className="rounded-onair-bezel bg-gradient-to-b from-onair-bezel-top to-onair-bezel-bottom px-2.5 pt-2.5 shadow-onair-bezel sm:px-3.5 sm:pt-3.5"
    >
      <div
        className="relative overflow-hidden rounded-onair-screen shadow-onair-screen"
        style={{ background: `radial-gradient(120% 90% at 50% 40%, ${TINTS[tint]} 0%, #120c0e 60%, #07060a 100%)` }}
      >
        <div className="pointer-events-none absolute inset-0 z-[2] mix-blend-screen" style={SCANLINES} aria-hidden="true" />
        {switching && <Static />}
        <div className="relative px-[18px] pb-4 pt-5 sm:px-[34px] sm:pb-6 sm:pt-7">
          <div className="flex items-center justify-between gap-3 whitespace-nowrap">
            <div className="flex items-center gap-2.5">
              <StatusLight status={status} />
              <span className={`${MONO} text-[0.6875rem] tracking-[0.2em] text-onair-screen-ink`}>{channel}</span>
            </div>
            {/* Phones drop the clock: status, channel and time don't fit one line at 375px. */}
            {clock && (
              <span className={`${MONO} hidden text-[0.6875rem] tracking-[0.2em] text-onair-screen-dim sm:inline`}>{clock.long}</span>
            )}
          </div>
          {children}
        </div>
        {chyron && chyron.items.length > 0 && <Chyron {...chyron} />}
      </div>
      <BezelStrip readout={readout} turns={turns} live={status === 'live'} controls={controls} />
    </section>
  );
}
