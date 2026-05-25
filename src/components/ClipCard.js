import { PlayCircle } from 'lucide-react';

export default function ClipCard({ clip, index = 0, onPlay }) {
  const tapeNumber = String(index + 1).padStart(3, '0');

  const handlePlay = () => {
    if (!onPlay) return;
    onPlay({
      id: clip.id,
      type: 'clip',
      title: clip.title,
      game: clip.game,
      views: clip.views,
      duration: clip.duration,
      twitchUrl: clip.url,
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
        {clip.thumbnail ? (
          <img
            src={clip.thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-elevated" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-broadcast/85 via-zinc-broadcast/10 to-transparent" />

        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-zinc-broadcast/80 text-emerald-signal text-[10px] font-bold font-mono tracking-eyebrow-sm">
          #{tapeNumber}
        </div>

        <div className="absolute top-2 right-2 px-2 py-0.5 border border-white/30 text-white/80 text-[10px] font-bold font-mono tracking-eyebrow-xs bg-zinc-broadcast/60">
          {clip.duration}
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <PlayCircle size={42} className="text-emerald-bright" strokeWidth={1.5} />
        </div>
      </div>

      <div className="mt-2 bg-zinc-card border border-white/5 border-t-0 px-3 py-2.5 transition-colors duration-200 group-hover:bg-zinc-elevated rounded-b-md">
        <h3 className="text-sm font-bold text-white-body line-clamp-2 leading-snug mb-1.5">
          {clip.title}
        </h3>
        <div className="flex items-center justify-between gap-3 text-[10px] font-bold tracking-eyebrow-xs uppercase">
          <span className="truncate text-white/55">{clip.game}</span>
          <span className="shrink-0 text-emerald-signal tabular-nums font-mono">
            {clip.views}
          </span>
        </div>
      </div>
    </button>
  );
}
