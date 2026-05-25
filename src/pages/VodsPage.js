import React, { useState, useEffect } from 'react';
import { Film } from 'lucide-react';
import VodCard from '../components/VodCard';

function useNowTimestamp() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatTimecode(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function ScanlineOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden"
      aria-hidden="true"
      style={{
        backgroundImage:
          'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
      }}
    />
  );
}

function FilterTab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`group inline-flex items-baseline gap-2 px-1 py-2 border-b-2 transition-colors duration-200 ${
        active
          ? 'border-emerald-signal text-white-body'
          : 'border-transparent text-white/45 hover:text-white/75 hover:border-white/20'
      }`}
    >
      <span
        className="text-[11px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
        {label}
      </span>
      <span
        className={`text-[10px] tabular-nums tracking-eyebrow-sm ${
          active ? 'text-emerald-signal' : 'text-white/30'
        } font-mono`}
      >
        {String(count).padStart(3, '0')}
      </span>
    </button>
  );
}

function formatDuration(duration) {
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
}

export default function VodsPage({ videos, clips, loading }) {
  const [contentType, setContentType] = useState('all');
  const now = useNowTimestamp();

  const allContent = [
    ...videos.map((video) => ({
      id: video.id,
      title: video.title,
      game: video.game_name || 'Various',
      duration: formatDuration(video.duration),
      views:
        video.view_count >= 1000
          ? `${(video.view_count / 1000).toFixed(1)}K`
          : video.view_count.toString(),
      thumbnail: video.thumbnail_url
        .replace('%{width}', '440')
        .replace('%{height}', '248'),
      url: video.url,
      type: 'vod',
      date: new Date(video.created_at),
    })),
    ...clips.map((clip) => ({
      id: clip.id,
      title: clip.title,
      game: clip.game_name || 'Various',
      duration: Math.floor(clip.duration) + 's',
      views:
        clip.view_count >= 1000
          ? `${(clip.view_count / 1000).toFixed(1)}K`
          : clip.view_count.toString(),
      thumbnail: clip.thumbnail,
      url: clip.url,
      type: 'clip',
      date: new Date(clip.created_at),
    })),
  ].sort((a, b) => b.date - a.date);

  const counts = {
    all: allContent.length,
    vods: allContent.filter((i) => i.type === 'vod').length,
    clips: allContent.filter((i) => i.type === 'clip').length,
  };

  const filteredContent =
    contentType === 'all'
      ? allContent
      : allContent.filter((item) => {
          if (contentType === 'vods') return item.type === 'vod';
          if (contentType === 'clips') return item.type === 'clip';
          return item.type === contentType;
        });

  return (
    <div className="relative pt-32 pb-32 px-6 sm:px-10">
      <ScanlineOverlay />

      <div className="relative max-w-7xl mx-auto">
        {/* Slate header */}
        <header className="mb-12 sm:mb-16">
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-eyebrow-lg text-white/45 mb-6 font-mono"
      >
            <span className="inline-flex items-center gap-2">
              <Film size={11} className="text-emerald-signal" aria-hidden="true" />
              <span className="text-emerald-signal">ARCHIVE</span>
            </span>
            <span className="text-white/20">·</span>
            <span>TAPE LIBRARY</span>
            <span className="text-white/20">·</span>
            <span className="text-white/30 tabular-nums">
              {String(counts.all).padStart(3, '0')} REELS
            </span>
          </div>

          <h1
            className="font-black leading-[0.82] tracking-[-0.035em] text-white-body select-none"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: 'clamp(3rem, 10vw, 6.5rem)',
            }}
          >
            <span className="block">Vods and</span>
            <span className="block text-emerald-signal">clips.</span>
          </h1>

          <div
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-eyebrow text-white/45 font-mono"
      >
            <span>
              Sort · <span className="text-white/70">Newest first</span>
            </span>
            <span className="text-white/15">·</span>
            <span>
              Source · <span className="text-white/70">Twitch</span>
            </span>
            <span className="text-white/15">·</span>
            <span>
              Now · <span className="text-emerald-signal tabular-nums">{formatTimecode(now)}</span>
            </span>
          </div>
        </header>

        {/* Filter tabs */}
        <div className="mb-10 border-b border-white/8">
          <div className="flex gap-8">
            <FilterTab
              label="All"
              count={counts.all}
              active={contentType === 'all'}
              onClick={() => setContentType('all')}
            />
            <FilterTab
              label="Vods"
              count={counts.vods}
              active={contentType === 'vods'}
              onClick={() => setContentType('vods')}
            />
            <FilterTab
              label="Clips"
              count={counts.clips}
              active={contentType === 'clips'}
              onClick={() => setContentType('clips')}
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-video bg-zinc-card border border-white/5 rounded-md animate-pulse" />
                <div className="mt-2 bg-zinc-card border border-white/5 border-t-0 rounded-b-md h-16 animate-pulse" />
              </div>
            ))}
          </div>
        ) : filteredContent.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContent.map((item, index) => (
              <VodCard key={item.id} vod={item} index={index} />
            ))}
          </div>
        ) : (
          <div className="border border-white/8 bg-zinc-card/40 px-6 py-12 flex items-center justify-between gap-6">
            <div>
              <div
                className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/40 mb-2 font-mono"
      >
                Empty reel
              </div>
              <p className="text-base text-white/70">
                No {contentType === 'all' ? 'tapes' : contentType} on file.
              </p>
              <p className="text-sm text-white/40 mt-1">
                Check back after the next broadcast.
              </p>
            </div>
            <Film size={36} className="text-white/20 shrink-0" aria-hidden="true" />
          </div>
        )}

        {/* Footer */}
        <footer
          className="mt-16 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-[10px] uppercase tracking-eyebrow-lg text-white/30 font-mono"
      >
          <span>END OF INDEX</span>
          <span className="text-white/15">·</span>
          <span className="text-white/50 tabular-nums">
            {String(filteredContent.length).padStart(3, '0')} OF{' '}
            {String(counts.all).padStart(3, '0')} REELS SHOWN
          </span>
          <span className="text-white/15">·</span>
          <span className="text-emerald-signal/70 tabular-nums">{formatTimecode(now)}</span>
        </footer>
      </div>
    </div>
  );
}
