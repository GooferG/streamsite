import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLeaderboardData } from '../hooks/useLeaderboardData';
import { useCountdown } from '../hooks/useCountdown';

const TONES = {
  emerald: {
    core: 'rgba(220, 252, 231, 1)',
    hot: 'rgba(110, 231, 183, 0.75)',
    haze: 'rgba(16, 185, 129, 0.32)',
    edge: 'rgba(16, 185, 129, 0.0)',
    lens: '#a7f3d0',
    glow: 'rgba(52, 211, 153, 0.6)',
  },
  purple: {
    core: 'rgba(243, 232, 255, 1)',
    hot: 'rgba(216, 180, 254, 0.7)',
    haze: 'rgba(168, 85, 247, 0.3)',
    edge: 'rgba(168, 85, 247, 0.0)',
    lens: '#e9d5ff',
    glow: 'rgba(192, 132, 252, 0.55)',
  },
};

function SearchlightCone({ tone = 'emerald' }) {
  const t = TONES[tone] || TONES.emerald;
  const gid = `home-lb-cone-${tone}`;
  const fid = `home-lb-cone-feather-${tone}`;
  return (
    <svg
      viewBox="0 0 200 460"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <radialGradient
          id={gid}
          cx="100"
          cy="460"
          r="380"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={t.core} stopOpacity="0.9" />
          <stop offset="12%" stopColor={t.hot} stopOpacity="0.7" />
          <stop offset="45%" stopColor={t.haze} stopOpacity="0.35" />
          <stop offset="85%" stopColor={t.edge} stopOpacity="0" />
          <stop offset="100%" stopColor={t.edge} stopOpacity="0" />
        </radialGradient>
        <filter id={fid} x="-20%" y="-10%" width="140%" height="120%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {/* Cone polygon: narrow at the bottom (light source), wide at the top (throw) */}
      <polygon
        points="86,460 114,460 200,0 0,0"
        fill={`url(#${gid})`}
        filter={`url(#${fid})`}
      />
      {/* Hot inner shaft — narrower, brighter, sharper */}
      <polygon
        points="94,460 106,460 145,0 55,0"
        fill={`url(#${gid})`}
        opacity="0.65"
      />
      {/* Dust motes drifting up the beam */}
      <DustMotes seed={tone} />
    </svg>
  );
}

function DustMotes({ seed = 'emerald', count = 8 }) {
  const motes = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const rand = () => {
      h = (h * 9301 + 49297) % 233280;
      return h / 233280;
    };
    return Array.from({ length: count }, () => ({
      x: 60 + rand() * 80,
      r: 0.8 + rand() * 1.6,
      delay: rand() * 6,
      drift: (rand() * 18 - 9).toFixed(1),
      duration: 5 + rand() * 4,
    }));
  }, [seed, count]);

  return (
    <g>
      {motes.map((m, i) => (
        <circle
          key={i}
          className="home-lb-mote"
          cx={m.x}
          cy={420}
          r={m.r}
          fill="rgba(255,255,255,0.65)"
          style={{
            transformOrigin: `${m.x}px 420px`,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
            '--mote-drift': `${m.drift}px`,
          }}
        />
      ))}
    </g>
  );
}

function SearchlightLens({ tone = 'emerald', align = 'left' }) {
  const t = TONES[tone] || TONES.emerald;
  const positionCls =
    align === 'right'
      ? 'absolute bottom-0 right-0 translate-x-2 translate-y-2'
      : 'absolute bottom-0 left-0 -translate-x-2 translate-y-2';
  return (
    <div className={positionCls}>
      <div className="relative w-14 h-14">
        <div
          className="home-lb-lens absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${t.lens} 0%, ${t.glow} 35%, transparent 70%)`,
            filter: 'blur(2px)',
          }}
        />
        <div
          className="absolute inset-[35%] rounded-full"
          style={{
            background: `radial-gradient(circle, #ffffff 0%, ${t.lens} 45%, transparent 80%)`,
          }}
        />
      </div>
    </div>
  );
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatPrizeHeadline(amount) {
  if (!amount && amount !== 0) return '$0';
  return `$${amount.toLocaleString('en-US')}`;
}

function formatUSD(amount) {
  if (!amount && amount !== 0) return '$0';
  return `$${Math.trunc(amount).toLocaleString('en-US')}`;
}

// Eases out cubic — fast start, slow settle (slot-roll feel).
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function useCountUp(target, { duration = 1400, runWhen = true } = {}) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!runWhen || !target) return;
    if (typeof window === 'undefined') {
      setValue(target);
      return;
    }
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target);
      return;
    }
    if (startedRef.current) {
      setValue(target);
      return;
    }
    startedRef.current = true;

    const from = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, runWhen]);

  return value;
}

function useInView(ref, { rootMargin = '0px', threshold = 0 } = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    // If the element is already visible on mount (page loads with callout in view),
    // fire immediately so the count-up runs without requiring a scroll.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, threshold]);
  return inView;
}

