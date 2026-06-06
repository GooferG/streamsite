import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink } from 'lucide-react';

function buildEmbedUrl({ type, id }) {
  const parent = window.location.hostname;
  if (type === 'clip') {
    return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(
      id
    )}&parent=${parent}&autoplay=true`;
  }
  // vod / video
  return `https://player.twitch.tv/?video=${encodeURIComponent(
    id
  )}&parent=${parent}&autoplay=true`;
}

export default function VideoModal({ video, onClose }) {
  const closeBtnRef = useRef(null);

  // Lock body scroll while open, restore on close
  useEffect(() => {
    if (!video) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [video]);

  // ESC to close + focus management
  useEffect(() => {
    if (!video) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    // Focus the close button so ESC + tab work predictably
    closeBtnRef.current?.focus();
    return () => document.removeEventListener('keydown', handler);
  }, [video, onClose]);

  if (!video) return null;

  const isClip = video.type === 'clip';
  const typeLabel = isClip ? 'CLIP' : 'VOD';
  const tape = video.tape || '001';

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-zinc-broadcast/85 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${typeLabel} player — ${video.title}`}
    >
      <div
        className="relative w-full max-w-5xl border border-white/10 bg-zinc-card overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status bar */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 border-b border-white/8 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono">
          <span className="inline-flex items-center gap-2 text-emerald-signal">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-signal motion-safe:animate-ping opacity-50" />
              <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-signal" />
            </span>
            <span>Now playing</span>
          </span>
          <span className="text-white/15">·</span>
          <span className="text-white/45">TAPE</span>
          <span className="text-white/70 tabular-nums tracking-eyebrow-lg">
            #{tape}
          </span>
          <span className="text-white/15">·</span>
          <span
            className={`tracking-eyebrow-lg ${
              isClip ? 'text-purple-bright' : 'text-white-body'
            }`}
          >
            {typeLabel}
          </span>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex items-center gap-2 px-2.5 py-1.5 border border-white/10 text-white/65 hover:text-white-body hover:border-white/25 transition-colors duration-150"
            aria-label="Close player"
          >
            <X size={12} aria-hidden="true" />
            <span className="text-[0.625rem] tracking-eyebrow-lg">ESC</span>
          </button>
        </div>

        {/* Player */}
        <div className="relative w-full aspect-video bg-zinc-broadcast">
          <iframe
            src={buildEmbedUrl(video)}
            title={video.title || 'Twitch player'}
            className="absolute inset-0 w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          />
        </div>

        {/* Info + action strip */}
        <div className="px-4 sm:px-5 py-4 border-t border-white/8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {video.title && (
              <h3 className="text-base sm:text-lg font-bold text-white-body leading-snug tracking-tight line-clamp-2">
                {video.title}
              </h3>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.625rem] font-bold uppercase tracking-eyebrow-md font-mono text-white/45">
              {video.game && (
                <>
                  <span>Game</span>
                  <span className="text-white/75 tracking-eyebrow">
                    {video.game}
                  </span>
                </>
              )}
              {video.views != null && (
                <>
                  <span className="text-white/15">·</span>
                  <span>Views</span>
                  <span className="text-emerald-signal tabular-nums tracking-eyebrow">
                    {video.views}
                  </span>
                </>
              )}
              {video.duration && (
                <>
                  <span className="text-white/15">·</span>
                  <span>Length</span>
                  <span className="text-white/75 tabular-nums tracking-eyebrow">
                    {video.duration}
                  </span>
                </>
              )}
            </div>
          </div>

          {video.twitchUrl && (
            <a
              href={video.twitchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-white/10 text-white/70 hover:text-emerald-signal hover:border-emerald-signal/40 transition-colors duration-150"
            >
              <ExternalLink size={12} aria-hidden="true" />
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
                Watch on Twitch
              </span>
            </a>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
