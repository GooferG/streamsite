import { scatterTier } from '../utils/scatterTier';

// Presentational tier pill. Renders nothing for a regular bonus.
// size="sm" → dense rows (short label); size="md" → opening card (full label).
export default function ScatterPill({ bonus, size = 'sm' }) {
  const tier = scatterTier(bonus);
  if (!tier) return null;

  const text = size === 'md' ? tier.full : tier.short;
  const base =
    'shrink-0 inline-flex items-center font-bold tracking-eyebrow-md uppercase font-mono border leading-none';
  const pad = size === 'md' ? 'px-1.5 py-0.5 text-[0.5625rem]' : 'px-1 py-0.5 text-[0.5rem]';

  if (tier.tone === 'orange') {
    return (
      <span className={`${base} ${pad} border-orange-admin/60 text-orange-admin`}>
        {text}
      </span>
    );
  }

  // gold — 5 scatter
  if (!tier.hidden) {
    return (
      <span className={`${base} ${pad} border-gold-scatter/60 text-gold-scatter`}>
        {text}
      </span>
    );
  }

  // hidden 5 scatter — shocking: solid gold fill, dark text, pulsing glow halo.
  // Plain <style> (not styled-jsx) matches the repo convention; the class name is
  // unique so the keyframe/selector don't collide with other global styles.
  return (
    <span
      className={`gg-scatter-hidden-pulse ${base} ${pad} border-gold-scatter bg-gold-scatter text-zinc-broadcast`}
    >
      {text}
      <style>{`
        .gg-scatter-hidden-pulse {
          animation: gg-scatter-hidden-pulse 1.4s ease-in-out infinite;
        }
        @keyframes gg-scatter-hidden-pulse {
          0% { box-shadow: 0 0 4px 1px rgba(251, 191, 36, 0.5); }
          50% { box-shadow: 0 0 12px 4px rgba(251, 191, 36, 0.9); }
          100% { box-shadow: 0 0 4px 1px rgba(251, 191, 36, 0.5); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gg-scatter-hidden-pulse {
            animation: none;
            box-shadow: 0 0 8px 2px rgba(251, 191, 36, 0.7);
          }
        }
      `}</style>
    </span>
  );
}
