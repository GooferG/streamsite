const TONES = {
  neutral: 'bg-white/[0.07] text-onair-ink-1',
  signal: 'bg-onair-signal/[0.14] text-onair-signal-light',
  winner:
    'bg-gradient-to-b from-onair-winner-hot to-onair-winner-deep font-extrabold text-onair-winner-ink shadow-onair-winner-chip',
};

export default function Chip({ tone = 'neutral', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.9375rem] leading-tight ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
