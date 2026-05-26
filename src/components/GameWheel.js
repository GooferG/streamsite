import { useState, useRef, useEffect } from 'react';
import { Play, RotateCcw, ImageOff } from 'lucide-react';

export default function GameWheel({ games }) {
  const [spinning, setSpinning] = useState(false);
  const [current, setCurrent] = useState(null);
  const [result, setResult] = useState(null);
  const [imgError, setImgError] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const spin = () => {
    if (spinning || games.length === 0) return;

    setResult(null);
    setSpinning(true);
    setImgError(false);

    const winner = games[Math.floor(Math.random() * games.length)];
    let speed = 50;
    let elapsed = 0;
    const duration = 3000;

    const tick = () => {
      setCurrent(games[Math.floor(Math.random() * games.length)]);
      elapsed += speed;

      if (elapsed < duration) {
        speed = 50 + Math.floor((elapsed / duration) * 250);
        timeoutRef.current = setTimeout(tick, speed);
      } else {
        setCurrent(winner);
        setResult(winner);
        setSpinning(false);
      }
    };

    timeoutRef.current = setTimeout(tick, speed);
  };

  const reset = () => {
    if (spinning) return;
    clearTimeout(timeoutRef.current);
    setResult(null);
    setCurrent(null);
    setImgError(false);
  };

  const displayGame = result || current;

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes wheel-tune-scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .wheel-tune-scan-line {
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(16, 185, 129, 0.22) 50%,
            transparent 100%
          );
          animation: wheel-tune-scan 0.9s linear infinite;
        }
        @keyframes wheel-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        .wheel-pulse { animation: wheel-pulse 1.4s ease-in-out infinite; }
        @keyframes wheel-acquired {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .wheel-acquired { animation: wheel-acquired 0.35s ease-out forwards; }
      `}</style>

      {/* Pool indicator */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border border-white/8 bg-zinc-broadcast/40 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono"
      >
        <span className="inline-flex items-center gap-2 text-emerald-signal">
          <span
            className={`w-1.5 h-1.5 rounded-full bg-emerald-signal ${
              spinning ? 'wheel-pulse' : ''
            }`}
          />
          <span>{spinning ? 'Tuning…' : 'Wheel ready'}</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/65">Pool</span>
        <span className="text-white/75 tabular-nums">
          {String(games.length).padStart(3, '0')}
        </span>
      </div>

      {/* Reel viewport */}
      <div className="relative border border-white/10 bg-zinc-broadcast overflow-hidden">
        {/* Scanline atmosphere */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen motion-reduce:hidden z-20"
          aria-hidden="true"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(255,255,255,0.6) 2px, rgba(255,255,255,0.6) 3px)',
          }}
        />

        {/* Tuning scan line while spinning */}
        {spinning && (
          <div
            className="pointer-events-none absolute inset-0 z-30 overflow-hidden motion-reduce:hidden"
            aria-hidden="true"
          >
            <div className="wheel-tune-scan-line absolute inset-x-0 h-32" />
          </div>
        )}

        {/* Slate */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2 border-b border-white/8 bg-zinc-broadcast/80 text-[10px] font-bold tracking-eyebrow-lg uppercase font-mono">
          <span
            className={`inline-flex items-center gap-2 ${
              spinning
                ? 'text-orange-admin wheel-pulse'
                : 'text-emerald-signal'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                spinning ? 'bg-orange-admin' : 'bg-emerald-signal'
              }`}
            />
            <span>{spinning ? 'Tuning…' : result ? 'Signal lock' : 'Stand by'}</span>
          </span>
          <span className="text-white/55">WHEEL · GG-STEAM</span>
        </div>

        {/* Viewport body */}
        <div className="relative h-48 sm:h-56">
          {displayGame ? (
            <>
              {displayGame.img_logo_url && !imgError ? (
                <img
                  src={displayGame.img_logo_url}
                  alt=""
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
                    spinning ? 'opacity-50' : 'opacity-90'
                  }`}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-elevated/40">
                  <ImageOff size={24} className="text-white/20" aria-hidden="true" />
                </div>
              )}

              {/* Bottom shade */}
              <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-zinc-broadcast via-zinc-broadcast/70 to-transparent" />

              {/* Selection frame on lock */}
              {!spinning && result && (
                <div
                  className="pointer-events-none absolute inset-x-3 inset-y-9 border border-emerald-signal/50"
                  aria-hidden="true"
                >
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-emerald-signal font-bold text-lg leading-none">
                    [
                  </span>
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-emerald-signal font-bold text-lg leading-none">
                    ]
                  </span>
                </div>
              )}

              {/* Title block */}
              <div className="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4">
                <p
                  className={`font-black text-lg sm:text-xl tracking-tight text-white-body leading-tight ${
                    spinning ? 'blur-[1.5px]' : ''
                  }`}
                  style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                >
                  {displayGame.name}
                </p>
                {!spinning && displayGame.playtime_forever > 0 && (
                  <p className="text-[10px] tracking-eyebrow-md uppercase text-emerald-signal mt-1 font-mono tabular-nums">
                    {displayGame.playtime_forever}h logged
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 font-mono">
              <span className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/60">
                No signal
              </span>
              <span className="text-sm text-white/70 text-center">
                Hit Tune to pick a game.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Signal acquired panel */}
      {result && !spinning && (
        <div
          className="border border-emerald-signal/40 bg-zinc-card/40 px-4 py-3 wheel-acquired"
        >
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/65 mb-0.5 font-mono">
            Tonight you're playing
          </p>
          <p
            className="text-xl sm:text-2xl font-black text-white-body tracking-tight leading-tight"
            style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
          >
            {result.name}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={result ? reset : spin}
          disabled={spinning || games.length === 0}
          className={`group relative inline-flex items-center gap-3 px-10 sm:px-14 py-3.5 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden ${
            spinning
              ? 'bg-orange-admin/15 border border-orange-admin/40 text-orange-admin'
              : result
                ? 'bg-zinc-card border border-white/15 text-white-body hover:border-emerald-signal/50'
                : 'bg-emerald-signal text-zinc-broadcast hover:bg-emerald-bright border border-emerald-signal'
          }`}
        >
          {result && !spinning ? (
            <RotateCcw size={16} aria-hidden="true" />
          ) : (
            <Play
              size={16}
              aria-hidden="true"
              className={spinning ? 'wheel-pulse' : ''}
            />
          )}
          <span className="text-sm font-bold tracking-eyebrow-lg uppercase font-mono">
            {spinning ? 'Tuning…' : result ? 'Tune again' : 'Tune'}
          </span>
          {!spinning && !result && (
            <span
              className="text-sm font-bold tracking-eyebrow-lg opacity-70"
              aria-hidden="true"
            >
              →
            </span>
          )}
        </button>

        {games.length === 0 && (
          <p className="text-[10px] font-bold tracking-eyebrow-lg uppercase text-white/55 font-mono">
            No games match your search.
          </p>
        )}
      </div>
    </div>
  );
}
