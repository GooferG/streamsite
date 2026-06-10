import { useMemo } from 'react';
import { useSchedule } from '../hooks/useSchedule';

const DAYS_OF_WEEK = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRY-DAY',
  'SATURDAY',
];

function formatCount(n) {
  if (n == null) return null;
  const num = typeof n === 'string' ? parseInt(n, 10) : n;
  if (Number.isNaN(num)) return String(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString('en-US');
}

function formatListCount(arr, cap = 20) {
  if (!Array.isArray(arr)) return null;
  if (arr.length >= cap) return `${cap}+`;
  return String(arr.length);
}

function formatRelativeTime(input) {
  if (!input) return null;
  const then = new Date(input);
  if (Number.isNaN(then.getTime())) return null;
  const diffMs = Date.now() - then.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Lower-third filler lines, rotated into the crawl between the live numbers.
const BULLETINS = [
  { label: 'Signal', value: 'Strong-ish' },
  { label: 'Bulletin', value: 'No sleep detected' },
  { label: 'PSA', value: 'Adjust your antenna' },
  { label: 'Source', value: 'Broadcasting from the couch' },
];

function TickerItem({ label, value, tone = 'white' }) {
  const valueColor =
    tone === 'emerald'
      ? 'text-emerald-bright'
      : tone === 'purple'
        ? 'text-purple-bright'
        : tone === 'blue'
          ? 'text-rainbet-blue-bright'
          : 'text-white/85';
  return (
    <span className="inline-flex items-baseline gap-2.5 px-6 sm:px-8 whitespace-nowrap">
      <span className="text-[0.625rem] sm:text-xs font-bold tracking-eyebrow uppercase text-emerald-signal/80 font-mono">
        {label}
      </span>
      <span
        className={`text-xs sm:text-sm font-bold tracking-eyebrow-xs uppercase tabular-nums font-mono ${valueColor}`}
      >
        {value}
      </span>
      <span className="text-white/20 pl-6 sm:pl-8" aria-hidden="true">
        ◆
      </span>
    </span>
  );
}

export default function StatsTicker({ channelData, streamData, isLive, clips, videos, loading }) {
  const { schedule } = useSchedule();
  const allFailed =
    !loading &&
    !channelData &&
    (!Array.isArray(clips) || clips.length === 0) &&
    (!Array.isArray(videos) || videos.length === 0);

  const items = useMemo(() => {
    const followers = channelData?.followers != null ? formatCount(channelData.followers) : null;
    const clipCount = formatListCount(clips);
    const vodCount = formatListCount(videos);

    let lastLive = null;
    if (isLive) {
      lastLive = 'Live now';
    } else if (Array.isArray(videos) && videos.length > 0 && videos[0]?.created_at) {
      lastLive = formatRelativeTime(videos[0].created_at);
    }

    const upcoming = [];
    if (Array.isArray(schedule) && schedule.length > 0) {
      const today = new Date().getDay();
      for (let i = 0; i < 7 && upcoming.length < 3; i += 1) {
        const dayName = DAYS_OF_WEEK[(today + i) % 7];
        const entry = schedule.find((s) => s.day === dayName);
        if (entry && entry.status !== 'off') {
          upcoming.push({
            label: i === 0 ? 'Tonight' : entry.day,
            value: `${entry.time} · ${entry.gameName || entry.content}`,
            tone: entry.status === 'special' ? 'purple' : 'white',
          });
        }
      }
    }

    const stats = [
      followers && { label: 'Followers', value: followers },
      lastLive && { label: 'Last live', value: lastLive, tone: isLive ? 'emerald' : 'white' },
      clipCount && { label: 'Clips on file', value: clipCount },
      vodCount && { label: 'Tapes archived', value: vodCount },
    ].filter(Boolean);

    // Interleave: stat, bulletin, schedule entry, stat, bulletin... so the
    // crawl never reads as four numbers in a row.
    const out = [];
    const queues = [stats, [...BULLETINS], upcoming];
    let qi = 0;
    while (queues.some((q) => q.length > 0)) {
      const q = queues[qi % queues.length];
      if (q.length > 0) out.push(q.shift());
      qi += 1;
    }
    out.push({ label: 'Sponsor', value: 'Code BEAN on Rainbet', tone: 'blue' });
    return out;
  }, [channelData, clips, videos, isLive, schedule]);

  const content = items.map((item, i) => (
    <TickerItem key={`${item.label}-${i}`} label={item.label} value={item.value} tone={item.tone} />
  ));

  return (
    <section aria-label="Channel ticker" className="relative border-t border-emerald-signal/15">
      <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-6 sm:px-10 pt-10 sm:pt-12 pb-6 sm:pb-8">
        <div className="text-[0.625rem] sm:text-xs font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">
          <span className="inline-block px-1.5 py-0.5 border border-white/30 text-white/70 mr-3 align-middle text-[0.5625rem] tracking-eyebrow">
            GG
          </span>
          CH GG <span className="text-white/30 mx-1">·</span> All-night broadcast
        </div>
      </div>

      <div className="relative bg-zinc-card/70 border-y border-white/5 overflow-hidden">
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 sm:w-20 z-10"
          style={{ background: 'linear-gradient(to right, rgba(9,9,11,1), rgba(9,9,11,0))' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-20 z-10"
          style={{ background: 'linear-gradient(to left, rgba(9,9,11,1), rgba(9,9,11,0))' }}
          aria-hidden="true"
        />

        <div className="gg-ticker-viewport overflow-hidden motion-reduce:overflow-x-auto scrollbar-hide">
          <div className="gg-ticker-track flex whitespace-nowrap py-3.5 motion-safe:animate-[gg-ticker_50s_linear_infinite] w-max">
            <div className="flex">{content}</div>
            <div className="flex motion-reduce:hidden" aria-hidden="true">
              {content}
            </div>
          </div>
        </div>

        {allFailed && (
          <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-6 sm:px-10 pb-3 text-[0.625rem] sm:text-xs font-bold tracking-eyebrow-lg uppercase text-red-destructive font-mono">
            Signal lost
          </div>
        )}
      </div>

      <style>{`
        @keyframes gg-ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .gg-ticker-viewport:hover .gg-ticker-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .gg-ticker-track {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}
