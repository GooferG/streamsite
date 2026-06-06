import { useMemo } from 'react';
import { SOCIAL_LINKS } from '../constants';

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

function Cell({ label, value, href, fadingPlaceholder }) {
  const valueNode = (
    <span
      className={`block text-xl sm:text-2xl font-black tracking-tight tabular-nums ${
        value == null ? 'text-white/30' : 'text-white-body'
      } font-mono`}
      >
      {value ?? fadingPlaceholder ?? '—'}
    </span>
  );

  const labelNode = (
    <span className="block text-[0.625rem] sm:text-xs font-bold tracking-eyebrow uppercase text-emerald-bright mb-1.5">
      {label}
    </span>
  );

  const body = (
    <>
      {labelNode}
      {valueNode}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col justify-center px-6 sm:px-8 py-4 min-w-[160px] sm:min-w-[200px] transition-colors duration-200 hover:bg-zinc-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-signal"
      >
        {body}
      </a>
    );
  }
  return (
    <div className="flex flex-col justify-center px-6 sm:px-8 py-4 min-w-[160px] sm:min-w-[200px]">
      {body}
    </div>
  );
}

export default function StatsTicker({ channelData, streamData, isLive, clips, videos, loading }) {
  const allFailed = !loading && !channelData && (!Array.isArray(clips) || clips.length === 0) && (!Array.isArray(videos) || videos.length === 0);

  const cells = useMemo(() => {
    const followersRaw = channelData?.followers;
    const followers = followersRaw != null ? formatCount(followersRaw) : null;
    const clipCount = formatListCount(clips);
    const vodCount = formatListCount(videos);

    let lastLive;
    if (isLive) {
      lastLive = 'LIVE NOW';
    } else if (Array.isArray(videos) && videos.length > 0 && videos[0]?.created_at) {
      lastLive = formatRelativeTime(videos[0].created_at);
    } else {
      lastLive = null;
    }

    return [
      { label: 'Followers', value: followers, href: SOCIAL_LINKS.twitch },
      { label: 'Clips', value: clipCount },
      { label: 'Vods', value: vodCount },
      { label: 'Last live', value: lastLive },
    ];
  }, [channelData, clips, videos, isLive]);

  const placeholder = loading ? '···' : '—';

  return (
    <section
      aria-label="Channel stats"
      className="relative border-t border-emerald-signal/15"
    >
      <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-6 sm:px-10 pt-10 sm:pt-12 pb-6 sm:pb-8">
        <div
          className="text-[0.625rem] sm:text-xs font-bold tracking-eyebrow-lg uppercase text-white/45 mb-4 font-mono"
      >
          <span className="inline-block px-1.5 py-0.5 border border-white/30 text-white/70 mr-3 align-middle text-[0.5625rem] tracking-eyebrow">
            GG
          </span>
          CH GG <span className="text-white/30 mx-1">·</span> All-night broadcast
        </div>
      </div>

      <div className="relative bg-zinc-card/70 border-y border-white/5 backdrop-blur-sm overflow-hidden">
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-10 sm:hidden"
          style={{ background: 'linear-gradient(to right, rgba(9,9,11,1), rgba(9,9,11,0))' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10 sm:hidden"
          style={{ background: 'linear-gradient(to left, rgba(9,9,11,1), rgba(9,9,11,0))' }}
          aria-hidden="true"
        />
        <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto sm:flex sm:justify-between sm:divide-x sm:divide-white/5 overflow-x-auto sm:overflow-visible scrollbar-hide motion-safe:sm:overflow-visible">
          <div className="flex sm:flex sm:flex-1 sm:justify-between sm:divide-x sm:divide-white/5 motion-safe:animate-[ticker_28s_linear_infinite] sm:motion-safe:animate-none whitespace-nowrap sm:whitespace-normal">
            {cells.map((cell) => (
              <Cell
                key={cell.label}
                label={cell.label}
                value={cell.value}
                href={cell.href}
                fadingPlaceholder={placeholder}
              />
            ))}
            <div className="sm:hidden flex shrink-0" aria-hidden="true">
              {cells.map((cell) => (
                <Cell
                  key={`dup-${cell.label}`}
                  label={cell.label}
                  value={cell.value}
                  fadingPlaceholder={placeholder}
                />
              ))}
            </div>
          </div>
        </div>

        {allFailed && (
          <div
            className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-6 sm:px-10 pb-3 text-[0.625rem] sm:text-xs font-bold tracking-eyebrow-lg uppercase text-red-destructive font-mono"
      >
            Signal lost
          </div>
        )}
      </div>

      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[ticker_28s_linear_infinite\\] {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}
