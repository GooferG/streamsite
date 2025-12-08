import React from 'react';
import { Film } from 'lucide-react';

export default function VodCard({ vod, delay }) {
  return (
    <a
      href={vod.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group cursor-pointer block"
      style={{ animation: `slideUp 0.6s ease-out ${delay}ms backwards` }}
    >
      <div className="relative aspect-video bg-gradient-to-br from-emerald-900/50 to-purple-900/50 rounded-lg overflow-hidden border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 mb-3">
        {vod.thumbnail && (
          <img
            src={vod.thumbnail}
            alt={vod.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-300" />

        <div className="absolute inset-0 flex items-center justify-center">
          <Film
            size={56}
            className="text-white/80 group-hover:text-emerald-400 group-hover:scale-110 transition-all duration-300"
          />
        </div>

        <div className="absolute top-3 right-3 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs font-bold">
          {vod.duration}
        </div>

        <div className="absolute top-3 left-3 px-2 py-1 bg-emerald-500/80 backdrop-blur-sm rounded text-xs font-bold uppercase">
          {vod.type}
        </div>
      </div>

      <h3 className="font-bold mb-2 group-hover:text-emerald-400 transition-colors line-clamp-2">
        {vod.title}
      </h3>
      <div className="flex items-center justify-between text-sm text-white/60">
        <span className="truncate">{vod.game}</span>
        <span>{vod.views} views</span>
      </div>
    </a>
  );
}
