import React, { useState, useEffect } from 'react';
import { Calendar, Twitch, Youtube, Twitter, Eye, Film, Users, PlayCircle } from 'lucide-react';
import { SOCIAL_LINKS } from '../constants';
import SocialButton from '../components/SocialButton';
import ClipCard from '../components/ClipCard';
import StatCard from '../components/StatCard';

export default function HomePage({
  setPage,
  channelData,
  isLive,
  streamData,
  loading,
  clips,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animation: 'glow 8s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animation: 'glow 10s ease-in-out infinite 2s' }}
        />

        <div
          className={`relative z-10 text-center px-6 transition-all duration-1000 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}
        >
          {!loading && (
            <div className="mb-6 inline-block">
              {isLive ? (
                <div className="flex items-center gap-3 px-5 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full backdrop-blur-sm">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-sm font-bold tracking-wider text-emerald-400">
                    LIVE NOW
                  </span>
                  {streamData?.viewers && (
                    <>
                      <div className="w-1 h-1 bg-white/30 rounded-full" />
                      <div className="flex items-center gap-1.5">
                        <Eye size={14} className="text-emerald-400" />
                        <span className="text-sm font-bold tracking-wider text-emerald-400">
                          {streamData.viewers}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 px-5 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm">
                  <div className="w-2 h-2 bg-white/40 rounded-full" />
                  <span className="text-sm font-bold tracking-wider text-white/60">
                    OFFLINE
                  </span>
                </div>
              )}
            </div>
          )}

          <h1
            className="text-8xl md:text-9xl font-black tracking-tighter mb-6"
            style={{
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              textShadow: '0 0 80px rgba(16, 185, 129, 0.3)',
            }}
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-emerald-200 to-emerald-500">
              GOOFER
            </span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-emerald-400 via-purple-400 to-purple-600">
              LIVE
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-white/60 mb-12 max-w-2xl mx-auto font-light tracking-wide">
            Gaming • Gambling • Just Chatting • Vibes
          </p>

          <div className="flex gap-4 justify-center mb-16">
            <SocialButton
              icon={<Twitch size={20} />}
              label="Twitch"
              color="purple"
              href={SOCIAL_LINKS.twitch}
            />
            <SocialButton
              icon={<Youtube size={20} />}
              label="YouTube"
              color="red"
              href={SOCIAL_LINKS.youtube}
            />
            <SocialButton
              icon={<Twitter size={20} />}
              label="Twitter"
              color="blue"
              href={SOCIAL_LINKS.twitter}
            />
          </div>

          <button
            onClick={() => setPage('schedule')}
            className="group relative px-8 py-4 text-lg font-bold tracking-wider overflow-hidden rounded-lg"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-purple-500 transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
            <span className="relative flex items-center gap-2">
              <Calendar size={20} />
              VIEW SCHEDULE
            </span>
          </button>
        </div>
      </section>

      {/* Featured Clips Section */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-5xl font-black tracking-tighter">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-emerald-400">
                FEATURED CLIPS
              </span>
            </h2>
            {hasClips && (
              <button
                onClick={() => setPage('vods')}
                className="text-sm font-bold tracking-wider text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-2 group"
              >
                VIEW ALL
                <span className="transform group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-white/60 mt-4">Loading clips...</p>
            </div>
          ) : hasClips ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredClips.map((clip, index) => (
                <ClipCard key={clip.id} clip={clip} delay={index * 100} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 px-6 bg-gradient-to-br from-emerald-900/10 to-purple-900/10 border border-emerald-500/20 rounded-xl">
              <Film size={48} className="mx-auto mb-4 text-white/40" />
              <p className="text-xl text-white/60 mb-2">No clips yet!</p>
              <p className="text-white/40">
                Start streaming and create some awesome moments to clip! 🎮
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-24 px-6 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard
            number={loading ? '...' : channelData?.followers || '0'}
            label="FOLLOWERS"
            icon={<Users size={24} />}
          />
          <StatCard number="150+" label="STREAMS" icon={<Twitch size={24} />} />
          <StatCard number="500+" label="CLIPS" icon={<Film size={24} />} />
          <StatCard
            number="24/7"
            label="VIBES"
            icon={<PlayCircle size={24} />}
          />
        </div>
      </section>
    </div>
  );
}
