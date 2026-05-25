import { useEffect, useMemo, useState } from 'react';
import { Eye, Clock, PlayCircle, Film } from 'lucide-react';
import { useSchedule } from '../hooks/useSchedule';
import { getGameCover } from '../utils/igdbApi';
import { SOCIAL_LINKS } from '../constants';

const DAYS_OF_WEEK = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRY-DAY',
  'SATURDAY',
];

function formatViewerCount(n) {
  if (n == null) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function resolveTwitchThumbnail(url) {
  if (!url) return null;
  return url.replace('{width}', '1280').replace('{height}', '720');
}

function TestPattern() {
  return (
    <svg
      viewBox="0 0 800 450"
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
      aria-hidden="true"
      role="presentation"
    >
      <rect width="800" height="450" fill="#09090b" />
      <g>
        <rect x="0" y="0" width="114" height="320" fill="#fafafa" opacity="0.9" />
        <rect x="114" y="0" width="114" height="320" fill="#f97316" />
        <rect x="228" y="0" width="114" height="320" fill="#a855f7" />
        <rect x="342" y="0" width="114" height="320" fill="#10b981" />
        <rect x="456" y="0" width="114" height="320" fill="#ef4444" />
        <rect x="570" y="0" width="114" height="320" fill="#27272a" />
        <rect x="684" y="0" width="116" height="320" fill="#fafafa" opacity="0.7" />
      </g>
      <g>
        <rect x="0" y="320" width="200" height="50" fill="#27272a" />
        <rect x="200" y="320" width="200" height="50" fill="#18181b" />
        <rect x="400" y="320" width="200" height="50" fill="#27272a" />
        <rect x="600" y="320" width="200" height="50" fill="#18181b" />
      </g>
      <g>
        <rect x="0" y="370" width="80" height="80" fill="#18181b" />
        <rect x="80" y="370" width="80" height="80" fill="#27272a" />
        <rect x="160" y="370" width="80" height="80" fill="#18181b" />
        <rect x="240" y="370" width="80" height="80" fill="#27272a" />
        <rect x="320" y="370" width="80" height="80" fill="#18181b" />
        <rect x="400" y="370" width="80" height="80" fill="#27272a" />
        <rect x="480" y="370" width="80" height="80" fill="#18181b" />
        <rect x="560" y="370" width="80" height="80" fill="#27272a" />
        <rect x="640" y="370" width="80" height="80" fill="#18181b" />
        <rect x="720" y="370" width="80" height="80" fill="#27272a" />
      </g>
      <g>
        <circle cx="400" cy="225" r="120" fill="none" stroke="#fafafa" strokeOpacity="0.06" strokeWidth="2" />
        <line x1="0" y1="225" x2="800" y2="225" stroke="#fafafa" strokeOpacity="0.04" strokeWidth="1" />
        <line x1="400" y1="0" x2="400" y2="450" stroke="#fafafa" strokeOpacity="0.04" strokeWidth="1" />
      </g>
      <text
        x="400"
        y="230"
        textAnchor="middle"
        fill="#fafafa"
        fillOpacity="0.7"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="700"
        fontSize="42"
        letterSpacing="6"
      >
        OFF AIR
      </text>
    </svg>
  );
}

function ChannelBug() {
  return (
    <div
      className="inline-flex items-center justify-center px-2 py-1 border border-white/40 text-white-body text-[11px] font-bold tracking-eyebrow"
      style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
    >
      GG
    </div>
  );
}

function StatePill({ isLive, viewers, loading }) {
  if (loading) {
    return (
      <div className="inline-flex items-center gap-3 px-5 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm opacity-0">
        <span className="w-2 h-2 rounded-full bg-transparent" />
        <span className="text-sm font-bold tracking-wider">TUNING</span>
      </div>
    );
  }
  if (isLive) {
    return (
      <a
        href={SOCIAL_LINKS.twitch}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-3 px-5 py-2 bg-emerald-signal/10 border border-emerald-signal/30 rounded-full backdrop-blur-sm hover:bg-emerald-signal/15 transition-colors duration-300"
        aria-label="Open Goofer's live stream on Twitch"
      >
        <span className="relative flex items-center justify-center w-2 h-2">
          <span className="absolute inset-0 rounded-full bg-emerald-bright motion-safe:animate-ping opacity-60" />
          <span className="relative w-2 h-2 rounded-full bg-emerald-bright" />
        </span>
        <span className="text-sm font-bold tracking-wider text-emerald-bright">
          LIVE
        </span>
        {viewers != null && (
          <>
            <span className="w-px h-3 bg-emerald-bright/40" />
            <span className="inline-flex items-center gap-1.5 text-sm font-bold tracking-wider text-emerald-bright tabular-nums">
              <Eye size={14} aria-hidden="true" />
              {formatViewerCount(viewers)}
            </span>
          </>
        )}
      </a>
    );
  }
  return (
    <div
      className="inline-flex items-center gap-3 px-5 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm"
      role="status"
    >
      <span className="w-2 h-2 rounded-full bg-white/40" />
      <span className="text-sm font-bold tracking-wider text-white/60">
        OFF AIR
      </span>
    </div>
  );
}

function LiveCenter({ streamData }) {
  const thumb = resolveTwitchThumbnail(streamData?.thumbnail_url);
  const title = streamData?.title;
  const game = streamData?.game_name;

  return (
    <div className="w-full max-w-3xl">
      <a
        href={SOCIAL_LINKS.twitch}
        target="_blank"
        rel="noopener noreferrer"
        className="group block relative aspect-video w-full overflow-hidden rounded-xl border border-emerald-signal/20 bg-zinc-card transition-colors duration-300 hover:border-emerald-signal/50"
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-90 transition-opacity duration-500 group-hover:opacity-100"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-broadcast via-zinc-broadcast/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          {game && (
            <div className="text-[11px] font-bold tracking-eyebrow-sm text-emerald-bright uppercase mb-1.5">
              Now playing &middot; {game}
            </div>
          )}
          {title && (
            <h2 className="text-lg sm:text-xl font-bold text-white-body leading-snug line-clamp-2">
              {title}
            </h2>
          )}
          <div className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-signal text-zinc-broadcast rounded-md text-sm font-bold tracking-wider uppercase transition-colors duration-300 group-hover:bg-emerald-bright">
            <PlayCircle size={16} aria-hidden="true" />
            Watch on Twitch
          </div>
        </div>
      </a>
    </div>
  );
}

