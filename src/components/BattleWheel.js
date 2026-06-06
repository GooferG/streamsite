import { useState, useRef, useEffect } from 'react';

// Wheel that picks the next player from a pool of un-played players.
// props:
//   players: [{ id, name, slot }]  — already filtered to un-played
//   onResult: (player) => void     — called once when the spin locks
//   disabled: boolean
export default function BattleWheel({ players = [], onResult, disabled = false }) {
  const [spinning, setSpinning] = useState(false);
  const [current, setCurrent] = useState(null);
  const [result, setResult] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const spin = () => {
    if (spinning || disabled || players.length === 0) return;
    setResult(null);
    setSpinning(true);

    const winner = players[Math.floor(Math.random() * players.length)];
    let speed = 50;
    let elapsed = 0;
    const duration = 3000;

    const tick = () => {
      setCurrent(players[Math.floor(Math.random() * players.length)]);
      elapsed += speed;
      if (elapsed < duration) {
        speed = 50 + Math.floor((elapsed / duration) * 250);
        timeoutRef.current = setTimeout(tick, speed);
      } else {
        setCurrent(winner);
        setResult(winner);
        setSpinning(false);
        if (onResult) onResult(winner);
      }
    };
    timeoutRef.current = setTimeout(tick, speed);
  };

  const display = result || current;

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes wheel-tune-scan { 0% { transform: translateY(-100%);} 100% { transform: translateY(100%);} }
        .bw-scan-line { background: linear-gradient(to bottom, transparent 0%, rgba(168,85,247,0.25) 50%, transparent 100%); animation: wheel-tune-scan 0.9s linear infinite; }
        @keyframes wheel-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }
        .bw-pulse { animation: wheel-pulse 1.4s ease-in-out infinite; }
      `}</style>

      {/* Pool indicator */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border border-white/8 bg-zinc-broadcast/40 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
        <span className="inline-flex items-center gap-2 text-purple-bright">
          <span className={`w-1.5 h-1.5 rounded-full bg-purple-bright ${spinning ? 'bw-pulse' : ''}`} />
          <span>{spinning ? 'Spinning…' : 'Wheel ready'}</span>
        </span>
        <span className="text-white/15">·</span>
        <span className="text-white/65">In pool</span>
        <span className="text-white/75 tabular-nums">{String(players.length).padStart(2, '0')}</span>
      </div>

      {/* Reel viewport */}
      <div className="relative border border-white/10 bg-zinc-broadcast overflow-hidden">
        {spinning && (
          <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden motion-reduce:hidden" aria-hidden="true">
            <div className="bw-scan-line absolute inset-x-0 h-32" />
          </div>
        )}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 py-2 border-b border-white/8 bg-zinc-broadcast/80 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono">
          <span className={`inline-flex items-center gap-2 ${spinning ? 'text-purple-bright bw-pulse' : 'text-emerald-signal'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${spinning ? 'bg-purple-bright' : 'bg-emerald-signal'}`} />
            <span>{spinning ? 'Spinning…' : result ? 'Player locked' : 'Stand by'}</span>
          </span>
          <span className="text-white/55">BATTLE · NEXT UP</span>
        </div>

        <div className="relative h-48 sm:h-56 flex items-center justify-center">
          {display ? (
            <div className="text-center px-4">
              <p
                className={`font-black text-2xl sm:text-3xl tracking-tight text-white-body leading-tight ${spinning ? 'blur-[1.5px]' : ''}`}
                style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
              >
                {display.name}
              </p>
              {!spinning && display.slot && (
                <p className="text-[0.6875rem] tracking-eyebrow-md uppercase text-purple-bright mt-2 font-mono">
                  {display.slot}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-4 font-mono">
              <span className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/60">No signal</span>
              <span className="text-sm text-white/70 text-center">
                {players.length === 0 ? 'Everyone has played.' : 'Spin to pick the next player.'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Spin button */}
      <button
        type="button"
        onClick={spin}
        disabled={spinning || disabled || players.length === 0}
        className="w-full px-6 py-3 bg-purple-gamba text-white font-bold text-xs tracking-eyebrow-lg uppercase font-mono disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-bright transition-colors"
      >
        {spinning ? 'Spinning…' : '⟳ Spin the wheel'}
      </button>
    </div>
  );
}
