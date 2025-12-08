import React, { useState, useEffect } from 'react';

export default function TVStaticIntro() {
  const [phase, setPhase] = useState('static');

  useEffect(() => {
    const shrinkTimer = setTimeout(() => {
      setPhase('shrink');
    }, 1000);

    const fadeTimer = setTimeout(() => {
      setPhase('fadeout');
    }, 1800);

    return () => {
      clearTimeout(shrinkTimer);
      clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-300 ${
        phase === 'fadeout' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className={`relative transition-all duration-700 ease-out ${
          phase === 'shrink' || phase === 'fadeout'
            ? 'w-0 h-0 opacity-0'
            : 'w-full h-full'
        }`}
        style={{
          background: `repeating-linear-gradient(
            0deg,
            #000 0px,
            #000 2px,
            #fff 2px,
            #fff 4px
          )`,
          animation: 'tvStatic 0.1s steps(10) infinite',
        }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `
              radial-gradient(circle at 20% 50%, rgba(255, 0, 0, 0.2) 0%, transparent 50%),
              radial-gradient(circle at 60% 70%, rgba(0, 255, 0, 0.2) 0%, transparent 50%),
              radial-gradient(circle at 80% 30%, rgba(0, 0, 255, 0.2) 0%, transparent 50%)
            `,
            animation: 'colorShift 0.3s infinite',
          }}
        />

        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0, 0, 0, 0.5) 2px,
              rgba(0, 0, 0, 0.5) 4px
            )`,
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 0%, black 100%)',
            opacity: 0.7,
          }}
        />

        {(phase === 'shrink' || phase === 'fadeout') && (
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-1 bg-white animate-pulse"
            style={{
              boxShadow: '0 0 50px 20px rgba(255, 255, 255, 0.8)',
            }}
          />
        )}
      </div>

      <style jsx>{`
        @keyframes tvStatic {
          0% {
            background-position: 0 0;
          }
          10% {
            background-position: -5% -10%;
          }
          20% {
            background-position: -15% 5%;
          }
          30% {
            background-position: 7% -25%;
          }
          40% {
            background-position: -5% 25%;
          }
          50% {
            background-position: -15% 10%;
          }
          60% {
            background-position: 15% 0%;
          }
          70% {
            background-position: 0% 15%;
          }
          80% {
            background-position: 3% 35%;
          }
          90% {
            background-position: -10% 10%;
          }
          100% {
            background-position: 0 0;
          }
        }

        @keyframes colorShift {
          0% {
            opacity: 0.1;
          }
          25% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.2;
          }
          75% {
            opacity: 0.4;
          }
          100% {
            opacity: 0.1;
          }
        }
      `}</style>
    </div>
  );
}