function NextCenter({ nextStream, gameCover, onBrowseVods }) {
  return (
    <div className="w-full max-w-3xl">
      <div className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-card">
        <div className="grid grid-cols-[auto_1fr] gap-5 sm:gap-7 p-5 sm:p-7">
          <div className="w-24 sm:w-32 aspect-[3/4] overflow-hidden rounded-lg bg-zinc-elevated">
            {gameCover ? (
              <img
                src={gameCover}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30">
                <Film size={28} aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <div className="text-[11px] font-bold tracking-eyebrow text-emerald-bright uppercase mb-2">
              Next on this channel
            </div>
            <div className="flex items-baseline gap-3 flex-wrap mb-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-white-body">
                {nextStream.day}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold tracking-wider text-white/70">
                <Clock size={14} aria-hidden="true" />
                {nextStream.time}
              </span>
            </div>
            <p className="text-sm sm:text-base text-white/80 line-clamp-2">
              {nextStream.gameName || nextStream.content}
            </p>
            {nextStream.status === 'special' && (
              <div className="mt-3 inline-block self-start px-2.5 py-1 border border-purple-gamba/40 text-[11px] font-bold tracking-eyebrow-sm text-purple-bright uppercase">
                Special
              </div>
            )}
            <button
              onClick={onBrowseVods}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-elevated hover:bg-zinc-700 text-white-body rounded-md text-sm font-bold tracking-wider uppercase transition-colors duration-300 self-start"
              type="button"
            >
              <Film size={16} aria-hidden="true" />
              Browse vods
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OffAirCenter({ onBrowseVods }) {
  return (
    <div className="w-full max-w-3xl">
      <div className="relative overflow-hidden rounded-xl border border-white/5">
        <div className="aspect-[16/9] bg-zinc-broadcast">
          <TestPattern />
        </div>
        <div className="px-5 sm:px-7 py-4 bg-zinc-card border-t border-white/5 flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold tracking-eyebrow text-white/50 uppercase">
              Signal
            </div>
            <div className="text-sm sm:text-base font-bold tracking-wide text-white-body">
              Off air, back soon.
            </div>
          </div>
          <button
            onClick={onBrowseVods}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-elevated hover:bg-zinc-700 text-white-body rounded-md text-sm font-bold tracking-wider uppercase transition-colors duration-300"
            type="button"
          >
            <Film size={16} aria-hidden="true" />
            Browse vods
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingCenter() {
  return (
    <div className="w-full max-w-3xl">
      <div className="aspect-video rounded-xl border border-white/5 bg-zinc-card" />
    </div>
  );
}

function ErrorCenter({ onBrowseVods }) {
  return (
    <div className="w-full max-w-3xl">
      <div className="rounded-xl border border-red-destructive/20 bg-zinc-card px-5 sm:px-7 py-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-eyebrow text-red-destructive uppercase mb-1">
            Signal lost
          </div>
          <div className="text-sm sm:text-base text-white/70">
            Refresh, or check the vods.
          </div>
        </div>
        <button
          onClick={onBrowseVods}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-elevated hover:bg-zinc-700 text-white-body rounded-md text-sm font-bold tracking-wider uppercase transition-colors duration-300"
          type="button"
        >
          <Film size={16} aria-hidden="true" />
          Browse vods
        </button>
      </div>
    </div>
  );
}

export default function HomeHero({
  isLive,
  streamData,
  loading,
  hasError,
  onNavigate,
}) {
  const { schedule } = useSchedule();
  const [gameCover, setGameCover] = useState(null);
  const [centerVisible, setCenterVisible] = useState(false);

  const nextStream = useMemo(() => {
    if (!schedule || schedule.length === 0) return null;
    const today = new Date().getDay();
    for (let i = 0; i < 7; i += 1) {
      const dayName = DAYS_OF_WEEK[(today + i) % 7];
      const stream = schedule.find((s) => s.day === dayName);
      if (stream && stream.status !== 'off') return stream;
    }
    return null;
  }, [schedule]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!nextStream?.gameName) {
        setGameCover(null);
        return;
      }
      try {
        const cover = await getGameCover(nextStream.gameName);
        if (!cancelled) setGameCover(cover);
      } catch {
        if (!cancelled) setGameCover(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [nextStream?.gameName]);

  useEffect(() => {
    const t = setTimeout(() => setCenterVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleBrowseVods = () => onNavigate && onNavigate('vods');

  let center;
  if (loading) {
    center = <LoadingCenter />;
  } else if (hasError) {
    center = <ErrorCenter onBrowseVods={handleBrowseVods} />;
  } else if (isLive) {
    center = <LiveCenter streamData={streamData} />;
  } else if (nextStream) {
    center = (
      <NextCenter
        nextStream={nextStream}
        gameCover={gameCover}
        onBrowseVods={handleBrowseVods}
      />
    );
  } else {
    center = <OffAirCenter onBrowseVods={handleBrowseVods} />;
  }

  const viewers = isLive ? streamData?.viewer_count ?? streamData?.viewers : null;

  return (
    <section
      className="relative overflow-hidden -mt-[73px] min-h-[85vh] flex flex-col"
      aria-label="GooferG live status"
    >
      <img
        src="/site_banner_v2.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.18, objectPosition: 'center 30%' }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(9,9,11,0.55) 0%, rgba(9,9,11,0.35) 45%, rgba(9,9,11,0.92) 92%)',
        }}
      />
      <div
        className="absolute top-1/4 -left-24 w-[28rem] h-[28rem] bg-emerald-signal/15 rounded-full blur-3xl pointer-events-none motion-reduce:hidden"
        style={{ animation: 'glow 9s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-1/3 -right-24 w-[28rem] h-[28rem] bg-purple-gamba/15 rounded-full blur-3xl pointer-events-none motion-reduce:hidden"
        style={{ animation: 'glow 11s ease-in-out infinite 2s' }}
      />

      <div className="relative z-10 pt-[140px] sm:pt-[160px] px-6 sm:px-10 flex items-center justify-between">
        <ChannelBug />
        <StatePill isLive={isLive} viewers={viewers} loading={loading} />
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 sm:px-10 py-12 sm:py-16">
        <div
          className={`transition-opacity duration-200 ease-out ${
            centerVisible ? 'opacity-100' : 'opacity-0'
          } w-full flex justify-center`}
        >
          {center}
        </div>
      </div>

      <div className="relative z-10 px-6 sm:px-10 pb-10 sm:pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] items-end gap-y-4 gap-x-10">
          <h1
            className="leading-[0.85] tracking-[-0.04em] font-black select-none"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(3.5rem, 11vw, 8rem)',
            }}
          >
            <span className="block text-white-body">GOOFER</span>
            <span className="block text-emerald-signal">LIVE</span>
          </h1>
          <p className="text-sm sm:text-base text-white/55 max-w-md leading-relaxed sm:pb-3">
            Late-night variety streams, irregular Sundays.
          </p>
        </div>
        <div className="mt-6 h-px bg-gradient-to-r from-emerald-signal/40 via-white/10 to-transparent" />
      </div>
    </section>
  );
}
