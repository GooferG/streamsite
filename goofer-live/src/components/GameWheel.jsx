// GameWheel.jsx
import React, { useState } from 'react';

const SEGMENT_COLORS = [
  '#1e293b', // slate-800
  '#0f766e', // teal-700
  '#7c3aed', // violet-600
  '#b91c1c', // red-700
  '#f97316', // orange-400
  '#15803d', // green-700
];

export default function GameWheel({ games = [], onGameChosen }) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentGame, setCurrentGame] = useState(null);
  const [pendingIndex, setPendingIndex] = useState(null);

  if (!games.length) {
    return <p>Add some games to spin for!</p>;
  }

  const segmentAngle = 360 / games.length;

  // Build a conic-gradient background for the wheel
  const gradient = (() => {
    let angle = 0;
    const parts = games.map((_, idx) => {
      const start = angle;
      angle += segmentAngle;
      const color = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];
      return `${color} ${start}deg ${angle}deg`;
    });
    return `conic-gradient(${parts.join(', ')})`;
  })();

  const handleSpin = () => {
    if (isSpinning) return;

    const index = Math.floor(Math.random() * games.length);
    setPendingIndex(index);
    setIsSpinning(true);

    const spins = 4; // full rotations for drama
    const desiredAngle = index * segmentAngle + segmentAngle / 2; // center of slice

    const base = rotation % 360; // current orientation
    const extraRotation = spins * 360 + (desiredAngle - base);

    setRotation(rotation + extraRotation);
  };

  const handleTransitionEnd = () => {
    if (pendingIndex == null) return;

    const game = games[pendingIndex];
    setCurrentGame(game);
    setIsSpinning(false);
    setPendingIndex(null);

    if (onGameChosen) onGameChosen(game);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}
    >
      {/* Wheel + pointer */}
      <div style={{ position: 'relative', width: 260, height: 260 }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundImage: gradient,
            border: '4px solid #0f172a',
            boxShadow: '0 10px 20px rgba(15, 23, 42, 0.5)',
            transition: isSpinning
              ? 'transform 2.5s cubic-bezier(0.19, 1, 0.22, 1)'
              : 'none',
            transform: `rotate(${rotation}deg)`,
          }}
          onTransitionEnd={handleTransitionEnd}
        />

        {/* Pointer at the top */}
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderBottom: '18px solid #e5e7eb',
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.4))',
          }}
        />
      </div>

      {/* Spin button */}
      <button
        onClick={handleSpin}
        disabled={isSpinning}
        style={{
          marginTop: 16,
          padding: '10px 20px',
          borderRadius: 9999,
          border: 'none',
          fontSize: 16,
          cursor: isSpinning ? 'default' : 'pointer',
          opacity: isSpinning ? 0.7 : 1,
          background: 'linear-gradient(to right, #4f46e5, #06b6d4)',
          color: '#fff',
          fontWeight: 600,
        }}
      >
        {isSpinning ? 'Spinning…' : 'Spin for a game'}
      </button>

      {/* Result */}
      {currentGame && (
        <div style={{ marginTop: 16, fontSize: 18 }}>
          You should play: <strong>{currentGame}</strong>
        </div>
      )}

      {/* Legend so colors map to games */}
      <div style={{ marginTop: 16, fontSize: 14 }}>
        <strong>Legend:</strong>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
          {games.map((g, idx) => (
            <li
              key={`${g}-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
                }}
              />
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
