import React from 'react';
import { PlayCircle, Film } from 'lucide-react';

export default function VodCard({ vod, index = 0, onPlay }) {
  const tapeNumber = String(index + 1).padStart(3, '0');
  const typeLabel = vod.type === 'clip' ? 'CLIP' : 'VOD';

  const handlePlay = () => {
    if (!onPlay) return;
    onPlay({
      id: vod.id,
      type: vod.type === 'clip' ? 'clip' : 'vod',
      title: vod.title,
      game: vod.game,
      views: vod.views,
      duration: vod.duration,
      twitchUrl: vod.url,
      tape: tapeNumber,
    });
  };

  return (
    <button
      type="button"
      onClick={handlePlay}
      className="group block text-left w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-signal"
    >
      <div className="relative aspect-video bg-zinc-card border border-white/5 overflow-hidden rounded-md transition-colors duration-200 group-hover:border-emerald-signal/40">
        {vod.thumbnail ? (
          <img
            src={vod.thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-elevated flex items-center justify-center">
            <Film size={32} className="text-white/20" aria-hidden="true" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-broadcast/85 via-zinc-broadcast/10 to-transparent" />

        <div className="absolute top-2 left-2 flex items-center gap-1.5 font-mono">
          <span className="px-1.5 py-0.5 bg-zinc-broadcast/80 text-emerald-bright text-[0.625rem] font-bold tracking-eyebrow-sm">
            #{tapeNumber}
          </span>
          <span
            className={`px-1.5 py-0.5 text-[0.625rem] font-bold tracking-eyebrow ${
              vod.type === 'clip'
                ? 'bg-zinc-broadcast/80 text-purple-bright border border-purple-gamba/50'
                : 'bg-zinc-broadcast/80 text-white-body border border-white/30'
            }`}
          >
            {typeLabel}
          </span>
        </div>

        <div className="absolute top-2 right-2 px-2 py-0.5 border border-white/30 text-white/80 text-[0.625rem] font-bold tracking-eyebrow-xs bg-zinc-broadcast/60 font-mono">
          {vod.duration}
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <PlayCircle size={48} className="text-emerald-bright" strokeWidth={1.25} />
        </div>
      </div>

      <div className="mt-2 bg-zinc-card border border-white/5 border-t-0 px-3 py-2.5 transition-colors duration-200 group-hover:bg-zinc-elevated rounded-b-md">
        <h3 className="text-sm font-bold text-white-body line-clamp-2 leading-snug mb-1.5">
          {vod.title}
        </h3>
        <div className="flex items-center justify-between gap-3 text-[0.625rem] font-bold tracking-eyebrow-xs uppercase">
          <span className="truncate text-white/55">{vod.game}</span>
          <span className="shrink-0 text-emerald-bright tabular-nums font-mono">
            {vod.views}
          </span>
        </div>
      </div>
    </button>
  );
}
