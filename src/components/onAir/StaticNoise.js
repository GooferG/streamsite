// Channel-change static: the noise and rolling band the Monitor, the couch TV
// and the camera's cut all share. Decorative, so aria-hidden.
export const NOISE = {
  backgroundImage:
    'repeating-radial-gradient(circle at 17% 32%, #fff 0 1px, #000 1px 2px, #777 2px 3px), repeating-conic-gradient(#222 0 7deg, #ddd 7deg 9deg, #555 9deg 15deg)',
  backgroundSize: '97px 89px, 61px 53px',
  filter: 'contrast(1.6) grayscale(1)',
};

export default function StaticNoise({ className = '', style, testId = 'onair-static' }) {
  return (
    <div
      className={`pointer-events-none overflow-hidden bg-[#07060a] ${className}`}
      style={style}
      data-testid={testId}
      aria-hidden="true"
    >
      <div className="absolute inset-[-20%] motion-safe:animate-onair-static opacity-[0.85]" style={NOISE} />
      <div className="absolute inset-x-0 h-[30%] motion-safe:animate-onair-roll bg-gradient-to-b from-transparent via-white/[0.35] to-transparent" />
    </div>
  );
}
