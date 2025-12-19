import { useState, useRef, useEffect } from 'react';
import { Play, RotateCcw } from 'lucide-react';

export default function SlotMachineWheel({ games }) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const wheelRef = useRef(null);
  const [spinDuration, setSpinDuration] = useState(0);

  // Create extended list for smooth scrolling effect
  const extendedGames = [...games, ...games, ...games, ...games, ...games];

  // Create confetti particles
  const createConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000); // Remove after 3 seconds
  };

  const spinWheel = () => {
    if (isSpinning || games.length === 0) return;

    setIsSpinning(true);
    setSelectedGame(null);

    // Random game selection
    const randomIndex = Math.floor(Math.random() * games.length);
    const selectedGameData = games[randomIndex];

    // Calculate spin duration (3-5 seconds)
    const duration = 3000 + Math.random() * 2000;
    setSpinDuration(duration);

    // Calculate final position to land on selected game
    // We want to scroll through multiple cycles and land on the selected game
    const itemHeight = 80; // Height of each slot item
    const cycles = 3; // Number of full cycles through the list

    // Calculate offset to center the selected item in the selection window
    // The wheel container is 320px (h-80), selection window is centered at 160px
    // Each item is 80px tall, so to center an item we need its center (40px) at 160px
    // The wheel starts at top-1/2 with -translate-y-10 (-40px from center)
    // To center the selected item: move by (cycles * games.length + randomIndex) items,
    // then add 40px to center the item (half its height) in the selection window
    const finalOffset = (cycles * games.length + randomIndex) * itemHeight + itemHeight / 2;

    // Apply animation
    if (wheelRef.current) {
      wheelRef.current.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
      wheelRef.current.style.transform = `translateY(-${finalOffset}px)`;
    }

    // Set selected game after animation completes
    setTimeout(() => {
      setSelectedGame(selectedGameData);
      setIsSpinning(false);
      createConfetti(); // Trigger confetti animation
    }, duration);
  };

  const resetWheel = () => {
    setSelectedGame(null);
    setIsSpinning(false);
    if (wheelRef.current) {
      wheelRef.current.style.transition = 'none';
      wheelRef.current.style.transform = 'translateY(0)';
    }
  };

  return (
    <div className="space-y-6">
      {/* Slot Machine Display */}
      <div className="relative mx-auto max-w-2xl">
        {/* Top Frame */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-zinc-950 to-transparent z-10 pointer-events-none" />

        {/* Selection Window */}
        <div className="absolute top-1/2 left-0 right-0 transform -translate-y-1/2 h-20 border-y-4 border-emerald-500 bg-emerald-500/10 z-10 pointer-events-none">
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
            <div className="w-0 h-0 border-t-8 border-t-transparent border-r-12 border-r-emerald-500 border-b-8 border-b-transparent ml-2" />
          </div>
          <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
            <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-emerald-500 border-b-8 border-b-transparent mr-2" />
          </div>
        </div>

        {/* Wheel Container */}
        <div className="relative h-80 overflow-hidden bg-gradient-to-br from-zinc-900/50 to-purple-900/50 border-2 border-white/10 rounded-xl backdrop-blur-sm">
          <div
            ref={wheelRef}
            className="absolute top-1/2 left-0 right-0 transform -translate-y-10"
            style={{ transition: 'none', transform: 'translateY(0)' }}
          >
            {extendedGames.map((game, index) => (
              <div
                key={`${game.id}-${index}`}
                className="h-20 flex items-center justify-center px-6 border-b border-white/5"
              >
                <div className="text-center">
                  <p className="text-xl font-black text-white">{game.name}</p>
                  <p className="text-sm text-white/60">{game.provider}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Frame */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-zinc-950 to-transparent z-10 pointer-events-none" />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={spinWheel}
          disabled={isSpinning || games.length === 0}
          className={`group relative px-12 py-6 rounded-2xl font-black text-2xl tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
            isSpinning
              ? 'bg-gradient-to-r from-gray-500 to-gray-600'
              : 'bg-gradient-to-r from-emerald-500 to-purple-500 hover:from-emerald-600 hover:to-purple-600 shadow-lg hover:shadow-2xl hover:scale-105'
          }`}
        >
          <span className="flex items-center gap-3">
            <Play size={28} className={isSpinning ? 'animate-pulse' : ''} />
            {isSpinning ? 'SPINNING...' : 'SPIN THE WHEEL'}
          </span>
          {!isSpinning && (
            <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
          )}
        </button>

        {selectedGame && (
          <button
            onClick={resetWheel}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-emerald-400/60 transition-all"
          >
            <RotateCcw size={18} />
            Reset Wheel
          </button>
        )}
      </div>

      {/* Selected Game Display */}
      {selectedGame && !isSpinning && (
        <div className="mt-8 p-8 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-purple-500/20 border-4 border-emerald-500/50 backdrop-blur-sm animate-pulse-slow">
          <div className="text-center space-y-4">
            <p className="text-emerald-400 font-bold text-sm uppercase tracking-widest">
              🎰 Selected Game
            </p>
            <h3 className="text-5xl font-black text-white">
              {selectedGame.name}
            </h3>
            <p className="text-2xl text-white/70 font-bold">
              {selectedGame.provider}
            </p>

            <div className="flex justify-center gap-4 pt-4">
              <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
                <p className="text-xs text-white/60">RTP</p>
                <p className="text-lg font-bold text-emerald-300">{selectedGame.rtp}%</p>
              </div>
              <div className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                <p className="text-xs text-white/60">Volatility</p>
                <p className="text-lg font-bold text-purple-300 capitalize">{selectedGame.volatility}</p>
              </div>
              {selectedGame.maxWin && (
                <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-white/60">Max Win</p>
                  <p className="text-lg font-bold text-yellow-300">{selectedGame.maxWin}x</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {games.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/60">
            No games available. Please enable at least one provider in the filters.
          </p>
        </div>
      )}

      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="confetti-particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: [
                  '#10b981', // emerald
                  '#a855f7', // purple
                  '#eab308', // yellow
                  '#f97316', // orange
                  '#ec4899', // pink
                ][Math.floor(Math.random() * 5)],
              }}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .confetti-particle {
          position: absolute;
          width: 10px;
          height: 10px;
          top: -10px;
          animation: confetti-fall 3s ease-in forwards;
        }
      `}</style>
    </div>
  );
}