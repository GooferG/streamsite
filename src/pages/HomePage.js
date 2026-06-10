import React from 'react';
import { Twitch, Film, PlayCircle } from 'lucide-react';
import { SOCIAL_LINKS } from '../constants';
import ClipCard from '../components/ClipCard';
import SteamGames from '../components/SteamGames';
import HomeHero from '../components/HomeHero';
import StatsTicker from '../components/StatsTicker';
import SectionHeader from '../components/SectionHeader';
import HomeGambaTools from '../components/HomeGambaTools';
import WelcomeSignOn from '../components/WelcomeSignOn';
import HomeLeaderboardCallout from '../components/HomeLeaderboardCallout';
import VideoModal from '../components/VideoModal';
import SectionDivider from '../components/SectionDivider';
import SignOff from '../components/SignOff';
import { useVideoModal } from '../hooks/useVideoModal';

function ViewAllLink({ onClick, label, accent = 'emerald' }) {
  const color =
    accent === 'white'
      ? 'text-white/70 hover:text-white-body'
      : 'text-emerald-bright hover:text-emerald-bright';
  return (
    <button
      onClick={onClick}
      type="button"
      className={`text-xs sm:text-sm font-bold tracking-eyebrow-sm uppercase transition-colors duration-200 flex items-center gap-2 group ${color}`}
    >
      {label}
      <span
        aria-hidden="true"
        className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
      >
        →
      </span>
    </button>
  );
}

