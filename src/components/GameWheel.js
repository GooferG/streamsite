import { useState, useRef } from 'react';
import { Shuffle, RotateCcw } from 'lucide-react';

export default function GameWheel({ games }) {
  const [spinning, setSpinning] = useState(false);
  const [current, setCurrent] = useState(null);
  const [result, setResult] = useState(null);
  const timeoutRef = useRef(null);

  const spin = () => {
    if (spinning || games.length === 0) return;

    setResult(null);
    setSpinning(true);

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
  };

  const displayGame = result || current;

  return (
    <div className="space-y-6">
      {/* Pool info */}
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-sm">
          Spinning from <span className="text-emerald-400 font-bold">{games.length}</span> game{games.length !== 1 ? 's' : ''}
        </p>
        {result && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60 transition-all"
          >
            <RotateCcw size={12} />
            RESET
          </button>
        )}
      </div>

      {/* Slot display */}
      <div className="relative h-48 rounded-xl overflow-hidden border border-white/10 bg-black/40">
        {displayGame ? (
          <>
            <img
              src={displayGame.img_logo_url}
              alt={displayGame.name}
              className={`w-full h-full object-cover transition-opacity duration-150 ${spinning ? 'opacity-60' : 'opacity-100'}`}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className={`font-black text-xl tracking-tight text-white ${spinning ? 'blur-[1px]' : ''}`}>
                {displayGame.name}
              </p>
              {!spinning && displayGame.playtime_forever > 0 && (
                <p className="text-emerald-400 text-sm font-bold mt-1">
                  {displayGame.playtime_forever}h played
                </p>
              )}
            </div>
            {spinning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="w-10 h-10 border-4 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-white/30 text-sm">
            Hit SPIN to pick a game
          </div>
        )}
      </div>

      {/* Result banner */}
      {result && !spinning && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-900/40 to-purple-900/40 border border-emerald-500/30 text-center">
          <p className="text-white/60 text-sm mb-1">Tonight you're playing</p>
          <p className="text-2xl font-black text-white tracking-tight">{result.name}</p>
        </div>
      )}

      {/* Spin / Spin Again button */}
      <button
        onClick={result ? reset : spin}
        disabled={spinning || games.length === 0}
        className="w-full py-4 rounded-xl font-black text-lg tracking-wide transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-purple-500 hover:from-emerald-600 hover:to-purple-600 text-white shadow-lg"
      >
        <Shuffle size={22} />
        {spinning ? 'SPINNING...' : result ? 'SPIN AGAIN' : 'SPIN'}
      </button>

      {games.length === 0 && (
        <p className="text-center text-white/40 text-sm">No games match your search.</p>
      )}
    </div>
  );
}
