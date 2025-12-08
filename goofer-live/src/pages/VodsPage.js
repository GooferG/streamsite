import React, { useState } from 'react';
import { Film } from 'lucide-react';
import VodCard from '../components/VodCard';

export default function VodsPage({ videos, clips, loading }) {
  const [contentType, setContentType] = useState('all');

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
      thumbnail: clip.thumbnail_url,
      url: clip.url,
      type: 'clip',
      date: new Date(clip.created_at),
    })),
  ].sort((a, b) => b.date - a.date);

  const filteredContent =
    contentType === 'all'
      ? allContent
      : allContent.filter((item) => {
          if (contentType === 'vods') return item.type === 'vod';
          if (contentType === 'clips') return item.type === 'clip';
          return item.type === contentType;
        });

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

  return (
    <div className="pt-32 pb-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-purple-400">
              VODS & CLIPS
            </span>
          </h1>
        </div>

        <div className="flex gap-3 mb-12 justify-center flex-wrap">
          <FilterButton
            label="ALL"
            active={contentType === 'all'}
            onClick={() => setContentType('all')}
          />
          <FilterButton
            label="VODS"
            active={contentType === 'vods'}
            onClick={() => setContentType('vods')}
          />
          <FilterButton
            label="CLIPS"
            active={contentType === 'clips'}
            onClick={() => setContentType('clips')}
          />
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            <p className="text-white/60 mt-4">Loading content...</p>
          </div>
        ) : filteredContent.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContent.map((item, index) => (
              <VodCard key={item.id} vod={item} delay={index * 50} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 px-6 bg-gradient-to-br from-emerald-900/10 to-purple-900/10 border border-emerald-500/20 rounded-xl">
            <Film size={48} className="mx-auto mb-4 text-white/40" />
            <p className="text-xl text-white/60 mb-2">
              No {contentType === 'all' ? 'content' : contentType} yet!
            </p>
            <p className="text-white/40">
              Start streaming to build your content library! 🎮
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-2 rounded-lg font-bold text-sm tracking-wider transition-all duration-300 ${
        active
          ? 'bg-gradient-to-r from-emerald-500 to-purple-500 text-white'
          : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
      }`}
    >
      {label}
    </button>
  );
}