export default function HomePage({
  setPage,
  channelData,
  isLive,
  streamData,
  loading,
  clips,
  videos,
  introDone,
}) {
  const { current, open, close } = useVideoModal();

  const featuredClips = clips.slice(0, 4).map((clip) => ({
    id: clip.id,
    title: clip.title,
    game: clip.game_name || 'Various',
    views:
      clip.view_count >= 1000
        ? `${(clip.view_count / 1000).toFixed(1)}K`
        : clip.view_count.toString(),
    duration: Math.floor(clip.duration) + 's',
    thumbnail: clip.thumbnail_url,
    url: clip.url,
  }));

  const hasClips = featuredClips.length > 0;

  // Get the latest VOD
  const latestVod = videos && videos.length > 0 ? videos[0] : null;

  // Broadcast-rundown segment numbers, assigned in render order so the
  // count always starts at 01 and never skips. Steam goes last because it
  // hides itself when the API errors; absence truncates the rundown instead
  // of leaving a gap.
  let segCounter = 0;
  const nextSegment = () => String(++segCounter).padStart(2, '0');
  const liveSegment = isLive && !loading ? nextSegment() : null;
  const gambaSegment = nextSegment();
  const vodSegment = !loading && latestVod ? nextSegment() : null;
  const clipsSegment = nextSegment();
  const steamSegment = nextSegment();

  const formatDuration = (duration) => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;

    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <WelcomeSignOn introDone={introDone} />
      <HomeHero
        isLive={isLive}
        streamData={streamData}
        loading={loading}
        hasError={false}
        onNavigate={setPage}
        clips={clips}
      />

      {/* Live Stream Embed - Only shown when live */}
      {isLive && !loading && (
        <section className="py-16 px-6 sm:px-10">
          <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto">
            <SectionHeader
              segment={liveSegment}
              eyebrow={`On air now${streamData?.viewers ? ` · ${streamData.viewers} watching` : ''}`}
              title="The broadcast"
              accent="emerald"
              action={
                <a
                  href={SOCIAL_LINKS.twitch}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs sm:text-sm font-bold tracking-eyebrow-sm uppercase text-emerald-bright hover:text-emerald-bright transition-colors duration-200 flex items-center gap-2 group"
                >
                  <Twitch size={14} aria-hidden="true" />
                  Open in twitch
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </a>
              }
            />

            {streamData?.title && (
              <p className="text-white/65 text-base sm:text-lg max-w-3xl mb-6 leading-relaxed">
                {streamData.title}
              </p>
            )}

            <div className="relative w-full aspect-video overflow-hidden border border-emerald-signal/25 bg-zinc-broadcast rounded-md">
              <iframe
                src={`https://player.twitch.tv/?channel=GooferG&parent=${window.location.hostname}&muted=false`}
                height="100%"
                width="100%"
                allowFullScreen
                title="Twitch Live Stream"
                className="absolute inset-0"
              />
            </div>
          </div>
        </section>
      )}

      <SectionDivider />

      <HomeLeaderboardCallout />

      <SectionDivider />

      <HomeGambaTools setPage={setPage} segment={gambaSegment} />

      {/* Latest VOD Section */}
      {!loading && latestVod && (
        <section className="py-16 px-6 sm:px-10 bg-zinc-card/40 border-y border-white/5">
          <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto">
            <SectionHeader
              segment={vodSegment}
              eyebrow="Tape index · Most recent"
              title="Latest vod"
              accent="white"
              action={
                <ViewAllLink
                  onClick={() => setPage('vods')}
                  label="All vods"
                  accent="white"
                />
              }
            />

            <button
              type="button"
              onClick={() =>
                open({
                  id: latestVod.id,
                  type: 'vod',
                  title: latestVod.title,
                  game: latestVod.game_name || 'Various',
                  views:
                    latestVod.view_count >= 1000
                      ? `${(latestVod.view_count / 1000).toFixed(1)}K`
                      : String(latestVod.view_count),
                  duration: formatDuration(latestVod.duration),
                  twitchUrl: latestVod.url,
                  tape: '001',
                })
              }
              className="group block text-left w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-signal"
            >
              <div className="grid lg:grid-cols-[1.6fr_1fr] gap-0 bg-zinc-card border border-white/5 rounded-md overflow-hidden transition-colors duration-200 group-hover:border-emerald-signal/30">
                <div className="relative aspect-video lg:aspect-auto bg-zinc-broadcast border-b lg:border-b-0 lg:border-r border-white/5">
                  <img
                    src={latestVod.thumbnail_url
                      .replace('%{width}', '1280')
                      .replace('%{height}', '720')}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-broadcast/70 via-transparent to-transparent" />

                  <div
                    className="absolute top-3 left-3 px-1.5 py-0.5 bg-zinc-broadcast/80 text-emerald-bright text-[0.625rem] font-bold tracking-eyebrow-sm font-mono"
      >
                    #001
                  </div>
                  <div
                    className="absolute top-3 right-3 px-2 py-0.5 border border-white/30 text-white/80 text-[0.625rem] font-bold tracking-eyebrow-xs bg-zinc-broadcast/60 font-mono"
      >
                    {formatDuration(latestVod.duration)}
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <PlayCircle size={56} className="text-emerald-bright" strokeWidth={1.25} />
                  </div>
                </div>

                <div className="p-6 sm:p-8 flex flex-col justify-center">
                  <h3 className="text-xl sm:text-2xl font-bold text-white-body leading-snug line-clamp-3 mb-4">
                    {latestVod.title}
                  </h3>
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.6875rem] font-bold tracking-eyebrow uppercase">
                    <span className="text-white/40">Game</span>
                    <span className="text-white/85 truncate normal-case tracking-normal font-bold">
                      {latestVod.game_name || 'Various'}
                    </span>
                    <span className="text-white/40">Views</span>
                    <span
                      className="text-emerald-bright tabular-nums tracking-normal font-mono"
      >
                      {latestVod.view_count >= 1000
                        ? `${(latestVod.view_count / 1000).toFixed(1)}K`
                        : latestVod.view_count}
                    </span>
                    <span className="text-white/40">Aired</span>
                    <span
                      className="text-white/70 tabular-nums tracking-normal font-mono"
      >
                      {new Date(latestVod.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </section>
      )}

      <SectionDivider />

      {/* Featured Clips Section */}
      <section className="py-16 px-6 sm:px-10">
        <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto">
          <SectionHeader
            segment={clipsSegment}
            eyebrow="Tape index · Highlights"
            title="Featured clips"
            accent="emerald"
            action={
              hasClips ? (
                <ViewAllLink
                  onClick={() => setPage('vods')}
                  label="All clips"
                  accent="emerald"
                />
              ) : null
            }
          />

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-video bg-zinc-card border border-white/5 rounded-md" />
              ))}
            </div>
          ) : hasClips ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredClips.map((clip, index) => (
                <ClipCard key={clip.id} clip={clip} index={index} onPlay={open} />
              ))}
            </div>
          ) : (
            <div className="border border-white/5 bg-zinc-card rounded-md px-6 py-10 flex items-center justify-between gap-6">
              <div>
                <div
                  className="text-[0.625rem] font-bold tracking-eyebrow uppercase text-white/40 mb-1 font-mono"
      >
                  Tape index
                </div>
                <div className="text-base text-white/70">No tapes filed yet. Check back after the next broadcast.</div>
              </div>
              <Film size={28} className="text-white/25 shrink-0" aria-hidden="true" />
            </div>
          )}
        </div>
      </section>

      {/* Steam Games Section — last numbered segment; hides itself on error */}
      <SteamGames segment={steamSegment} withDivider />

      <StatsTicker
        channelData={channelData}
        streamData={streamData}
        isLive={isLive}
        clips={clips}
        videos={videos}
        loading={loading}
      />

      <SignOff onSchedule={() => setPage('schedule')} />

      <VideoModal video={current} onClose={close} />
    </div>
  );
}
