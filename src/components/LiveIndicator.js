import { Twitch, Eye } from 'lucide-react';
import { SOCIAL_LINKS } from '../constants';

export default function LiveIndicator({ isLive, streamData }) {
  if (!isLive) return null;

  return (
    <a
      href={SOCIAL_LINKS.twitch}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 group"
    >
      <div className="relative">
        {/* Pulsing glow effect */}
        <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-50 animate-pulse" />

        {/* Main button */}
        <div className="relative flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full shadow-2xl transform transition-all duration-300 group-hover:scale-105 group-hover:from-emerald-400 group-hover:to-emerald-500">
          {/* Animated live dot */}
          <div className="relative">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-white rounded-full animate-ping" />
          </div>

          {/* Text */}
          <div className="flex flex-col">
            <span className="text-white font-black text-sm tracking-wider uppercase">
              Goofer LIVE Now
            </span>
            {streamData?.viewers && (
              <div className="flex items-center gap-1.5 text-white/90 text-xs font-bold">
                <Eye size={12} />
                <span>{streamData.viewers} watching</span>
              </div>
            )}
          </div>

          {/* Twitch icon */}
          <Twitch size={24} className="text-white" />
        </div>
      </div>
    </a>
  );
}