export default function HomeLeaderboardCallout() {
  const navigate = useNavigate();
  const data = useLeaderboardData();
  const remaining = useCountdown(data.endsAt);
  const leader = data.players[0];
  const runnerUp = data.players[1];
  const lead = leader && runnerUp ? leader.wagered - runnerUp.wagered : 0;

  const sectionRef = useRef(null);
  const inView = useInView(sectionRef);
  const animatedPrize = useCountUp(data.prizePool || 0, {
    duration: 1500,
    runWhen: inView,
  });

  const handleClick = () => navigate('/gamba/leaderboard');

  return (
    <section ref={sectionRef} className="py-12 px-6 sm:px-10">
      <style>{`
        @keyframes home-lb-sweep-left {
          0%   { transform: rotate(-22deg); }
          50%  { transform: rotate(18deg);  }
          100% { transform: rotate(-22deg); }
        }
        @keyframes home-lb-sweep-right {
          0%   { transform: rotate(22deg);  }
          50%  { transform: rotate(-18deg); }
          100% { transform: rotate(22deg);  }
        }
        @keyframes home-lb-flicker {
          0%, 88%, 100% { opacity: 0.95; }
          90%, 94%      { opacity: 0.62; }
          92%, 96%      { opacity: 1; }
        }
        @keyframes home-lb-lens-pulse {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.12); }
        }
        @keyframes home-lb-mote {
          0%   { transform: translateY(0)    translateX(0)   scale(0.6); opacity: 0; }
          15%  { opacity: 0.9; }
          85%  { opacity: 0.7; }
          100% { transform: translateY(-260px) translateX(var(--mote-drift, 8px)) scale(1.2); opacity: 0; }
        }
        @keyframes home-lb-bean-flicker {
          0%, 100% {
            text-shadow:
              0 0 14px rgba(44, 124, 246, 0.10),
              0 0 36px rgba(96, 165, 250, 0.06);
            opacity: 0.7;
          }
          47% {
            text-shadow:
              0 0 22px rgba(44, 124, 246, 0.22),
              0 0 52px rgba(96, 165, 250, 0.12);
            opacity: 0.95;
          }
          50% {
            text-shadow:
              0 0 6px rgba(44, 124, 246, 0.05),
              0 0 16px rgba(96, 165, 250, 0.02);
            opacity: 0.4;
          }
          53% {
            text-shadow:
              0 0 20px rgba(44, 124, 246, 0.2),
              0 0 48px rgba(96, 165, 250, 0.1);
            opacity: 0.85;
          }
        }
        .home-lb-bean {
          animation: home-lb-bean-flicker 9s steps(60, end) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .home-lb-bean { animation: none; }
        }
        .home-lb-beam-left  {
          transform-origin: 50% 100%;
          animation:
            home-lb-sweep-left   7s ease-in-out infinite,
            home-lb-flicker      5.3s steps(1, end) infinite;
        }
        .home-lb-beam-right {
          transform-origin: 50% 100%;
          animation:
            home-lb-sweep-right  8.5s ease-in-out infinite,
            home-lb-flicker      6.7s steps(1, end) infinite;
        }
        .home-lb-lens { animation: home-lb-lens-pulse 3s ease-in-out infinite; }
        .home-lb-mote { animation: home-lb-mote 6s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .home-lb-beam-left,
          .home-lb-beam-right,
          .home-lb-lens,
          .home-lb-mote { animation: none; }
          .home-lb-beam-left,
          .home-lb-beam-right { opacity: 0.4; }
        }
      `}</style>

      <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto">
        <div className="relative overflow-hidden">
          {/* Searchlight stage — anchored at the lower outside corners, sweep up & inward */}
          <div
            className="pointer-events-none absolute -inset-x-16 -bottom-12 -top-40 overflow-hidden motion-reduce:opacity-60"
            aria-hidden="true"
          >
            {/* Hidden CODE / BEAN watermark — sits nearly invisible, brightens where
                the beams sweep across it via mix-blend-mode: screen on the beams above it.
                CODE eyebrow perches above the N of BEAN as a small label tag.
                Hidden below sm: on mobile the watermark fights the banner text. */}
            <div className="hidden sm:flex absolute inset-x-16 bottom-12 top-40 items-center justify-center select-none">
              <div className="relative">
                <span
                  className="home-lb-bean absolute uppercase font-mono font-bold whitespace-nowrap text-rainbet-blue-bright/40"
                  style={{
                    fontSize: 'clamp(0.65rem, 1.1vw, 0.95rem)',
                    letterSpacing: '0.4em',
                    paddingLeft: '0.4em',
                    right: '0.5em',
                    top: '-0.4em',
                    textShadow:
                      '0 0 6px rgba(96, 165, 250, 0.5), 0 0 14px rgba(44, 124, 246, 0.35)',
                    filter: 'blur(0.4px)',
                  }}
                >
                  Code
                </span>
                <span
                  className="home-lb-bean font-display uppercase tracking-tight leading-none whitespace-nowrap block"
                  style={{
                    fontSize: 'clamp(7rem, 18vw, 16rem)',
                    letterSpacing: '-0.04em',
                    color: 'rgba(44, 124, 246, 0.05)',
                    WebkitTextStroke: '1px rgba(96, 165, 250, 0.010)',
                  }}
                >
                  BEAN
                </span>
                <span
                  className="home-lb-bean absolute uppercase font-mono font-bold whitespace-nowrap text-rainbet-blue-bright/40"
                  style={{
                    fontSize: 'clamp(0.65rem, 1.1vw, 0.95rem)',
                    letterSpacing: '0.4em',
                    paddingLeft: '0.4em',
                    left: '0.5em',
                    bottom: '-0.4em',
                    textShadow:
                      '0 0 6px rgba(96, 165, 250, 0.5), 0 0 14px rgba(44, 124, 246, 0.35)',
                    filter: 'blur(0.4px)',
                  }}
                >
                  on Rainbet
                </span>
              </div>
            </div>

            {/* LEFT searchlight */}
            <div
              className="absolute bottom-0 left-0 w-[260px] h-[460px]"
              style={{ mixBlendMode: 'screen' }}
            >
              <div className="home-lb-beam-left absolute inset-0">
                <SearchlightCone tone="emerald" />
              </div>
              <SearchlightLens tone="emerald" />
            </div>

            {/* RIGHT searchlight */}
            <div
              className="absolute bottom-0 right-0 w-[260px] h-[460px]"
              style={{ mixBlendMode: 'screen' }}
            >
              <div className="home-lb-beam-right absolute inset-0">
                <SearchlightCone tone="purple" />
              </div>
              <SearchlightLens tone="purple" align="right" />
            </div>
          </div>

          <button
            type="button"
            onClick={handleClick}
            className="group relative w-full text-left overflow-hidden border border-emerald-signal/30 bg-zinc-card/40 hover:border-emerald-signal/55 transition-colors duration-200 motion-reduce:transition-none"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden"
              aria-hidden="true"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
              }}
            />
            <div
              className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-emerald-signal/12 blur-3xl motion-reduce:hidden"
              aria-hidden="true"
            />

            <div className="pointer-events-none absolute top-3 right-4 flex items-center gap-2 text-[10px] font-bold tracking-eyebrow-lg text-emerald-signal font-mono z-10">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-signal animate-pulse motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span>LIVE</span>
            </div>

            <div className="relative p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-8 items-center">
              <div className="space-y-4">
                <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
                  NOW SHOWING · CH 01 · {data.periodLabel}
                </div>
                <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-none uppercase">
                  <span
                    className="relative inline-block tabular-nums whitespace-nowrap align-baseline"
                    aria-label={formatPrizeHeadline(data.prizePool)}
                  >
                    {/* Invisible sizer — reserves the final width so the headline
                        doesn't reflow as the count-up runs. */}
                    <span aria-hidden="true" className="invisible">
                      {formatPrizeHeadline(data.prizePool)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 right-0 text-emerald-signal"
                    >
                      {formatPrizeHeadline(animatedPrize)}
                    </span>
                  </span>{' '}
                  <span className="text-white-body">MONTHLY LEADERBOARD</span>
                </h2>
                <p className="text-white/65 text-base sm:text-lg leading-relaxed max-w-xl">
                  Play on Rainbet with code{' '}
                  <span className="font-bold text-rainbet-blue-bright font-mono tracking-eyebrow-sm">
                    BEAN
                  </span>{' '}
                  to climb the standings. Top 20 wagerers split the pool every
                  month.
                </p>
                <div className="flex items-center gap-3 pt-2 text-sm font-bold tracking-eyebrow-sm uppercase font-mono text-emerald-bright group-hover:text-emerald-signal transition-colors duration-200 motion-reduce:transition-none">
                  <span>View standings</span>
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                  >
                    →
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 lg:border-l lg:border-white/8 lg:pl-8">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
                    CURRENT LEADER
                  </div>
                  <div className="font-display text-2xl sm:text-3xl text-white-body tracking-tight uppercase leading-none break-all">
                    {leader ? leader.maskedUsername : '—'}
                  </div>
                  <div className="text-base sm:text-lg font-bold tabular-nums font-mono text-emerald-signal leading-none">
                    {leader ? formatUSD(leader.wagered) : '$0'}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
                    T-MINUS
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums font-mono text-white-body leading-none">
                    {pad2(remaining.days)}d {pad2(remaining.hours)}h
                  </div>
                  <div className="text-xs tabular-nums font-mono text-white/55">
                    {pad2(remaining.minutes)}m {pad2(remaining.seconds)}s
                  </div>
                </div>

                <div className="col-span-2 pt-3 border-t border-white/8 flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold tracking-eyebrow-lg text-white/55 font-mono">
                      LEADING BY
                    </div>
                    <div className="text-base sm:text-lg font-bold tabular-nums font-mono text-white-body">
                      {lead > 0 ? formatUSD(lead) : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold tracking-eyebrow-lg text-emerald-signal/80 font-mono">
                      1ST PRIZE
                    </div>
                    <div className="text-base sm:text-lg font-bold tabular-nums font-mono text-emerald-signal">
                      {leader ? formatUSD(leader.prize) : '$0'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
