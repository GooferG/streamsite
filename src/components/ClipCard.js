import React, { useState } from 'react';
import { PlayCircle } from 'lucide-react';

export default function ClipCard({ clip, delay }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href={clip.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group cursor-pointer block"
      style={{ animation: `slideUp 0.6s ease-out ${delay}ms backwards` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-video bg-gradient-to-br from-emerald-900/50 to-purple-900/50 rounded-lg overflow-hidden border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300">
        {clip.thumbnail && (
          <img
            src={clip.thumbnail}
            alt={clip.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-300" />

        <div className="absolute inset-0 flex items-center justify-center">
          <PlayCircle
            size={48}
            className={`text-white/80 group-hover:text-emerald-400 transition-all duration-300 ${
              isHovered ? 'scale-110' : 'scale-100'
            }`}
          />
        </div>

        <div className="absolute top-3 right-3 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs font-bold">
          {clip.duration}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
          <h3 className="font-bold mb-1 text-sm line-clamp-2">{clip.title}</h3>
          <div className="flex items-center justify-between text-xs text-white/60">
            <span className="truncate">{clip.game}</span>
            <span>{clip.views} views</span>
          </div>
        </div>
      </div>
    </a>
  );
}
